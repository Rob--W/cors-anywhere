**CORS Anywhere** is a NodeJS proxy which adds CORS headers to the proxied request.

The url to proxy is literally taken from the path, validated and proxied. The protocol
part of the proxied URI is optional, and defaults to "http". If port 443 is specified,
the protocol defaults to "https".

This package does not put any restrictions on the http methods or headers, except for
cookies. Credentials are disabled by default, because leaking cookies between different
domains is insecure.

The package also includes a Procfile, to run the app on Heroku. More information about
Heroku can be found at https://devcenter.heroku.com/articles/nodejs.

## Example
```javascript
var host = '127.0.0.1';
var port = 8080;

var cors_proxy = require("cors-anywhere");
cors_proxy.createServer().listen(port, host, function() {
    console.log('Running CORS Anywhere on ' + host + ':' + port);
});
```
Request examples:

* http://localhost:8080/http://google.com/ - Google.com with CORS headers
* http://localhost:8080/google.com - Same as previous.
* http://localhost:8080/google.com:443 - Proxies https://google.com/
* http://localhost:8080/ - Shows usage text, as defined in `libs/help.txt`
* http://localhost:8080/favicon.ico - Replies 404 Not found


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
