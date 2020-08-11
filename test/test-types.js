/* eslint-env mocha */

var createServer = require('../').createServer;
var assert = require('chai').assert;

describe('Conformity between library and types file', function() {
  it('aligns with types file', function() {
    assert.doesNotThrow(function() {
      createServer();
      createServer({getProxyForUrl: function(str) { return str.toLowerCase(); }});
      createServer({maxRedirects: 5});
      createServer({originBlacklist: ['hello', 'world']});
      createServer({originWhitelist: ['hello', 'world']});
      createServer({checkRateLimit: function(str) { return str.toLowerCase(); }});
      createServer({redirectSameOrigin: false});
      createServer({requireHeader: ['hello', 'world']});
      createServer({removeHeaders: ['hello', 'world']});
      createServer({setHeaders: {'hello': 'world'}});
      createServer({corsMaxAge: 5});
      createServer({helpFile: 'hello'});
      createServer({httpProxyOptions: {}});
      createServer({httpsOptions: {}});
    });
  });
});
