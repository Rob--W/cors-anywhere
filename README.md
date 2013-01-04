**CORS Anywhere** is a NodeJS proxy which adds CORS headers to the proxied request.

The url to proxy is literally taken from the path, validated and proxied. The protocol
part of the proxied URI is optional, and defaults to "http". If port 443 is specified,
the protocol defaults to "https".

This package does not put any restrictions on the http methods or headers, except for
cookies. Requesting [user credentials](http://www.w3.org/TR/cors/#user-credentials) is disallowed.

Redirects are not automatically followed. Instead, the server replies with http status code 333 and
includes an absolute URL in the `Location` response header.

The package also includes a Procfile, to run the app on Heroku. More information about
Heroku can be found at https://devcenter.heroku.com/articles/nodejs.

## Example

```javascript
// Heroku defines the environment variable PORT, and requires the binding address to be 0.0.0.0
var host = process.env.PORT ? '0.0.0.0' : '127.0.0.1';
var port = process.env.PORT || 8080;

var cors_proxy = require("cors-anywhere");
cors_proxy.createServer({
    requireHeader: 'x-requested-with',
    removeHeaders: ['cookie', 'cookie2']
}).listen(port, host, function() {
    console.log('Running CORS Anywhere on ' + host + ':' + port);
});

```
Request examples:

* `http://localhost:8080/http://google.com/` - Google.com with CORS headers
* `http://localhost:8080/google.com` - Same as previous.
* `http://localhost:8080/google.com:443` - Proxies https://google.com/
* `http://localhost:8080/` - Shows usage text, as defined in `libs/help.txt`
* `http://localhost:8080/favicon.ico` - Replies 404 Not found

Live examples:

* http://cors-anywhere.herokuapp.com/
* http://rob.lekensteyn.nl/cors-anywhere.html

## Documentation

The module exports two properties: `getHandler` and `createServer`.

* `getHandler(options)` returns a handler which implements the routing logic.
  This handler is used by [http-proxy](https://github.com/nodejitsu/node-http-proxy).
* `createServer(options)` creates a server with the default handler.

The following options are recognized by both methods:
* string `requireHeader`` - If set, the request must include this header or the API will refuse to proxy.
  Recommended if you want to prevent users from using the proxy for browsing. Example: `X-Requested-With`
* array of lowercase strings `removeHeaders` - Exclude certain headers from being included in the request.
  Example: `["cookie"]`

`createServer` recognizes the following option as well:

* `httpProxyOptions` - Options for http-proxy. The documentation for these options can be found [here](https://github.com/nodejitsu/node-http-proxy#options).


## Dependencies

- NodeJitsu's [http-proxy](https://github.com/nodejitsu/node-http-proxy)


## License

Copyright (C) 2013 Rob W <gwnRob@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
