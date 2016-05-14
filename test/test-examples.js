/**
 * CORS Anywhere is designed for use as a standalone server. Sometimes you want
 * to have extra functionality on top of the default CORS server. If it may be
 * useful to others, please open a feature request on the issue tracker at
 * https://github.com/Rob--W/cors-anywhere/issues.
 *
 * If it is only useful to your application, look below for some examples.
 * These examples are provided as-is without guarantees. Use at your own risk.
 */

/* eslint-env mocha */
require('./setup');

var createServer = require('../').createServer;
var assert = require('assert');
var request = require('supertest');

var http = require('http');

describe('Examples', function() {
  // Note: In the examples below we don't listen on any port after calling
  // createServer() because it is not needed to start listening on a port if the
  // CORS Anywhere is only used internally.

  // And normally you have to listen on some port, like this:
  //
  //     http_server.listen(port_number);
  //
  // But in these test, the call to request() automatically handles that part so
  // the examples don't have an explicit .listen() call.

  it('Rewrite proxy URL', function(done) {
    var cors_anywhere = createServer();

    var http_server = http.createServer(function(req, res) {
      // For testing, check whether req.url is the same as what we input below.
      assert.strictEqual(req.url, '/dummy-for-testing');

      // Basic example: Always proxy example.com.
      req.url = '/http://example.com';

      cors_anywhere.emit('request', req, res);
    });

    request(http_server)
      .get('/dummy-for-testing')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com/')
      .expect(200, 'Response from example.com', done);
  });

  it('Transform response to uppercase (streaming)', function(done) {
    var cors_anywhere = createServer();

    var http_server = http.createServer(function(req, res) {
      var originalWrite = res.write;

      res.write = function(data, encoding, callback) {
        if (Buffer.isBuffer(data)) {
          data = data.toString();
        }

        assert.strictEqual(typeof data, 'string');

        // This example shows how to transform the response to upper case.
        data = data.toUpperCase();

        originalWrite.call(this, data, encoding, callback);
      };

      cors_anywhere.emit('request', req, res);
    });

    request(http_server)
      .get('/example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com/')
      .expect(200, 'RESPONSE FROM EXAMPLE.COM', done);
  });

  it('Transform response to uppercase (buffered)', function(done) {
    var cors_anywhere = createServer();

    var http_server = http.createServer(function(req, res) {
      var originalWrite = res.write;
      var originalEnd = res.end;

      var buffers = [];

      res.write = function(data, encoding, callback) {
        assert.ok(Buffer.isBuffer(data) || typeof data === 'string');

        buffers.push(data);
        if (callback) {
          process.nextTick(callback, null);
        }
      };
      res.end = function(data, encoding, callback) {
        if (data) {
          this.write(data, encoding);
        }

        // After calling .end(), .write shouldn't be called any more. So let's
        // restore it so that the default error handling for writing to closed
        // streams would occur.
        this.write = originalWrite;

        // Combine all chunks. Note that we're assuming that all chunks are
        // utf8 strings or buffers whose content is utf8-encoded. If this
        // assumption is not true, then you have to update the .write method
        // above.
        data = buffers.join('');

        // This example shows how to transform the response to upper case.
        data = data.toUpperCase();

        // .end should be called once, so let's restore it so that any default
        // error handling occurs if it occurs again.
        this.end = originalEnd;
        this.end(data, 'utf8', callback);
      };

      cors_anywhere.emit('request', req, res);
    });

    request(http_server)
      .get('/example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com/')
      .expect(200, 'RESPONSE FROM EXAMPLE.COM', done);
  });
});

