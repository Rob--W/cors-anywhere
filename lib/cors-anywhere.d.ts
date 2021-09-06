declare module 'cors-anywhere' {
  import { Server } from 'http';

  export function createServer(options?: Partial<{
    /**
     * If set, specifies which intermediate proxy to use for a given URL. If the return
     * value is void, a direct request is sent. The default implementation is
     * `proxy-from-env`, which respects the standard proxy environment variables (e.g.
     * `https_proxy`, `no_proxy`, etc.).
     */
    getProxyForUrl: (url: string | object) => string;

    /**
     * Maximum number of redirects to be followed.
     */
    maxRedirects: number;

    /**
     * If set, requests whose origin is listed are blocked.
     */
    originBlacklist: string[];

    /**
     * If set, requests whose origin is not listed are blocked. If this list is empty,
     * all origins are allowed.
     */
    originWhitelist: string[];

    /**
     * If set, it is called with the origin (string) of the request.
     * If this function returns a non-empty string, the request is rejected and the
     * string is send to the client.
     */
    checkRateLimit: (origin: string) => string;

    /**
     * If true, requests to URLs from the same origin will not be proxied but redirected.
     * The primary purpose for this option is to save server resources by delegating the
     * request to the client (since same-origin requests should always succeed, even
     * without proxying).
     */
    redirectSameOrigin: boolean;

    /**
     * If set, the request must include this header or the API will refuse to proxy.
     * Recommended if you want to prevent users from using the proxy for normal browsing.
     */
    requireHeader: string[];

    /**
     * Exclude certain headers from being included in the request.
     */
    removeHeaders: string[];

    /**
     * Set headers for the request (overwrites existing ones).
     */
    setHeaders: {[key: string]: string};

    /**
     * If set, an Access-Control-Max-Age header with this value (in seconds) will be added.
     */
    corsMaxAge: number;

    /**
     * Set the help file (shown at the homepage).
     */
    helpFile: string;

    /**
     * Under the hood, `http-proxy` is used to proxy requests. Use this option if you really
     * need to pass options to `http-proxy`.
     */
    httpProxyOptions: object;

    /**
     * If set, a `https.Server` will be created. The given options are passed to the
     * `https.createServer` method.
     */
    httpsOptions: object;
  }>): Server;
}
