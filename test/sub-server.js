// jshint node:true
'use strict';

var host = process.argv[2];
var port = process.argv[3];
console.log('Trying to start CORS Anywhere on ' + host + ':' + port + '...');

process.on('disconnect', function() {
    console.log('Stopping CORS Anywhere server at ' + host + ':' + port + '...\n');
    process.exit();
});

require('../lib/cors-anywhere').createServer().listen(port, host, function() {
    console.log('Running CORS Anywhere on ' + host + ':' + port + '\n');
    var hasDevtoolsAgent = false;
    try {
        require('webkit-devtools-agent');
        hasDevtoolsAgent = true;
    } catch (e) {
        console.error('Failed to load webkit-devtools-agent. Memory leak testing is not available');
        console.error('Install it using  npm install webkit-devtools-agent');
    }
    process.send({
        hasDevtoolsAgent: hasDevtoolsAgent
    });
});

global.leakTest = function leakTest(parallel, requestCount) {
    // parallel {boolean} If true, all requests are sent at once.
    //                    If false, the next request is only sent after completing the previous one (default).
    // requestCount {number} Number of requests, defaults to 100
    // All parameters are optional
    process.send({
        action: 'leakTest',
        parallel: parallel,
        requestCount: requestCount
    });
    console.log('Switch to the shell and watch the console for the completion message.');
};
global.leakTestParallel = function leakTestParallel(requestCount) {
    global.leakTest(true, requestCount);
};
