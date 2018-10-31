/* eslint-env mocha */

var createRateLimitChecker = require('../lib/rate-limit');

var lolex = require('lolex');
var assert = require('assert');

function assertNotLimited(rateLimitReturnValue) {
  if (rateLimitReturnValue) {
    assert.fail('Expected no limit, but got ' + rateLimitReturnValue);
  }
}

function assertLimited(rateLimitReturnValue, limit, period) {
  var msg;
  if (period === 1) {
    msg = 'The number of requests is limited to ' + limit + ' per minute. ';
  } else {
    msg = 'The number of requests is limited to ' + limit + ' per ' + period + ' minutes. ';
  }
  msg += 'Please self-host CORS Anywhere if you need more quota. ' +
    'See https://github.com/Rob--W/cors-anywhere#demo-server';
  assert.equal(rateLimitReturnValue, msg);
}

describe('Rate limit', function() {
  var clock;
  beforeEach(function() {
    clock = lolex.install();
  });
  afterEach(function() {
    clock.uninstall();
  });
  it('is unlimited by default', function() {
    var checkRateLimit = createRateLimitChecker();
    assertNotLimited(checkRateLimit('http://example.com'));
    assertNotLimited(checkRateLimit('https://example.com'));
    assertNotLimited(checkRateLimit('https://example.com:1234'));

    checkRateLimit = createRateLimitChecker('');
    assertNotLimited(checkRateLimit('http://example.com'));

    checkRateLimit = createRateLimitChecker(' ');
    assertNotLimited(checkRateLimit('http://example.com'));
  });

  it('zero per minute / 5 minutes', function() {
    var checkRateLimit = createRateLimitChecker('0 1');
    assertLimited(checkRateLimit('http://example.com'), 0, 1);
    assertLimited(checkRateLimit('https://example.com'), 0, 1);

    checkRateLimit = createRateLimitChecker('0 5');
    assertLimited(checkRateLimit('http://example.com'), 0, 5);
    assertLimited(checkRateLimit('https://example.com'), 0, 5);
  });

  it('one per minute', function() {
    var checkRateLimit = createRateLimitChecker('1 1');
    assertNotLimited(checkRateLimit('http://example.com'));
    assertLimited(checkRateLimit('http://example.com'), 1, 1);
    assertNotLimited(checkRateLimit('http://example.com:1234'));
    assertLimited(checkRateLimit('http://example.com:1234'), 1, 1);

    clock.tick(59000);
    assertLimited(checkRateLimit('http://example.com'), 1, 1);

    clock.tick(1000);
    assertNotLimited(checkRateLimit('http://example.com'));
    assertLimited(checkRateLimit('http://example.com'), 1, 1);
    assertNotLimited(checkRateLimit('http://example.com:1234'));
    assertLimited(checkRateLimit('http://example.com:1234'), 1, 1);
  });

  it('different domains, one per minute', function() {
    var checkRateLimit = createRateLimitChecker('1 1');
    assertNotLimited(checkRateLimit('http://example.com'));
    assertNotLimited(checkRateLimit('http://example.net'));
    assertNotLimited(checkRateLimit('http://wexample.net'));
    assertNotLimited(checkRateLimit('http://xample.net'));
    assertNotLimited(checkRateLimit('http://www.example.net'));
    assertLimited(checkRateLimit('http://example.com'), 1, 1);
    assertLimited(checkRateLimit('http://example.net'), 1, 1);
    assertLimited(checkRateLimit('http://wexample.net'), 1, 1);
    assertLimited(checkRateLimit('http://xample.net'), 1, 1);
    assertLimited(checkRateLimit('http://www.example.net'), 1, 1);

    clock.tick(60000); // 1 minute
    assertNotLimited(checkRateLimit('http://example.com'));
    assertNotLimited(checkRateLimit('http://example.net'));
    assertNotLimited(checkRateLimit('http://wexample.net'));
    assertNotLimited(checkRateLimit('http://xample.net'));
    assertNotLimited(checkRateLimit('http://www.example.net'));
  });

  it('unlimited domains, string', function() {
    var checkRateLimit = createRateLimitChecker('1 2 example.com');
    assertNotLimited(checkRateLimit('http://example.com'));
    assertNotLimited(checkRateLimit('http://example.com'));

    assertNotLimited(checkRateLimit('http://wexample.com'));
    assertNotLimited(checkRateLimit('http://xample.com'));
    assertNotLimited(checkRateLimit('http://www.example.com'));
    assertLimited(checkRateLimit('http://wexample.com'), 1, 2);
    assertLimited(checkRateLimit('http://xample.com'), 1, 2);
    assertLimited(checkRateLimit('http://www.example.com'), 1, 2);
  });

  it('unlimited domains, RegExp', function() {
    var checkRateLimit = createRateLimitChecker('1 2 /example\\.com/');
    assertNotLimited(checkRateLimit('http://example.com'));
    assertNotLimited(checkRateLimit('http://example.com'));

    assertNotLimited(checkRateLimit('http://wexample.com'));
    assertNotLimited(checkRateLimit('http://xample.com'));
    assertNotLimited(checkRateLimit('http://www.example.com'));
    assertLimited(checkRateLimit('http://wexample.com'), 1, 2);
    assertLimited(checkRateLimit('http://xample.com'), 1, 2);
    assertLimited(checkRateLimit('http://www.example.com'), 1, 2);
  });

  it('multiple domains, string', function() {
    var checkRateLimit = createRateLimitChecker('1 2 a b  cc ');
    assertNotLimited(checkRateLimit('http://a'));
    assertNotLimited(checkRateLimit('http://a'));
    assertNotLimited(checkRateLimit('http://b'));
    assertNotLimited(checkRateLimit('http://b'));
    assertNotLimited(checkRateLimit('http://cc'));
    assertNotLimited(checkRateLimit('http://cc'));
    assertNotLimited(checkRateLimit('http://c'));
    assertLimited(checkRateLimit('http://c'), 1, 2);
  });

  it('multiple domains, RegExp', function() {
    var checkRateLimit = createRateLimitChecker('1 2 /a/ /b/  /cc/ ');
    assertNotLimited(checkRateLimit('http://a'));
    assertNotLimited(checkRateLimit('http://a'));
    assertNotLimited(checkRateLimit('http://b'));
    assertNotLimited(checkRateLimit('http://b'));
    assertNotLimited(checkRateLimit('http://cc'));
    assertNotLimited(checkRateLimit('http://cc'));
    assertNotLimited(checkRateLimit('http://ccc'));
    assertLimited(checkRateLimit('http://ccc'), 1, 2);
  });

  it('multiple domains, string and RegExp', function() {
    var checkRateLimit = createRateLimitChecker('1 2 a /b/');
    assertNotLimited(checkRateLimit('http://a'));
    assertNotLimited(checkRateLimit('http://a'));
    assertNotLimited(checkRateLimit('http://b'));
    assertNotLimited(checkRateLimit('http://b'));
    assertNotLimited(checkRateLimit('http://ab'));
    assertLimited(checkRateLimit('http://ab'), 1, 2);
  });

  it('multiple domains, RegExp and string', function() {
    var checkRateLimit = createRateLimitChecker('1 2 /a/ b');
    assertNotLimited(checkRateLimit('http://a'));
    assertNotLimited(checkRateLimit('http://a'));
    assertNotLimited(checkRateLimit('http://b'));
    assertNotLimited(checkRateLimit('http://b'));
    assertNotLimited(checkRateLimit('http://ab'));
    assertLimited(checkRateLimit('http://ab'), 1, 2);
  });

  it('wildcard subdomains', function() {
    var checkRateLimit = createRateLimitChecker('0 1 /(.*\\.)?example\\.com/');
    assertNotLimited(checkRateLimit('http://example.com'));
    assertNotLimited(checkRateLimit('http://www.example.com'));
    assertLimited(checkRateLimit('http://xexample.com'), 0, 1);
    assertLimited(checkRateLimit('http://example.com.br'), 0, 1);
  });

  it('wildcard ports', function() {
    var checkRateLimit = createRateLimitChecker('0 1 /example\\.com(:\\d{1,5})?/');
    assertNotLimited(checkRateLimit('http://example.com'));
    assertNotLimited(checkRateLimit('http://example.com:1234'));
  });

  it('empty host', function() {
    var checkRateLimit = createRateLimitChecker('0 1');
    assertLimited(checkRateLimit(''), 0, 1);
    // Empty host actually means empty origin. But let's also test for 'http://'.
    assertLimited(checkRateLimit('http://'), 0, 1);

    checkRateLimit = createRateLimitChecker('0 1    ');
    assertLimited(checkRateLimit(''), 0, 1);
    assertLimited(checkRateLimit('http://'), 0, 1);

    checkRateLimit = createRateLimitChecker('0 1 //');
    assertNotLimited(checkRateLimit(''));
    assertNotLimited(checkRateLimit('http://'));
  });

  it('null origin', function() {
    var checkRateLimit = createRateLimitChecker('0 1');
    assertLimited(checkRateLimit('null'), 0, 1);
    assertLimited(checkRateLimit('http://null'), 0, 1);

    checkRateLimit = createRateLimitChecker('0 1 null');
    assertNotLimited(checkRateLimit('null'));
    assertNotLimited(checkRateLimit('http://null'));

    checkRateLimit = createRateLimitChecker('0 1 /null/');
    assertNotLimited(checkRateLimit('null'));
    assertNotLimited(checkRateLimit('http://null'));
  });

  it('case-insensitive', function() {
    var checkRateLimit = createRateLimitChecker('0 1 NULL');
    assertNotLimited(checkRateLimit('null'));
    assertNotLimited(checkRateLimit('http://null'));

    checkRateLimit = createRateLimitChecker('0 1 /NULL/');
    assertNotLimited(checkRateLimit('null'));
    assertNotLimited(checkRateLimit('http://null'));
  });

  it('bad input', function() {
    assert.throws(function() {
      createRateLimitChecker('0 1 /');
    }, /Invalid CORSANYWHERE_RATELIMIT\. Regex at index 0 must start and end with a slash \("\/"\)\./);

    assert.throws(function() {
      createRateLimitChecker('0 1 a /');
    }, /Invalid CORSANYWHERE_RATELIMIT\. Regex at index 1 must start and end with a slash \("\/"\)\./);

    assert.throws(function() {
      createRateLimitChecker('0 1 /(/');
    }, /Invalid regular expression/);
  });
});
