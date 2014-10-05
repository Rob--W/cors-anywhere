// © 2013 - 2014 Rob Wu <rob@robwu.nl>
// Released under the MIT license

'use strict';
/* jshint node:true, eqnull:true, sub:true, quotmark:single, unused:true */

var http = require('http');
var httpProxy = require('http-proxy');
var net = require('net');
var url = require('url');
var regexp_tld = require('./regexp-top-level-domain');

var help_file = __dirname + '/help.txt';
var help_text;
function showUsage(headers, response) {
  headers['content-type'] = 'text/plain';
  if (help_text != null) {
    response.writeHead(200, headers);
    response.end(help_text);
  } else {
    require('fs').readFile(help_file, 'utf8', function(err, data) {
      if (err) {
        console.error(err);
        response.writeHead(500, headers);
        response.end();
      } else {
        help_text = data;
        showUsage(headers, response); // Recursive call, but since data is a string, the recursion will end
      }
    });
  }
}

/**
 * Check whether the specified hostname is valid.
 *
 * @param hostname {string} Host name (excluding port) of requested resource.
 * @return {boolean} Whether the requested resource can be accessed.
 */
function isValidHostName(hostname) {
  return !!(
    regexp_tld.test(hostname) ||
    net.isIPv4(hostname) ||
    net.isIPv6(hostname)
  );
}

/**
 * Adds CORS headers to the response headers.
 *
 * @param headers {object} Response headers
 * @param request {ServerRequest}
 */
function withCORS(headers, request) {
  headers['access-control-allow-origin'] = '*';
  if (request.headers['access-control-request-method']) {
    headers['access-control-allow-methods'] = request.headers['access-control-request-method'];
    delete request.headers['access-control-request-method'];
  }
  if (request.headers['access-control-request-headers']) {
    headers['access-control-allow-headers'] = request.headers['access-control-request-headers'];
    delete request.headers['access-control-request-headers'];
  }

  headers['access-control-expose-headers'] = Object.keys(headers).join(',');

  return headers;
}

/**
 * Performs the actual proxy request.
 *
 * @param req {ServerRequest} Incoming http request
 * @param res {ServerResponse} Outgoing (proxied) http request
 * @param proxy {HttpProxy}
 */
function proxyRequest(req, res, proxy) {
  var location = req.corsAnywhereRequestState.location;

  req.url = location.path;
  // Let the "Host" header be the host part of the path (including port, if specified).
  req.headers.host = location.host;

  // Start proxying the request
  proxy.web(req, res, {
    target: location
  });
}

/**
 * "Allow observer to modify headers or abort response"
 * https://github.com/nodejitsu/node-http-proxy/blob/05f0b891/lib/http-proxy/passes/web-incoming.js#L147
 * 
 * This method modifies the response headers of the proxied response.
 * If a redirect is detected, the response is not sent to the client,
 * and a new request is initiated.
 * 
 * @param response {ClientRequest} The response of the proxied request
 * @param req {IncomingMessage} Incoming HTTP request, augmented with property corsAnywhereRequestState
 * @param req.corsAnywhereRequestState {object}
 * @param req.corsAnywhereRequestState.location {object} See parseURL
 * @param req.corsAnywhereRequestState.proxyBaseUrl {string} Base URL of the CORS API endpoint
 * @param req.corsAnywhereRequestState.maxRedirects {number} Maximum number of redirects
 * @param req.corsAnywhereRequestState.redirectCount_ {number} Internally used to count redirects
 * @param res {ServerResponse} Outgoing (proxied) HTTP request
 *
 * @this {HttpProxy}
 */
function onProxyResponse(response, req, res) {
  /* jshint validthis:true */
  var proxy = this;
  var requestState = req.corsAnywhereRequestState;

  var statusCode = response.statusCode;

  if (!requestState.redirectCount_) {
    res.setHeader('x-request-url', requestState.location.href);
  }
  // Handle redirects
  if (statusCode === 301 || statusCode === 302 || statusCode === 303 || statusCode === 307 || statusCode === 308) {
    var locationHeader = response.headers['location'];
    if (locationHeader) {
      locationHeader = url.resolve(requestState.location.href, locationHeader);

      if (statusCode === 301 || statusCode === 302 || statusCode === 303) {
        // Exclude 307 & 308, because they are rare, and require preserving the method + request body
        requestState.redirectCount_ = requestState.redirectCount_ + 1 || 1;
        if (requestState.redirectCount_ <= requestState.maxRedirects) {
          // Handle redirects within the server, because some clients (e.g. Android Stock Browser)
          // cancel redirects.
          // Set header for debugging purposes. Do not try to parse it!
          res.setHeader('X-CORS-Redirect-' + requestState.redirectCount_, statusCode + ' ' + locationHeader);
          
          req.method = 'GET';
          req.headers['content-length'] = '0';
          delete req.headers['content-type'];
          requestState.location = parseURL(locationHeader);

          // ### Dispose the current proxied request
          // Haha - hack! This should be fixed when (if?) node-http-proxy supports cancelation of requests..
          // Shadow all methods that mutate the |res| object.
          // See https://github.com/nodejitsu/node-http-proxy/blob/05f0b891/lib/http-proxy/passes/web-outgoing.js
          var setHeader = res.setHeader;
          var writeHead = res.writeHead;
          res.setHeader = res.writeHead = function noop() {};
          response.on = function noop2() {};
          response.pipe = function(res) {
              res.setHeader = setHeader;
              res.writeHead = writeHead;
              // Trigger proxyReq.abort() (this is not of any imporance, it's just used to stop wasting resources.)
              // https://github.com/nodejitsu/node-http-proxy/blob/05f0b891/lib/http-proxy/passes/web-incoming.js#L125-L128
              req.emit('aborted');
              // Remove all listeners (=reset events to initial state)
              req.removeAllListeners();
              // Initiate a new proxy request.
              proxyRequest(req, res, proxy);
          };
          return;
        }
      }
      response.headers['location'] = requestState.proxyBaseUrl + '/' + locationHeader;
    }
  }

  // Strip cookies
  delete response.headers['set-cookie'];
  delete response.headers['set-cookie2'];

  response.headers['x-final-url'] = requestState.location.href;
  withCORS(response.headers, req);
}


/**
 * @param req_url {string} The requested URL (scheme is optional).
 * @return {object} URL parsed using url.parse
 */
function parseURL(req_url) {
  var match = req_url.match(/^(?:(https?:)?\/\/)?(([^\/?]+?)(?::(\d{0,5})(?=[\/?]|$))?)([\/?][\S\s]*|$)/i);
  //                              ^^^^^^^          ^^^^^^^^      ^^^^^^^                ^^^^^^^^^^^^
  //                            1:protocol       3:hostname     4:port                 5:path + query string
  //                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                                            2:host
  if (!match) {
    return null;
  }
  if (!match[1]) {
    // scheme is omitted.
    if (req_url.lastIndexOf('//', 0) === -1) {
      // "//" is omitted.
      req_url = '//' + req_url;
    }
    req_url = (match[4] == '443' ? 'https:' : 'http:') + req_url;
  }
  return url.parse(req_url);
}

// Request handler factory
var getHandler = exports.getHandler = function(options, proxy) {
  var corsAnywhere = {
    maxRedirects: 5,          // Maximum number of redirects to be followed.
    requireHeader: null,      // Require a header to be set?
    removeHeaders: []         // Strip these request headers
  };
  if (options) {
    Object.keys(corsAnywhere).forEach(function(option) {
      if (Object.prototype.hasOwnProperty.call(options, option)) {
        corsAnywhere[option] = options[option];
      }
    });
  }
  // Convert corsAnywhere.requireHeader to an array of lowercase header names, or null.
  if (corsAnywhere.requireHeader) {
    if (typeof corsAnywhere.requireHeader === 'string') {
      corsAnywhere.requireHeader = [corsAnywhere.requireHeader];
    } else if (!Array.isArray(corsAnywhere.requireHeader) || corsAnywhere.requireHeader.length === 0) {
      corsAnywhere.requireHeader = null;
    } else {
      corsAnywhere.requireHeader = corsAnywhere.requireHeader.map(function(headerName) {
        return headerName.toLowerCase();
      });
    }
  }
  var hasRequiredHeaders = function(headers) {
    return !corsAnywhere.requireHeader || corsAnywhere.requireHeader.some(function(headerName) {
      return Object.hasOwnProperty.call(headers, headerName);
    });
  };

  return function(req, res) {
    var cors_headers = withCORS({}, req);
    if (req.method == 'OPTIONS') {
      // Pre-flight request. Reply successfully:
      res.writeHead(200, cors_headers);
      res.end();
      return;
    }

    var location = parseURL(req.url.slice(1));

    if (!location) {
      // Invalid API call. Show how to correctly use the API
      showUsage(cors_headers, res);
      return;
    }

    if (location.host === 'iscorsneeded') {
      // Is CORS needed? This path is provided so that API consumers can test whether it's necessary
      // to use CORS. The server's reply is always No, because if they can read it, then CORS headers
      // are not necessary.
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('no');
      return;
    }

    if (location.port > 65535) {
      // Port is higher than 65535
      res.writeHead(400, 'Invalid port', cors_headers);
      res.end('Port number too large: ' + location.port);
      return;
    }

    if (!isValidHostName(location.hostname)) {
      // Don't even try to proxy invalid hosts (such as /favicon.ico, /robots.txt)
      res.writeHead(404, 'Invalid host', cors_headers);
      res.end('Invalid host: ' + location.hostname);
      return;
    }

    if (!hasRequiredHeaders(req.headers)) {
      res.writeHead(400, 'Header required', cors_headers);
      res.end('Missing required request header. Must specify one of: ' + corsAnywhere.requireHeader);
      return;
    }

    var isRequestedOverHttps = req.connection.encrypted || /^\s*https/.test(req.headers['x-forwarded-proto']);
    var proxyBaseUrl = (isRequestedOverHttps ? 'https://' : 'http://') + req.headers.host;

    corsAnywhere.removeHeaders.forEach(function(header) {
      delete req.headers[header];
    });


    req.corsAnywhereRequestState = {
      location: location,
      maxRedirects: corsAnywhere.maxRedirects,
      proxyBaseUrl: proxyBaseUrl
    };

    proxyRequest(req, res, proxy);
  };
};

// Create server with default and given values
// Creator still needs to call .listen()
exports.createServer = function createServer(options) {
  if (!options) options = {};

  // Default options:
  var httpProxyOptions = {
    xfwd: true,            // Append X-Forwarded-* headers
  };
  // Allow user to override defaults and add own options
  if (options.httpProxyOptions) {
    Object.keys(options.httpProxyOptions).forEach(function(option) {
      httpProxyOptions[option] = options.httpProxyOptions[option];
    });
  }

  var proxy = httpProxy.createServer(httpProxyOptions);
  var server = http.createServer(getHandler(options, proxy));

  // When the server fails, just show a 404 instead of Internal server error
  proxy.on('error', function(err, req, res) {
    if (res._headerSent) {
      // E.g. when the server replies with an invalid Content-Length value,
      // causing the response to end as expected while triggering the
      // "HPE_INVALID_CONSTANT" error.
      return;
    }
    res.writeHead(404, {'Access-Control-Allow-Origin': '*'});
    res.end('Not found because of proxy error: ' + err);
  });
  proxy.on('proxyRes', onProxyResponse);

  return server;
};
