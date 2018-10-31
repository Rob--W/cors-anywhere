/* eslint-env mocha */
require('./setup');

var createServer = require('../').createServer;
var request = require('supertest');
var path = require('path');
var http = require('http');
var fs = require('fs');
var assert = require('assert');

var helpTextPath = path.join(__dirname, '../lib/help.txt');
var helpText = fs.readFileSync(helpTextPath, {encoding: 'utf8'});

request.Test.prototype.expectJSON = function(json, done) {
  this.expect(function(res) {
    // Assume that the response can be parsed as JSON (otherwise it throws).
    var actual = JSON.parse(res.text);
    assert.deepEqual(actual, json);
  });
  return done ? this.end(done) : this;
};

request.Test.prototype.expectNoHeader = function(header, done) {
  this.expect(function(res) {
    if (header.toLowerCase() in res.headers) {
      return 'Unexpected header in response: ' + header;
    }
  });
  return done ? this.end(done) : this;
};

var cors_anywhere;
var cors_anywhere_port;
function stopServer(done) {
  cors_anywhere.close(function() {
    done();
  });
  cors_anywhere = null;
}

describe('Basic functionality', function() {
  before(function() {
    cors_anywhere = createServer();
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
  });
  after(stopServer);

  it('GET /', function(done) {
    request(cors_anywhere)
      .get('/')
      .type('text/plain')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, helpText, done);
  });

  it('GET /iscorsneeded', function(done) {
    request(cors_anywhere)
      .get('/iscorsneeded')
      .expectNoHeader('access-control-allow-origin', done);
  });

  it('GET /example.com:65536', function(done) {
    request(cors_anywhere)
      .get('/example.com:65536')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(400, 'Port number too large: 65536', done);
  });

  it('GET /favicon.ico', function(done) {
    request(cors_anywhere)
      .get('/favicon.ico')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(404, 'Invalid host: favicon.ico', done);
  });

  it('GET /robots.txt', function(done) {
    request(cors_anywhere)
      .get('/robots.txt')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(404, 'Invalid host: robots.txt', done);
  });

  it('GET /http://robots.txt should be proxied', function(done) {
    request(cors_anywhere)
      .get('/http://robots.txt')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, 'this is http://robots.txt', done);
  });

  it('GET /example.com', function(done) {
    request(cors_anywhere)
      .get('/example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com/')
      .expect(200, 'Response from example.com', done);
  });

  it('GET /example.com:80', function(done) {
    request(cors_anywhere)
      .get('/example.com:80')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com:80/')
      .expect(200, 'Response from example.com', done);
  });

  it('GET /example.com:443', function(done) {
    request(cors_anywhere)
      .get('/example.com:443')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'https://example.com:443/')
      .expect(200, 'Response from https://example.com', done);
  });

  it('GET //example.com', function(done) {
    // '/example.com' is an invalid URL.
    request(cors_anywhere)
      .get('//example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, helpText, done);
  });

  it('GET ///example.com', function(done) {
    // API base URL (with trailing slash) + '//example.com'
    request(cors_anywhere)
      .get('///example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com/')
      .expect(200, 'Response from example.com', done);
  });

  it('GET /http://example.com', function(done) {
    request(cors_anywhere)
      .get('/http://example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com/')
      .expect(200, 'Response from example.com', done);
  });

  it('POST plain text', function(done) {
    request(cors_anywhere)
      .post('/example.com/echopost')
      .send('{"this is a request body & should not be mangled":1.00}')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('{"this is a request body & should not be mangled":1.00}', done);
  });

  it('POST file', function(done) {
    request(cors_anywhere)
      .post('/example.com/echopost')
      .attach('file', path.join(__dirname, 'dummy.txt'))
      .expect('Access-Control-Allow-Origin', '*')
      .expect(/\r\nContent-Disposition: form-data; name="file"; filename="dummy.txt"\r\nContent-Type: text\/plain\r\n\r\ndummy content\n\r\n/, done); // eslint-disable-line max-len
  });

  it('HEAD with redirect should be followed', function(done) {
    // Redirects are automatically followed, because redirects are to be
    // followed automatically per specification regardless of the HTTP verb.
    request(cors_anywhere)
      .head('/example.com/redirect')
      .redirects(0)
      .expect('Access-Control-Allow-Origin', '*')
      .expect('some-header', 'value')
      .expect('x-request-url', 'http://example.com/redirect')
      .expect('x-cors-redirect-1', '302 http://example.com/redirecttarget')
      .expect('x-final-url', 'http://example.com/redirecttarget')
      .expect('access-control-expose-headers', /some-header,x-final-url/)
      .expectNoHeader('header at redirect')
      .expect(200, undefined, done);
  });

  it('GET with redirect should be followed', function(done) {
    request(cors_anywhere)
      .get('/example.com/redirect')
      .redirects(0)
      .expect('Access-Control-Allow-Origin', '*')
      .expect('some-header', 'value')
      .expect('x-request-url', 'http://example.com/redirect')
      .expect('x-cors-redirect-1', '302 http://example.com/redirecttarget')
      .expect('x-final-url', 'http://example.com/redirecttarget')
      .expect('access-control-expose-headers', /some-header,x-final-url/)
      .expectNoHeader('header at redirect')
      .expect(200, 'redirect target', done);
  });

  it('GET with redirect loop should interrupt', function(done) {
    request(cors_anywhere)
      .get('/example.com/redirectloop')
      .redirects(0)
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com/redirectloop')
      .expect('x-cors-redirect-1', '302 http://example.com/redirectloop')
      .expect('x-cors-redirect-2', '302 http://example.com/redirectloop')
      .expect('x-cors-redirect-3', '302 http://example.com/redirectloop')
      .expect('x-cors-redirect-4', '302 http://example.com/redirectloop')
      .expect('x-cors-redirect-5', '302 http://example.com/redirectloop')
      .expect('Location', /^http:\/\/127.0.0.1:\d+\/http:\/\/example.com\/redirectloop$/)
      .expect(302, 'redirecting ad infinitum...', done);
  });

  it('POST with 302 redirect should be followed', function(done) {
    request(cors_anywhere)
      .post('/example.com/redirectpost')
      .redirects(0)
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com/redirectpost')
      .expect('x-cors-redirect-1', '302 http://example.com/redirectposttarget')
      .expect('x-final-url', 'http://example.com/redirectposttarget')
      .expect('access-control-expose-headers', /x-final-url/)
      .expect(200, 'post target', done);
  });

  it('GET with 302 redirect without Location header should not be followed', function(done) {
    // There is nothing to follow, so let the browser decide what to do with it.
    request(cors_anywhere)
      .get('/example.com/redirectwithoutlocation')
      .redirects(0)
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com/redirectwithoutlocation')
      .expect('x-final-url', 'http://example.com/redirectwithoutlocation')
      .expect('access-control-expose-headers', /x-final-url/)
      .expect(302, 'maybe found', done);
  });

  it('POST with 307 redirect should not be handled', function(done) {
    // Because of implementation difficulties (having to keep the request body
    // in memory), handling HTTP 307/308 redirects is deferred to the requestor.
    request(cors_anywhere)
      .post('/example.com/redirect307')
      .redirects(0)
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com/redirect307')
      .expect('Location', /^http:\/\/127.0.0.1:\d+\/http:\/\/example.com\/redirectposttarget$/)
      .expect('x-final-url', 'http://example.com/redirect307')
      .expect('access-control-expose-headers', /x-final-url/)
      .expect(307, 'redirecting...', done);
  });

  it('OPTIONS /', function(done) {
    request(cors_anywhere)
      .options('/')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, '', done);
  });

  it('OPTIONS / with Access-Control-Request-Method / -Headers', function(done) {
    request(cors_anywhere)
      .options('/')
      .set('Access-Control-Request-Method', 'DELETE')
      .set('Access-Control-Request-Headers', 'X-Tralala')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('Access-Control-Allow-Methods', 'DELETE')
      .expect('Access-Control-Allow-Headers', 'X-Tralala')
      .expect(200, '', done);
  });

  it('OPTIONS //bogus', function(done) {
    // The preflight request always succeeds, regardless of whether the request
    // is valid.
    request(cors_anywhere)
      .options('//bogus')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, '', done);
  });

  it('X-Forwarded-* headers', function(done) {
    request(cors_anywhere)
      .get('/example.com/echoheaders')
      .set('test-include-xfwd', '')
      .expect('Access-Control-Allow-Origin', '*')
      .expectJSON({
        host: 'example.com',
        'x-forwarded-port': String(cors_anywhere_port),
        'x-forwarded-proto': 'http',
      }, done);
  });

  it('X-Forwarded-* headers (non-standard port)', function(done) {
    request(cors_anywhere)
      .get('/example.com:1337/echoheaders')
      .set('test-include-xfwd', '')
      .expect('Access-Control-Allow-Origin', '*')
      .expectJSON({
        host: 'example.com:1337',
        'x-forwarded-port': String(cors_anywhere_port),
        'x-forwarded-proto': 'http',
      }, done);
  });

  it('X-Forwarded-* headers (https)', function(done) {
    request(cors_anywhere)
      .get('/https://example.com/echoheaders')
      .set('test-include-xfwd', '')
      .expect('Access-Control-Allow-Origin', '*')
      .expectJSON({
        host: 'example.com',
        'x-forwarded-port': String(cors_anywhere_port),
        'x-forwarded-proto': 'http',
      }, done);
  });

  it('Ignore cookies', function(done) {
    request(cors_anywhere)
      .get('/example.com/setcookie')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('Set-Cookie3', 'z')
      .expectNoHeader('set-cookie')
      .expectNoHeader('set-cookie2', done);
  });
});

describe('Proxy errors', function() {
  before(function() {
    cors_anywhere = createServer();
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
  });
  after(stopServer);

  var bad_http_server;
  var bad_http_server_url;
  before(function() {
    bad_http_server = http.createServer(function(req, res) {
      res.writeHead(418, {
        'Content-Length': 'Not a digit',
      });
      res.end('This response has an invalid Content-Length header.');
    });
    bad_http_server_url = 'http://127.0.0.1:' + bad_http_server.listen(0).address().port;
  });
  after(function(done) {
    bad_http_server.close(function() {
      done();
    });
  });

  var bad_status_http_server;
  var bad_status_http_server_url;
  before(function() {
    bad_status_http_server = require('net').createServer(function(socket) {
      socket.setEncoding('utf-8');
      socket.on('data', function(data) {
        if (data.indexOf('\r\n') >= 0) {
          // Assume end of headers.
          socket.write('HTTP/1.0 0\r\n');
          socket.write('Content-Length: 0\r\n');
          socket.end('\r\n');
        }
      });
    });
    bad_status_http_server_url = 'http://127.0.0.1:' + bad_status_http_server.listen(0).address().port;
  });
  after(function(done) {
    bad_status_http_server.close(function() {
      done();
    });
  });

  var bad_tcp_server;
  var bad_tcp_server_url;
  before(function() {
    bad_tcp_server = require('net').createServer(function(socket) {
      socket.setEncoding('utf-8');
      socket.on('data', function(data) {
        if (data.indexOf('\r\n') >= 0) {
          // Assume end of headers.
          socket.write('HTTP/1.1 418 OK\r\n');
          socket.write('Transfer-Encoding: chunked\r\n');
          socket.write('\r\n');
          socket.end('JK I lied, this is NOT a chunked response!');
        }
      });
    });
    bad_tcp_server_url = 'http://127.0.0.1:' + bad_tcp_server.listen(0).address().port;
  });
  after(function(done) {
    bad_tcp_server.close(function() {
      done();
    });
  });

  it('Proxy error', function(done) {
    request(cors_anywhere)
      .get('/example.com/proxyerror')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(404, 'Not found because of proxy error: Error: throw node', done);
  });

  it('Content-Length mismatch', function(done) {
    request(cors_anywhere)
      .get('/' + bad_http_server_url)
      .expect('Access-Control-Allow-Origin', '*')
      .expect(404, 'Not found because of proxy error: Error: Parse Error', done);
  });

  it('Invalid HTTP status code', function(done) {
    // Strict HTTP status validation was introduced in Node 4.5.5+, 5.11.0+.
    // https://github.com/nodejs/node/pull/6291
    var nodev = process.versions.node.split('.').map(function(v) { return parseInt(v); });
    if (nodev[0] < 4 ||
        nodev[0] === 4 && nodev[1] < 5 ||
        nodev[0] === 4 && nodev[1] === 5 && nodev[2] < 5 ||
        nodev[0] === 5 && nodev[1] < 11) {
      this.skip();
    }

    var errorMessage = 'RangeError [ERR_HTTP_INVALID_STATUS_CODE]: Invalid status code: 0';
    if (parseInt(process.versions.node, 10) < 9) {
      errorMessage = 'RangeError: Invalid status code: 0';
    }
    request(cors_anywhere)
      .get('/' + bad_status_http_server_url)
      .expect('Access-Control-Allow-Origin', '*')
      .expect(404, 'Not found because of proxy error: ' + errorMessage, done);
  });

  it('Content-Encoding invalid body', function(done) {
    // The HTTP status can't be changed because the headers have already been
    // sent.
    request(cors_anywhere)
      .get('/' + bad_tcp_server_url)
      .expect('Access-Control-Allow-Origin', '*')
      .expect(418, '', done);
  });

  it('Invalid header values', function(done) {
    if (parseInt(process.versions.node, 10) < 6) {
      // >=6.0.0: https://github.com/nodejs/node/commit/7bef1b790727430cb82bf8be80cfe058480de100
      this.skip();
    }
    // >=9.0.0: https://github.com/nodejs/node/commit/11a2ca29babcb35132e7d93244b69c544d52dfe4
    var errorMessage = 'TypeError [ERR_INVALID_CHAR]: Invalid character in header content ["headername"]';
    if (parseInt(process.versions.node, 10) < 9) {
      // >=6.0.0, <9.0.0: https://github.com/nodejs/node/commit/7bef1b790727430cb82bf8be80cfe058480de100
      errorMessage = 'TypeError: The header content contains invalid characters';
    }
    stopServer(function() {
      cors_anywhere = createServer({
        // Setting an invalid header below in request(...).set(...) would trigger
        // a header validation error in superagent. So we use setHeaders to test
        // the attempt to proxy a request with invalid request headers.
        setHeaders: {headername: 'invalid\x01value'},
      });
      cors_anywhere_port = cors_anywhere.listen(0).address().port;
      request(cors_anywhere)
        .get('/' + bad_tcp_server_url) // Any URL that isn't intercepted by Nock would do.
        .expect('Access-Control-Allow-Origin', '*')
        .expect(404, 'Not found because of proxy error: ' + errorMessage, done);
    });
  });
});

describe('server on https', function() {
  var NODE_TLS_REJECT_UNAUTHORIZED;
  before(function() {
    cors_anywhere = createServer({
      httpsOptions: {
        key: fs.readFileSync(path.join(__dirname, 'key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
      },
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
    // Disable certificate validation in case the certificate expires.
    NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  });
  after(function(done) {
    if (NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = NODE_TLS_REJECT_UNAUTHORIZED;
    }
    stopServer(done);
  });

  it('X-Forwarded-* headers (http)', function(done) {
    request(cors_anywhere)
      .get('/example.com/echoheaders')
      .set('test-include-xfwd', '')
      .expect('Access-Control-Allow-Origin', '*')
      .expectJSON({
        host: 'example.com',
        'x-forwarded-port': String(cors_anywhere_port),
        'x-forwarded-proto': 'https',
      }, done);
  });

  it('X-Forwarded-* headers (https)', function(done) {
    request(cors_anywhere)
      .get('/https://example.com/echoheaders')
      .set('test-include-xfwd', '')
      .expect('Access-Control-Allow-Origin', '*')
      .expectJSON({
        host: 'example.com',
        'x-forwarded-port': String(cors_anywhere_port),
        'x-forwarded-proto': 'https',
      }, done);
  });

  it('X-Forwarded-* headers (https, non-standard port)', function(done) {
    request(cors_anywhere)
      .get('/https://example.com:1337/echoheaders')
      .set('test-include-xfwd', '')
      .expect('Access-Control-Allow-Origin', '*')
      .expectJSON({
        host: 'example.com:1337',
        'x-forwarded-port': String(cors_anywhere_port),
        'x-forwarded-proto': 'https',
      }, done);
  });
});

describe('originBlacklist', function() {
  before(function() {
    cors_anywhere = createServer({
      originBlacklist: ['http://denied.origin.test'],
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
  });
  after(stopServer);

  it('GET /example.com with denied origin', function(done) {
    request(cors_anywhere)
      .get('/example.com/')
      .set('Origin', 'http://denied.origin.test')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(403, done);
  });

  it('GET /example.com without denied origin', function(done) {
    request(cors_anywhere)
      .get('/example.com/')
      .set('Origin', 'https://denied.origin.test') // Note: different scheme!
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, done);
  });

  it('GET /example.com without origin', function(done) {
    request(cors_anywhere)
      .get('/example.com/')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, done);
  });
});

describe('originWhitelist', function() {
  before(function() {
    cors_anywhere = createServer({
      originWhitelist: ['https://permitted.origin.test'],
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
  });
  after(stopServer);

  it('GET /example.com with permitted origin', function(done) {
    request(cors_anywhere)
      .get('/example.com/')
      .set('Origin', 'https://permitted.origin.test')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, done);
  });

  it('GET /example.com without permitted origin', function(done) {
    request(cors_anywhere)
      .get('/example.com/')
      .set('Origin', 'http://permitted.origin.test') // Note: different scheme!
      .expect('Access-Control-Allow-Origin', '*')
      .expect(403, done);
  });

  it('GET /example.com without origin', function(done) {
    request(cors_anywhere)
      .get('/example.com/')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(403, done);
  });
});

describe('checkRateLimit', function() {
  afterEach(stopServer);

  it('GET /example.com without rate-limit', function(done) {
    cors_anywhere = createServer({
      checkRateLimit: function() {},
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
    request(cors_anywhere)
      .get('/example.com/')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, done);
  });

  it('GET /example.com with rate-limit', function(done) {
    cors_anywhere = createServer({
      checkRateLimit: function(origin) {
        // Non-empty value. Let's return the origin parameter so that we also verify that the
        // the parameter is really the origin.
        return '[' + origin + ']';
      },
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
    request(cors_anywhere)
      .get('/example.com/')
      .set('Origin', 'http://example.net:1234')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(429, done,
          'The origin "http://example.net" has sent too many requests.\n[http://example.com:1234]');
  });
});

describe('redirectSameOrigin', function() {
  before(function() {
    cors_anywhere = createServer({
      redirectSameOrigin: true,
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
  });
  after(stopServer);

  it('GET /example.com with Origin: http://example.com', function(done) {
    request(cors_anywhere)
      .get('/example.com/')
      .set('Origin', 'http://example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('Cache-Control', 'private')
      .expect('Vary', 'origin')
      .expect('Location', 'http://example.com/')
      .expect(301, done);
  });

  it('GET /example.com with Origin: https://example.com', function(done) {
    // Not same-origin because of different schemes.
    request(cors_anywhere)
      .get('/example.com/')
      .set('Origin', 'https://example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, 'Response from example.com', done);
  });

  it('GET /example.com with Origin: http://example.com:1234', function(done) {
    // Not same-origin because of different ports.
    request(cors_anywhere)
      .get('/example.com/')
      .set('Origin', 'http://example.com:1234')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, 'Response from example.com', done);
  });

  it('GET /example.com:1234 with Origin: http://example.com', function(done) {
    // Not same-origin because of different ports.
    request(cors_anywhere)
      .get('/example.com:1234/')
      .set('Origin', 'http://example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, 'Response from example.com:1234', done);
  });

  it('GET /example.com with Origin: http://example.com.test', function(done) {
    // Not same-origin because of different host names.
    request(cors_anywhere)
      .get('/example.com/')
      .set('Origin', 'http://example.com.test')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, 'Response from example.com', done);
  });

  it('GET /example.com.com with Origin: http://example.com', function(done) {
    // Not same-origin because of different host names.
    request(cors_anywhere)
      .get('/example.com.com/')
      .set('Origin', 'http://example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, 'Response from example.com.com', done);
  });

  it('GET /prefix.example.com with Origin: http://example.com', function(done) {
    // Not same-origin because of different host names.
    request(cors_anywhere)
      .get('/prefix.example.com/')
      .set('Origin', 'http://example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, 'Response from prefix.example.com', done);
  });
});

describe('requireHeader', function() {
  before(function() {
    cors_anywhere = createServer({
      requireHeader: ['origin', 'x-requested-with'],
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
  });
  after(stopServer);

  it('GET /example.com without header', function(done) {
    request(cors_anywhere)
      .get('/example.com/')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(400, 'Missing required request header. Must specify one of: origin,x-requested-with', done);
  });

  it('GET /example.com with X-Requested-With header', function(done) {
    request(cors_anywhere)
      .get('/example.com/')
      .set('X-Requested-With', '')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, done);
  });

  it('GET /example.com with Origin header', function(done) {
    request(cors_anywhere)
      .get('/example.com/')
      .set('Origin', 'null')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, done);
  });

  it('GET /example.com without header (requireHeader as string)', function(done) {
    stopServer(function() {
      cors_anywhere = createServer({
        requireHeader: 'origin',
      });
      cors_anywhere_port = cors_anywhere.listen(0).address().port;
      request(cors_anywhere)
        .get('/example.com/')
        .expect('Access-Control-Allow-Origin', '*')
        .expect(400, 'Missing required request header. Must specify one of: origin', done);
    });
  });

  it('GET /example.com with header (requireHeader as string)', function(done) {
    stopServer(function() {
      cors_anywhere = createServer({
        requireHeader: 'origin',
      });
      cors_anywhere_port = cors_anywhere.listen(0).address().port;
      request(cors_anywhere)
        .get('/example.com/')
        .set('Origin', 'null')
        .expect('Access-Control-Allow-Origin', '*')
        .expect(200, 'Response from example.com', done);
    });
  });

  it('GET /example.com without header (requireHeader as string, uppercase)', function(done) {
    stopServer(function() {
      cors_anywhere = createServer({
        requireHeader: 'ORIGIN',
      });
      cors_anywhere_port = cors_anywhere.listen(0).address().port;
      request(cors_anywhere)
        .get('/example.com/')
        .expect('Access-Control-Allow-Origin', '*')
        .expect(400, 'Missing required request header. Must specify one of: origin', done);
    });
  });

  it('GET /example.com with header (requireHeader as string, uppercase)', function(done) {
    stopServer(function() {
      cors_anywhere = createServer({
        requireHeader: 'ORIGIN',
      });
      cors_anywhere_port = cors_anywhere.listen(0).address().port;
      request(cors_anywhere)
        .get('/example.com/')
        .set('Origin', 'null')
        .expect('Access-Control-Allow-Origin', '*')
        .expect(200, 'Response from example.com', done);
    });
  });

  it('GET /example.com (requireHeader is an empty array)', function(done) {
    stopServer(function() {
      cors_anywhere = createServer({
        requireHeader: [],
      });
      cors_anywhere_port = cors_anywhere.listen(0).address().port;
      request(cors_anywhere)
        .get('/example.com/')
        .expect('Access-Control-Allow-Origin', '*')
        .expect(200, 'Response from example.com', done);
    });
  });
});

describe('removeHeaders', function() {
  before(function() {
    cors_anywhere = createServer({
      removeHeaders: ['cookie', 'cookie2'],
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
  });
  after(stopServer);

  it('GET /example.com with request cookie', function(done) {
    request(cors_anywhere)
      .get('/example.com/echoheaders')
      .set('cookie', 'a')
      .set('cookie2', 'b')
      .expect('Access-Control-Allow-Origin', '*')
      .expectJSON({
        host: 'example.com',
      }, done);
  });

  it('GET /example.com with unknown header', function(done) {
    request(cors_anywhere)
      .get('/example.com/echoheaders')
      .set('cookie', 'a')
      .set('cookie2', 'b')
      .set('cookie3', 'c')
      .expect('Access-Control-Allow-Origin', '*')
      .expectJSON({
        host: 'example.com',
        cookie3: 'c',
      }, done);
  });
});

describe('setHeaders', function() {
  before(function() {
    cors_anywhere = createServer({
      setHeaders: {'x-powered-by': 'CORS Anywhere'},
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
  });
  after(stopServer);

  it('GET /example.com', function(done) {
    request(cors_anywhere)
      .get('/example.com/echoheaders')
      .expect('Access-Control-Allow-Origin', '*')
      .expectJSON({
        host: 'example.com',
        'x-powered-by': 'CORS Anywhere',
      }, done);
  });

  it('GET /example.com should replace header', function(done) {
    request(cors_anywhere)
      .get('/example.com/echoheaders')
      .set('x-powered-by', 'should be replaced')
      .expect('Access-Control-Allow-Origin', '*')
      .expectJSON({
        host: 'example.com',
        'x-powered-by': 'CORS Anywhere',
      }, done);
  });
});

describe('setHeaders + removeHeaders', function() {
  before(function() {
    // setHeaders takes precedence over removeHeaders
    cors_anywhere = createServer({
      removeHeaders: ['x-powered-by'],
      setHeaders: {'x-powered-by': 'CORS Anywhere'},
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
  });
  after(stopServer);

  it('GET /example.com', function(done) {
    request(cors_anywhere)
      .get('/example.com/echoheaders')
      .expect('Access-Control-Allow-Origin', '*')
      .expectJSON({
        host: 'example.com',
        'x-powered-by': 'CORS Anywhere',
      }, done);
  });

  it('GET /example.com should replace header', function(done) {
    request(cors_anywhere)
      .get('/example.com/echoheaders')
      .set('x-powered-by', 'should be replaced')
      .expect('Access-Control-Allow-Origin', '*')
      .expectJSON({
        host: 'example.com',
        'x-powered-by': 'CORS Anywhere',
      }, done);
  });
});

describe('Access-Control-Max-Age set', function() {
  before(function() {
    cors_anywhere = createServer({
      corsMaxAge: 600,
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
  });
  after(stopServer);

  it('GET /', function(done) {
    request(cors_anywhere)
      .get('/')
      .type('text/plain')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('Access-Control-Max-Age', '600')
      .expect(200, helpText, done);
  });

  it('GET /example.com', function(done) {
    request(cors_anywhere)
      .get('/example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('Access-Control-Max-Age', '600')
      .expect(200, 'Response from example.com', done);
  });
});

describe('Access-Control-Max-Age not set', function() {
  before(function() {
    cors_anywhere = createServer();
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
  });
  after(stopServer);

  it('GET /', function(done) {
    request(cors_anywhere)
      .get('/')
      .type('text/plain')
      .expect('Access-Control-Allow-Origin', '*')
      .expectNoHeader('Access-Control-Max-Age')
      .expect(200, helpText, done);
  });

  it('GET /example.com', function(done) {
    request(cors_anywhere)
      .get('/example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expectNoHeader('Access-Control-Max-Age')
      .expect(200, 'Response from example.com', done);
  });
});

describe('httpProxyOptions.xfwd=false', function() {
  before(function() {
    cors_anywhere = createServer({
      httpProxyOptions: {
        xfwd: false,
      },
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
  });
  after(stopServer);

  it('X-Forwarded-* headers should not be set', function(done) {
    request(cors_anywhere)
      .get('/example.com/echoheaders')
      .set('test-include-xfwd', '')
      .expect('Access-Control-Allow-Origin', '*')
      .expectJSON({
        host: 'example.com',
      }, done);
  });
});

describe('httpProxyOptions.getProxyForUrl', function() {
  var proxy_server;
  var proxy_url;
  before(function() {
    // Using a real server instead of a mock because Nock doesn't can't mock proxies.
    proxy_server = http.createServer(function(req, res) {
      res.end(req.method + ' ' + req.url + ' Host=' + req.headers.host);
    });
    proxy_url = 'http://127.0.0.1:' + proxy_server.listen(0).address().port;

    cors_anywhere = createServer({
      httpProxyOptions: {
        xfwd: false,
      },
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;
  });
  afterEach(function() {
    // Assuming that they were not set before.
    delete process.env.https_proxy;
    delete process.env.http_proxy;
    delete process.env.no_proxy;
  });
  after(function(done) {
    proxy_server.close(function() {
      done();
    });
  });
  after(stopServer);

  it('http_proxy should be respected for matching domains', function(done) {
    process.env.http_proxy = proxy_url;

    request(cors_anywhere)
      .get('/http://example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, 'GET http://example.com/ Host=example.com', done);
  });

  it('http_proxy should be ignored for http URLs', function(done) {
    process.env.http_proxy = proxy_url;
    request(cors_anywhere)
      .get('/https://example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, 'Response from https://example.com', done);
  });

  it('https_proxy should be respected for matching domains', function(done) {
    process.env.https_proxy = proxy_url;

    request(cors_anywhere)
      .get('/https://example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, 'GET https://example.com/ Host=example.com', done);
  });

  it('https_proxy should be ignored for http URLs', function(done) {
    process.env.https_proxy = proxy_url;
    request(cors_anywhere)
      .get('/http://example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, 'Response from example.com', done);
  });

  it('https_proxy + no_proxy should not intercept requests in no_proxy', function(done) {
    process.env.https_proxy = proxy_url;
    process.env.no_proxy = 'example.com:443';
    request(cors_anywhere)
      .get('/https://example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, 'Response from https://example.com', done);
  });
});

describe('helpFile', function() {

  afterEach(stopServer);

  it('GET / with custom text helpFile', function(done) {
    var customHelpTextPath = path.join(__dirname, './customHelp.txt');
    var customHelpText = fs.readFileSync(customHelpTextPath, {encoding: 'utf8'});

    cors_anywhere = createServer({
      helpFile: customHelpTextPath,
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;

    request(cors_anywhere)
      .get('/')
      .type('text/plain')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, customHelpText, done);
  });

  it('GET / with custom HTML helpFile', function(done) {
    var customHelpTextPath = path.join(__dirname, './customHelp.html');
    var customHelpText = fs.readFileSync(customHelpTextPath, {encoding: 'utf8'});

    cors_anywhere = createServer({
      helpFile: customHelpTextPath,
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;

    request(cors_anywhere)
      .get('/')
      .type('text/html')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(200, customHelpText, done);
  });

  it('GET / with non-existent help file', function(done) {
    var customHelpTextPath = path.join(__dirname, 'Some non-existing file.');

    cors_anywhere = createServer({
      helpFile: customHelpTextPath,
    });
    cors_anywhere_port = cors_anywhere.listen(0).address().port;

    request(cors_anywhere)
      .get('/')
      .type('text/plain')
      .expect('Access-Control-Allow-Origin', '*')
      .expect(500, '', done);
  });
});
