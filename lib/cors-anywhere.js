// © 2013 Rob W <gwnRob@gmail.com>
// Released under the MIT license

'use strict';
/* jshint node:true, eqnull:true, sub:true, quotmark:single */

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
function hasNoContent(hostname) {
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
  var origin = request.headers.origin || 'null';
  headers['access-control-allow-origin'] = origin === 'null' ? '*' : origin;
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
  if (!/,\s*x-request-url\s*,/i.test(','+exposedHeaders+',')) exposedHeaders += ',x-request-url';
  if (exposedHeaders.charAt(0) === ',') exposedHeaders = exposedHeaders.substr(1);
  headers['access-control-expose-headers'] = exposedHeaders;

  return headers;
}

/**
 * @param host {string} Host name (excluding port) of requested resource
 */
function isForbidden(host) {
  return false; // TODO
}

/**
 * Performs the actual proxy request.
 *
 * @param req {ServerRequest} Incoming http request
 * @param res {ServerResponse} Outgoing (proxied) http request
 * @param proxy {HttpProxy}
 * @param full_url {string} Canonical URL of outgoing (proxied) http request.
 * @param isRequestedOverHttps {boolean} Whether the incoming request originates from https
 */
function proxyRequest(req, res, proxy, full_url, isRequestedOverHttps, proxyOptions) {
  if (isForbidden(proxyOptions.host)) {
    res.writeHead(403, 'Refused to visit', withCORS({'Location': full_url}, req));
    return;
  }

  var realHost = req.headers.host;
  // Let the "Host" header be the host part of the path (including port, if specified).
  req.headers.host = full_url.split('/', 3)[2];

  // "Allow observer to modify headers or abort response"
  // https://github.com/nodejitsu/node-http-proxy/blob/ebbba73e/lib/node-http-proxy/http-proxy.js#L321-L322
  proxy.on('proxyResponse', function(req, res, response) {
    withCORS(response.headers, req);

    var statusCode = response.statusCode;
    // Handle redirects
    if (statusCode === 301 || statusCode === 302 || statusCode === 303 || statusCode === 307 || statusCode === 308) {
      var locationHeader = response.headers['location'];
      if (locationHeader) {
        response.headers['location'] = (isRequestedOverHttps ? 'https://' : 'http://') + realHost + '/' +
                                       url.resolve(full_url, locationHeader);
      }
    }

    // Don't slip through cookies
    delete response.headers['set-cookie'];
    delete response.headers['set-cookie2'];

    response.headers['x-request-url'] = full_url;
  });

  // Start proxying the request
  proxy.proxyRequest(req, res, proxyOptions);
}


// Request handler factory
var getHandler = exports.getHandler = function(options) {
  var corsAnywhere = {
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
    } else {
      // Actual request. First, extract the desired URL from the request:
      var full_url, host, hostname, port, path, match, isHttps;
      match = req.url.match(/^\/(?:(https?:)?\/\/)?(([^\/?]+?)(?::(\d{0,5})(?=[\/?]|$))?)([\/?][\S\s]*|$)/i);
      //                            ^^^^^^^          ^^^^^^^^      ^^^^^^^                ^^^^^^^^^^^^
      //                          1:protocol       3:hostname     4:port                 5:path + query string
      //                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
      //                                          2:host
      if (!match || (match[2].indexOf('.') === -1 && match[2].indexOf(':') === -1)) {
        if (match && match[2] === 'iscorsneeded') {
          // Is CORS needed? This path is provided so that API consumers can test whether it's necessary
          // to use CORS. The server's reply is always No, because if they can read it, then CORS headers
          // are not necessary.
          res.writeHead(200, {'Content-Type': 'text/plain'});
          res.end('no');
        } else {
          // Incorrect usage. Show how to do it correctly.
          showUsage(cors_headers, res);
        }
        return;
      } else if (match[4] > 65535) {
        // Port is higher than 65535
        res.writeHead(400, 'Invalid port', cors_headers);
        res.end('Invalid port: ' + match[4]);
        return;
      } else if ( hasNoContent(match[3]) ) {
        // Don't even try to proxy invalid hosts (such as /favicon.ico, /robots.txt)
        res.writeHead(404, 'Invalid host', cors_headers);
        res.end('Invalid host: ' + match[3]);
        return;
      } else if (!hasRequiredHeaders(req.headers)) {
        res.writeHead(400, 'Header required', cors_headers);
        res.end('Missing required request header. Must specify one of: ' + corsAnywhere.requireHeader);
        return;
      } else {
        full_url = match[0].substr(1);
        isHttps = (match[1] && match[1].toLowerCase()) === 'https:';
        host = match[2];
        hostname = match[3];
        // Read port from input:  :<port>  /  443 if https  /  80 by default
        port = match[4] ? +match[4] : (isHttps ? 443 : 80);
        path = match[5];

        if (!match[1]) {
          if (full_url.charAt(0) !== '/') full_url = '//' + full_url;
          full_url = (port === 443 ? 'https:' : 'http:') + full_url;
        }
      }
      // Change the requested path:
      req.url = path;

      var isRequestedOverHttps = req.connection.encrypted || /^\s*https/.test(req.headers['x-forwarded-proto']);

      corsAnywhere.removeHeaders.forEach(function(header) {
        delete req.headers[header];
      });

      proxyRequest(req, res, proxy, full_url, isRequestedOverHttps, {
        host: hostname,
        port: port,
        target: {
            https: isHttps
        }
      });
    }
  };
};

// Create server with default and given values
// Creator still needs to call .listen()
var createServer = exports.createServer = function(options) {
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
    res.writeHead(404, {});
    res.end();
  });

  return server;
};
