// A small axios stand-in: enough of the real shape that `apiClient.ts` builds on it unmodified,
// including its request/response interceptors, so the retry-and-refresh logic is the shipped one.
//
// Tests drive it by pushing handlers with `__handle(method, urlPattern, fn)`; anything unhandled
// rejects the way axios does, with `error.response.status`.

const routes = [];
let calls = [];

/** Test control: register a handler. `fn` returns the response body, or throws `__status(n)`. */
export function __handle(method, pattern, fn) {
  routes.push({ method: method.toLowerCase(), pattern, fn });
}

/** Test control: an error shaped like an axios HTTP failure. */
export function __status(status, body = {}) {
  const err = new Error(`Request failed with status code ${status}`);
  err.isAxiosError = true;
  err.response = { status, data: body };
  return err;
}

export function __reset() { routes.length = 0; calls = []; }
export function __calls()  { return calls; }

/** Last registration wins, so a test can override one route of the default happy-path server. */
function match(method, url) {
  return routes.findLast((r) => r.method === method
    && (r.pattern instanceof RegExp ? r.pattern.test(url) : url.includes(r.pattern)));
}

function makeInstance(defaults = {}) {
  async function request(config) {
    const cfg = { headers: {}, ...config };
    for (const i of instance.interceptors.request.handlers) {
      if (i.fulfilled) Object.assign(cfg, await i.fulfilled(cfg));
    }

    const method = (cfg.method || 'get').toLowerCase();
    calls.push({ method, url: cfg.url, data: cfg.data, params: cfg.params, headers: cfg.headers,
                 timeout: cfg.timeout ?? defaults.timeout });

    let response;
    try {
      const route = match(method, cfg.url || '');
      if (!route) throw __status(404, { msg: `no stub for ${method.toUpperCase()} ${cfg.url}` });
      response = { data: await route.fn(cfg), status: 200, config: cfg };
    } catch (err) {
      err.config = cfg;
      for (const i of instance.interceptors.response.handlers) {
        if (i.rejected) return i.rejected(err);
      }
      throw err;
    }

    for (const i of instance.interceptors.response.handlers) {
      if (i.fulfilled) response = i.fulfilled(response);
    }
    return response;
  }

  const instance = Object.assign(request, {
    defaults,
    interceptors: {
      request:  { handlers: [], use(f, r) { this.handlers.push({ fulfilled: f, rejected: r }); } },
      response: { handlers: [], use(f, r) { this.handlers.push({ fulfilled: f, rejected: r }); } },
    },
    get:    (url, config)       => request({ ...config, method: 'get', url }),
    delete: (url, config)       => request({ ...config, method: 'delete', url }),
    post:   (url, data, config) => request({ ...config, method: 'post',  url, data }),
    put:    (url, data, config) => request({ ...config, method: 'put',   url, data }),
    patch:  (url, data, config) => request({ ...config, method: 'patch', url, data }),
  });
  return instance;
}

const axios = makeInstance();
axios.create = (config) => makeInstance(config);
axios.isAxiosError = (e) => Boolean(e && e.isAxiosError);

export default axios;

// `apiClient.ts` imports this as a value rather than with `import type`, so Node's type stripping
// leaves it in the import list and it has to exist at runtime.
export const InternalAxiosRequestConfig = undefined;
