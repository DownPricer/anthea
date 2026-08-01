jest.mock('axios', () => {
  const create = (defaults = {}) => {
    let onFulfilled = (value) => value;
    let onRejected = (error) => Promise.reject(error);
    const client = async (config) => {
      const merged = { ...defaults, ...config };
      try {
        const response = await client.defaults.adapter(merged);
        return onFulfilled(response);
      } catch (error) {
        return onRejected(error);
      }
    };
    client.defaults = { ...defaults, adapter: null };
    client.interceptors = {
      response: {
        use(success, failure) {
          onFulfilled = success;
          onRejected = failure;
        },
      },
    };
    for (const method of ['get', 'delete']) {
      client[method] = (url, config = {}) => client({ ...config, method, url });
    }
    for (const method of ['post', 'put', 'patch']) {
      client[method] = (url, data, config = {}) =>
        client({ ...config, method, url, data });
    }
    return client;
  };
  return { __esModule: true, default: { create } };
});

function axiosError(config, status) {
  const error = new Error(status ? `HTTP ${status}` : 'Network Error');
  error.config = config;
  if (status) {
    error.response = { status, data: {}, headers: {}, config };
  }
  return error;
}

function ok(config, data = {}) {
  return { status: 200, statusText: 'OK', headers: {}, config, data };
}

describe('auth refresh resilience', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('multiple simultaneous 401 responses share one refresh and replay once', async () => {
    const api = require('./api').default;
    let refreshCalls = 0;
    const attempts = new Map();
    api.defaults.adapter = jest.fn(async (config) => {
      if (config.url === '/auth/refresh') {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return ok(config);
      }
      const count = attempts.get(config.url) || 0;
      attempts.set(config.url, count + 1);
      if (count === 0) throw axiosError(config, 401);
      return ok(config, { restored: true });
    });

    const [first, second] = await Promise.all([
      api.get('/workouts'),
      api.get('/notifications'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(first.data.restored).toBe(true);
    expect(second.data.restored).toBe(true);
    expect(attempts.get('/workouts')).toBe(2);
    expect(attempts.get('/notifications')).toBe(2);
  });

  test('network and 502 failures never emit session invalidation', async () => {
    const api = require('./api').default;
    const invalid = jest.fn();
    const temporary = jest.fn();
    window.addEventListener('auth:session-invalid', invalid);
    window.addEventListener('auth:temporary-unavailable', temporary);
    api.defaults.adapter = jest.fn(async (config) => {
      if (config.url === '/offline') throw axiosError(config);
      throw axiosError(config, 502);
    });

    await expect(api.get('/offline')).rejects.toThrow('Network Error');
    await expect(api.get('/gateway')).rejects.toThrow('HTTP 502');

    expect(invalid).not.toHaveBeenCalled();
    expect(temporary).toHaveBeenCalledTimes(2);
    window.removeEventListener('auth:session-invalid', invalid);
    window.removeEventListener('auth:temporary-unavailable', temporary);
  });

  test('a refused refresh invalidates once without a refresh loop', async () => {
    const api = require('./api').default;
    const invalid = jest.fn();
    let refreshCalls = 0;
    window.addEventListener('auth:session-invalid', invalid);
    api.defaults.adapter = jest.fn(async (config) => {
      if (config.url === '/auth/refresh') {
        refreshCalls += 1;
        throw axiosError(config, 401);
      }
      throw axiosError(config, 401);
    });

    await expect(api.get('/workouts')).rejects.toThrow('HTTP 401');

    expect(refreshCalls).toBe(1);
    expect(invalid).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:session-invalid', invalid);
  });

  test('auth and public endpoints never trigger refresh', async () => {
    const api = require('./api').default;
    let refreshCalls = 0;
    api.defaults.adapter = jest.fn(async (config) => {
      if (config.url === '/auth/refresh') refreshCalls += 1;
      throw axiosError(config, 401);
    });

    await expect(api.post('/auth/login')).rejects.toThrow();
    await expect(
      api.get('/public/feed/trending', { _skipAuthRefresh: true })
    ).rejects.toThrow();

    expect(refreshCalls).toBe(0);
  });
});

describe('auth persistence source guarantees', () => {
  test('AuthContext uses explicit states, retry backoff and no token storage', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../context/AuthContext.jsx'),
      'utf8'
    );

    expect(source).toContain("useState('checking')");
    expect(source).toContain("setAuthStatus('authenticated')");
    expect(source).toContain("setAuthStatus('anonymous')");
    expect(source).toContain('2000, 5000, 10000, 30000');
    expect(source).not.toMatch(/localStorage.*token|token.*localStorage/i);
  });
});
