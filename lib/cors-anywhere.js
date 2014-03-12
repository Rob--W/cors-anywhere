// © 2013 Rob W <gwnRob@gmail.com>
// Released under the MIT license

'use strict';
/* jshint node:true, eqnull:true, sub:true, quotmark:single, unused:true */

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
  return !(
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

  var exposedHeaders = headers['access-control-expose-headers'] || '';
  if (!/,\s*location\s*,/i.test(','+exposedHeaders+',')) exposedHeaders += ',location';
  if (!/,\s*x-request-url\s*,/i.test(','+exposedHeaders+',')) exposedHeaders += ',x-request-url,x-final-url';
  if (exposedHeaders.charAt(0) === ',') exposedHeaders = exposedHeaders.substr(1);
  headers['access-control-expose-headers'] = exposedHeaders;

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

  req.url = location.pathAndQueryString;
  // Let the "Host" header be the host part of the path (including port, if specified).
  req.headers.host = location.host;

  // Start proxying the request
  proxy.proxyRequest(req, res, {
    host: location.hostname,
    port: location.port,
    target: {
      https: location.isHttps
    }
  });
}


/**
 * "Allow observer to modify headers or abort response"
 * https://github.com/nodejitsu/node-http-proxy/blob/ebbba73e/lib/node-http-proxy/http-proxy.js#L321-L322
 * 
 * This method modifies the response headers of the proxied response.
 * If a redirect is detected, the response is not sent to the client,
 * and a new request is initiated.
 * 
 * @param req {IncomingMessage} Incoming HTTP request, augmented with property corsAnywhereRequestState
 * @param req.corsAnywhereRequestState {object}
 * @param req.corsAnywhereRequestState.location {object} See parseURL
 * @param req.corsAnywhereRequestState.proxyBaseUrl {string} Base URL of the CORS API endpoint
 * @param req.corsAnywhereRequestState.maxRedirects {number} Maximum number of redirects
 * @param req.corsAnywhereRequestState.redirectCount_ {number} Internally used to count redirects
 * @param res {ServerResponse} Outgoing (proxied) HTTP request
 * @param response {ClientRequest} The 
 *
 * @this {HttpProxy}
 */
function onProxyResponse(req, res, response) {
  /* jshint validthis:true */
  var proxy = this;
  var requestState = req.corsAnywhereRequestState;

  var statusCode = response.statusCode;

  if (!requestState.redirectCount_) {
    res.setHeader('x-request-url', requestState.location.full_url);
  }
  // Handle redirects
  if (statusCode === 301 || statusCode === 302 || statusCode === 303 || statusCode === 307 || statusCode === 308) {
    var locationHeader = response.headers['location'];
    if (locationHeader) {
      locationHeader = url.resolve(requestState.location.full_url, locationHeader);

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
          // Verified assumption: When proxy.proxyRequest is called for the first time,
          //  there are no event listeners on the "req" object.

          // First remove the "end" event, to avoid the req.end() call by node-http-proxy/http-proxy
          // https://github.com/nodejitsu/node-http-proxy/blob/ebbba73e/lib/node-http-proxy/http-proxy.js#L310-319
          response.removeAllListeners('end');
          // Trigger disposal of the reverseProxy
          // https://github.com/nodejitsu/node-http-proxy/blob/ebbba73e/lib/node-http-proxy/http-proxy.js#L375-L378
          req.emit('aborted');
          // Remove all listeners (=events reset to initial state)
          req.removeAllListeners();

          // Initiate a new proxy request.
          proxyRequest(req, res, proxy);
          // Trigger reverseProxy.end() to initiate the proxy
          // The event listener is added at the end of HttpProxy.prototype.proxyRequest, synchronously.
          // https://github.com/nodejitsu/node-http-proxy/blob/ebbba73e/lib/node-http-proxy/http-proxy.js#L407-L415
          req.emit('end');

          // The proxyResponse event is wrapped in a try-catch, throwing an error
          // prevents the response from being passed to the client.
          throw new Error('Prevent current response from being passed through.');
        }
      }
      response.headers['location'] = requestState.proxyBaseUrl + '/' + locationHeader;
    }
  }
  withCORS(response.headers, req);

  // Don't slip through cookies
  delete response.headers['set-cookie'];
  delete response.headers['set-cookie2'];

  response.headers['x-final-url'] = requestState.location.full_url;
}


/**
 * @param req_url {string} The requested URL (scheme is optional).
 * @return {object} Strings: full_url, host, hostname, pathAndQueryString
 *                  Number: port
 *                  boolean: isHttps
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
  var isHttps = (match[1] && match[1].toLowerCase()) === 'https:';
  var location = {
    full_url: match[0],
    isHttps: isHttps,
    host: match[2],
    hostname: match[3],
    port: match[4] ? +match[4] : (isHttps ? 443 : 80),
    pathAndQueryString: match[5]
  };

  if (!match[1]) { // Scheme is omitted.
    location.full_url = (location.port === 443 ? 'https:' : 'http:') + location.full_url.replace(/^(?!\/)/, '//');
  }
  return location;
}

// Request handler factory
var getHandler = exports.getHandler = function(options) {
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

  return function(req, res, proxy) {
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

    if (isValidHostName(location.hostname)) {
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

    if (!proxy.hasCorsAnywhereResponseHandler) { // Runs once per HttpProxy instance
      proxy.on('proxyResponse', onProxyResponse);
      proxy.hasCorsAnywhereResponseHandler = true;
    }

    proxyRequest(req, res, proxy);
  };
};

// Create server with default and given values
// Creator still needs to call .listen()
exports.createServer = function createServer(options) {
  if (!options) options = {};

  // Default options:
  var httpProxyOptions = {
    xforward: {
      enable: true            // Append X-Forwarded-* headers
    }
  };
  // Allow user to override defaults and add own options
  if (options.httpProxyOptions) {
    Object.keys(options.httpProxyOptions).forEach(function(option) {
      httpProxyOptions[option] = options.httpProxyOptions[option];
    });
  }

  var handler = getHandler(options);
  var server = httpProxy.createServer(httpProxyOptions, handler);

  // When the server fails, just show a 404 instead of Internal server error
  server.proxy.on('proxyError', function(err, req, res) {
    res.writeHead(404, {'Access-Control-Allow-Origin': '*'});
    res.end('Not found because of proxy error: ' + err);
  });

  return server;
};
