// When this module is loaded, CORS Anywhere is started.
// Then, a request is generated to warm up the server (just in case).
// Then the base URL of CORS Anywhere is sent to the parent process.
// ...
// When the parent process is done, it sends an empty message to this child
// process, which in turn records the change in used heap space.
// The difference in heap space is finally sent back to the parent process.
// ...
// The parent process should then kill this child.

process.on('uncaughtException', function(e) {
  console.error('Uncaught exception in child process: ' + e);
  console.error(e.stack);
  process.exit(-1);
});

// Invoke memoryUsage() without using its result to make sure that any internal
// datastructures that supports memoryUsage() is initialized and won't pollute
// the memory usage measurement later on.
process.memoryUsage();

var heapUsedStart = 0;
function getMemoryUsage(callback) {
  // Note: Requires --expose-gc
  // 6 is the minimum amount of gc() calls before calling gc() again does not
  // reduce memory any more.
  for (var i = 0; i < 6; ++i) {
    global.gc();
  }
  callback(process.memoryUsage().heapUsed);
}

var server;
if (process.argv.indexOf('use-http-instead-of-cors-anywhere') >= 0) {
  server = require('http').createServer(function(req, res) { res.end(); });
} else {
  server = require('../').createServer();
}

server.listen(0, function() {
  // Perform 1 request to warm up.
  require('http').get({
    hostname: '127.0.0.1',
    port: server.address().port,
    path: '/http://invalid:99999',
    agent: false,
  }, function() {
    notifyParent();
  });

  function notifyParent() {
    getMemoryUsage(function(usage) {
      heapUsedStart = usage;
      process.send('http://127.0.0.1:' + server.address().port + '/');
    });
  }
});

process.once('message', function() {
  getMemoryUsage(function(heapUsedEnd) {
    var delta = heapUsedEnd - heapUsedStart;
    process.send(delta);
  });
});
