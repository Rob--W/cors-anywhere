// © 2013 Rob W <gwnRob@gmail.com>
// Released under the MIT license

var httpProxy = require('http-proxy');
var net = require('net');
var regexp_tld = require('./regexp-top-level-domain');

var help_file = __dirname + '/help.txt';
var help_text;
function showUsage(res) {
  if (help_text != null) {
    res.writeHead(200, {'content-type': 'text/plain'});
    res.end(help_text);
  } else {
    require('fs').readFile(help_file, 'utf8', function(err, data) {
      if (err) {
        console.error(err);
        res.writeHead(500, {});
        res.end();
      } else {
        help_text = data;
        showUsage(res); // Recursive call, but since data is a string, the recursion will end
      }
    });
  }
}

function hasNoContent(hostname) {
  // Show 404 for non-requests. For instance when hostname is favicon.ico, robots.txt, ...
  return !(
    regexp_tld.test(hostname) ||
    net.isIPv4(hostname) ||
    net.isIPv6(hostname)
  );
}

function handleCookies(isAllowed, headers) {
    // Assumed that all headers' names are lowercase
    if (!isAllowed) {
        delete headers['set-cookie'];
        delete headers['set-cookie2'];
        return;
    }
    // TODO: Parse cookies, and change Domain and Secure flag to match the API domain,
    //       and change Path to /<website>/....
    //if (headers['set-cookie']) headers['set-cookie'] = _parseCookie(headers['set-cookie']);
    //if (headers['set-cookie2']) headers['set-cookie2'] = _parseCookie(headers['set-cookie']);
}

// Called on every request
var handler = exports.handler = function(req, res, proxy) {

  var cors_headers = {
    'access-control-allow-origin': req.headers.origin || '*'
  };
  if (proxy.withCredentials) {
    // Allow sending of credentials ONLY if it's explicitly allowed on creation of the proxy.
    cors_headers['access-control-allow-credentials'] = 'true';
  }
  if (req.headers['access-control-request-method']) {
    cors_headers['access-control-allow-methods'] = req.headers['access-control-request-method'];
  }
  if (req.headers['access-control-request-headers']) {
    cors_headers['access-control-allow-headers'] = req.headers['access-control-request-headers'];
  }
  
  if (req.method == 'OPTIONS') {
    // Pre-flight request. Reply successfully:
    res.writeHead(200, cors_headers);
    res.end();
    return;
  } else {
    // Actual request. First, extract the desired URL from the request:
    var host, hostname, port, path, match;
    match = req.url.match(/^\/(?:(https?:)?\/\/)?(([^\/?]+?)(?::(\d{0,5})(?=[\/?]|$))?)([\/?][\S\s]*|$)/i);
    //                            ^^^^^^^          ^^^^^^^^      ^^^^^^^                ^^^^^^^^^^^^
    //                          1:protocol       3:hostname     4:port                 5:path + query string
    //                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //                                          2:host
    if (!match || (match[2].indexOf('.') === -1 && match[2].indexOf(':') === -1) || match[4] > 65535) {
      // Incorrect usage. Show how to do it correctly.
      showUsage(res);
      return;
    } else if (match[2] === 'iscorsneeded') {
      // Is CORS needed? This path is provided so that API consumers can test whether it's necessary
      // to use CORS. The server's reply is always No, because if they can read it, then CORS headers
      // are not necessary.
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('no');
      return;
    } else if (match[4] > 65535) {
      // Port is higher than 65535
      res.writeHead(400, 'Invalid port', cors_headers);
      res.end();
      return;
    } else if ( hasNoContent(match[3]) ) {
      // Don't even try to proxy invalid hosts
      res.writeHead(404, cors_headers);
      res.end();
      return;
    } else {
      host = match[2];
      hostname = match[3];
      // Read port from input:  :<port>  /  443 if https  /  80 by default
      port = match[4] ? +match[4] : (match[1] && match[1].toLowerCase() === 'https:' ? 443 : 80);
      path = match[5];
    }
    // Change the requested path:
    req.url = path;
    
    // Hook res.writeHead method to set the correct header
    var res_writeHead = res.writeHead;
    res.writeHead = function(statusCode, reasonPhrase, headers) {
      if (typeof reasonPhrase === 'object') {
        headers = reasonPhrase;
      }
      if (!headers) headers = cors_headers;
      else {
        var header;
        for (header in cors_headers) {
          // We define the cors_headers object, so we can be damn sure that hasOwnProperty is not a key of it.
          // and therefor we can use hOP directly instead of Object.prototype.hOP.call(...)
          if (cors_headers.hasOwnProperty(header)) {
            headers[header] = cors_headers[header];
          }
        }

        if ((statusCode === 301 || statusCode === 302) && headers.location) {
            // Handle redirects
            // The X-Forwarded-Proto header is set by Heroku, and also by the http-proxy library when xforward is true)
            var proxy_base_url = (req.headers['x-forwarded-proto'] || 'http') + '://' + req.headers['host'];
            headers.location = proxy_base_url + '/' + headers.location;
        }
        handleCookies(proxy.withCredentials, headers);
      }
      return res_writeHead.apply(this, arguments); // headers are magically updated when variables are modified
    };
    
    // Finally, proxy the request
    proxy.proxyRequest(req, res, {
      host: hostname,
      port: port
    });
  }
};

// Create server with default/recommended values
// Creator still needs to call .listen()
var createServer = exports.createServer = function() {
  if (arguments.length) {
    console.log('Warning: corsproxy.createServer ignores all arguments.');
  }
  var options = {
    changeOrigin: true,
    xforward: true
  };
  var server = httpProxy.createServer(options, handler);
  // When the server fails, just show a 404 instead of Internal server error
  server.proxy.on('proxyError', function(err, req, res) {
    res.writeHead(404, {});
    res.end();
  });
  // Disable Cookies etc. If you want to enable cookies, please implement a cookie parser which
  // correctly uses the Path flag to separate cookies.
  server.proxy.withCredentials = false;
  return server;
};
