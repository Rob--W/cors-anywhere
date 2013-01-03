**CORS Anywhere** is a NodeJS proxy which adds CORS headers to the proxied request.

The url to proxy is literally taken from the path, validated and proxied. The protocol
part of the proxied URI is optional, and defaults to "http". If port 443 is specified,
the protocol defaults to "https".

## Example
```javascript
var host = '127.0.0.1';
var port = 8080;

var cors_proxy = require("cors-anywhere");
cors_proxy.createServer().listen(port, host, function() {
    console.log('Running CORS Anywhere on ' + host + ':' + port);
});
```

The package also includes a Procfile, to run the app on Heroku. More information about
Heroku can be found at https://devcenter.heroku.com/articles/nodejs.
