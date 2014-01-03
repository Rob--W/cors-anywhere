#!/usr/bin/env node
// Go to the end of the file to see the declarations of the tests

// jshint node:true, sub:true
'use strict';
var http = require('http');
var assert = require('assert');
var fork = require('child_process').fork;
var exec = require('child_process').exec;

var host = '127.0.0.1';
// CORS Anywhere API endpoint
var port = 11400;
var cors_api_url = 'http://' + host + ':' + port + '/';
// Server with redirects
var portServer = 11302;
var no_cors_url = 'http://' + host + ':' + portServer + '/';
// Memleak debugging server
var portLeak = process.env.DEBUG_PORT = 9998;


setupRedirectServer(function() {
    setupCORSServer(function(activateDevtoolsAgent) {
        runTest(function() {
            if (activateDevtoolsAgent) {
                activateDevtoolsAgent();
                suggestLeakTest();
            } else {
                console.log('Leak tests not run.');
                process.exit();
            }
        });
    });
});

/**
 * @param callback {function(activateDevtoolsAgent)} activateDevtoolsAgent is a function
 *  if the devtools agent is available, omitted otherwise.
 */
function setupCORSServer(callback) {
    var child = fork('./sub-server', [host, port], {cwd: __dirname});
    child.on('message', function(message) {
        if (message.hasDevtoolsAgent) {
            callback(function() {
               child.kill('SIGUSR2');
               child = null;
            });
        } else if (message.hasDevtoolsAgent === false) {
            callback();
        } else if (message.action === 'leakTest') {
            runLeakTest(message.parallel, message.requestCount);
        } else {
            console.error('Unexpected message: ', message);
        }
    });
}

function setupRedirectServer(callback) {
    var child = fork('./sub-no-cors-server', [host, portServer], {cwd: __dirname});
    child.once('message', function() {
        callback();
    });
}

//
// Actual tests
//

function runTest(callback) {
    var url = cors_api_url + no_cors_url + '2';
    console.log('Test, GET: ' + url);
    http.get(url, function(res) {
        console.log('');
        assert.equal(res.statusCode, 200, 'HTTP status must be 200');
        console.log('Response headers:', res.headers);
        assert.equal(res.headers['access-control-allow-origin'], '*');
        assert.equal(res.headers['whatever'], 'header', 'Custom header must be passed through.');
        assert.equal(res.headers['x-request-url'], no_cors_url + '2', 'x-request-url should match original URL');
        assert.equal(res.headers['x-final-url'], no_cors_url + '0', 'x-final-url should match the last URL');
        assert(!res.headers['set-cookie'], 'Cookies must be absent');
        assert.equal(res.headers['x-cors-redirect-1'], '302 ' + no_cors_url + '1', 'x-cors-redirect-1 must provide info about redirect');
        assert.equal(res.headers['x-cors-redirect-2'], '302 ' + no_cors_url + '0', 'x-cors-redirect-2 must provide info about redirect');

        callback();
    });
}

function suggestLeakTest() {
    console.log('1. Visit http://c4milo.github.io/node-webkit-agent/26.0.1410.65/inspector.html?host=localhost:' + portLeak + '&page=0');
    console.log('2. Go to the profiles tab, select "Take Heap Snapshot" and click "Start"');
    console.log('3. Go to the JavaScript console, type leakTest() and press Enter');
    console.log('4. When you see "leakTest done" in the console, take another heap snapshot and use the Comparison option.');
}
function runLeakTest(/*boolean*/ parallel, requestCount) {
    requestCount = +requestCount || 100;

    console.log('Sending ' + requestCount + ' requests');

    var initCount = 0;
    var doneCount = 0;

    if (parallel) {
        while (initCount < requestCount) doRequest(); // initCount is incremented in doRequest
    } else {
        doRequest();
    }
    function onComplete(res) {
        if (++doneCount % 10 === 0 || doneCount === requestCount) {
            console.log('done #' + doneCount);
        }
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['access-control-allow-origin'], '*');
        assert.equal(res.headers['whatever'], 'header', 'Custom header must be passed through.');
        if (!parallel && doneCount < requestCount) {
            doRequest();
        }
    }
    function doRequest() {
        http.get({
            agent: false,
            host: host,
            port: port,
            path: '/' + no_cors_url + '1?' + (++initCount) // resource with one redirect
        }, onComplete);
    }
}
