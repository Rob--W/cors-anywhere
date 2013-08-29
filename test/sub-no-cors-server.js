// jshint node:true
'use strict';

var host = process.argv[2];
var port = process.argv[3];
console.log('Trying to start redirect server on ' + host + ':' + port + '...');

process.on('disconnect', function() {
    console.log('Stopping redirect server at ' + host + ':' + port + '...\n');
    process.exit();
});

var regex = /^\/(\d+)(.*)/;
require('http').createServer(function(req, res) {
    // Don't use console.log, because the number of newlines would be too much.
    process.stdout.write(req.url + ' ');
    // Redirect a few times. E.g. /3 -> /2 -> /1 -> /0
    // Preserve any suffix (for cache breaking)
    var path = regex.exec(req.url);
    var count = path && +path[1];
    if (count > 0) {
        res.writeHead(302, { location: '/' + (count - 1) + path[2] });
        res.end();
    } else {
        res.writeHead(200, { 'whatever':'header', 'Set-Cookie': 'test=1; path=/' });
        res.end('Ok');
    }
}).listen(port, host, function() {
    console.log('Started redirect server at ' + host + ':' + port + '\n');
    process.send('ready');
});
