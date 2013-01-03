var host = '127.0.0.1';
var port = 8080;

var cors_proxy = require("./lib/cors-anywhere");
cors_proxy.createServer({
    requireHeader: 'x-requested-with',
    withCredentials: false,
    removeHeaders: ['cookie', 'cookie2']
}).listen(port, host, function() {
    console.log('Running CORS Anywhere on ' + host + ':' + port);
});
