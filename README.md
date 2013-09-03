**CORS Anywhere** is a NodeJS proxy which adds CORS headers to the proxied request.

The url to proxy is literally taken from the path, validated and proxied. The protocol
part of the proxied URI is optional, and defaults to "http". If port 443 is specified,
the protocol defaults to "https".

This package does not put any restrictions on the http methods or headers, except for
cookies. Requesting [user credentials](http://www.w3.org/TR/cors/#user-credentials) is disallowed.
The app can be configured to require a header for proxying a request, for example to avoid
a direct visit from the browser.

The package also includes a Procfile, to run the app on Heroku. More information about
Heroku can be found at https://devcenter.heroku.com/articles/nodejs.

## Example

```javascript
// Heroku defines the environment variable PORT, and requires the binding address to be 0.0.0.0
var host = process.env.PORT ? '0.0.0.0' : '127.0.0.1';
var port = process.env.PORT || 8080;

var cors_proxy = require('cors-anywhere');
cors_proxy.createServer({
    requireHeader: ['origin', 'x-requested-with'],
    removeHeaders: ['cookie', 'cookie2']
}).listen(port, host, function() {
    console.log('Running CORS Anywhere on ' + host + ':' + port);
});

```
Request examples:

* `http://localhost:8080/http://google.com/` - Google.com with CORS headers
* `http://localhost:8080/google.com` - Same as previous.
* `http://localhost:8080/google.com:443` - Proxies `https://google.com/`
* `http://localhost:8080/` - Shows usage text, as defined in `libs/help.txt`
* `http://localhost:8080/favicon.ico` - Replies 404 Not found

Live examples:

* https://cors-anywhere.herokuapp.com/
* https://robwu.nl/cors-anywhere.html - This demo shows how to use the API.

## Documentation

### Client

To use the API, just prefix the URL with the API URL. Take a look at [demo.html](demo.html) for an example.
A concise summary of the documentation is provided at [lib/help.txt](lib/help.txt).

If you want to automatically enable cross-domain requests when needed, use the following snippet:

```javascript
(function() {
    var cors_api_host = 'cors-anywhere.herokuapp.com';
    var cors_api_url = (window.location.protocol === 'http:' ? 'http://' : 'https://') + cors_api_host + '/';
    var slice = [].slice;
    var origin = window.location.protocol + '//' + window.location.host;
    var open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function() {
        var args = slice.call(arguments);
        var targetOrigin = /^https?:\/\/([^\/]+)/i.exec(args[1]);
        if (targetOrigin && targetOrigin[0].toLowerCase() !== origin &&
            targetOrigin[1] !== cors_api_host) {
            args[1] = cors_api_url + args[1];
        }
        return open.apply(this, args);
    };
})();
```

If you're using jQuery, you can also use the following code **instead of** the previous one:

```javascript
jQuery.ajaxPrefilter(function(options) {
    if (options.crossDomain && jQuery.support.cors) {
      options.url = (window.location.protocol === 'http:' ? 'http:' : 'https:') +
                    '//cors-anywhere.herokuapp.com/' + options.url;
    }
});
```

### Server

The module exports two properties: `getHandler` and `createServer`.

* `getHandler(options)` returns a handler which implements the routing logic.
  This handler is used by [http-proxy](https://github.com/nodejitsu/node-http-proxy).
* `createServer(options)` creates a server with the default handler.

The following options are recognized by both methods:

* array of strings `requireHeader` - If set, the request must include this header or the API will refuse to proxy.  
  Recommended if you want to prevent users from using the proxy for normal browsing.  
  Example: `['Origin', 'X-Requested-With']`.
* array of lowercase strings `removeHeaders` - Exclude certain headers from being included in the request.  
  Example: `["cookie"]`

`createServer` recognizes the following option as well:

* `httpProxyOptions` - Options for http-proxy. The documentation for these options can be found [here](https://github.com/nodejitsu/node-http-proxy#options).


## Dependencies

- NodeJitsu's [http-proxy](https://github.com/nodejitsu/node-http-proxy)


## License

Copyright (C) 2013 Rob Wu <gwnRob@gmail.com>

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
