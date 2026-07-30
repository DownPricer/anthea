import { resolveApiBaseUrl } from './apiBaseUrl';

describe('resolveApiBaseUrl', () => {
  const originalEnv = process.env.REACT_APP_BACKEND_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REACT_APP_BACKEND_URL;
    } else {
      process.env.REACT_APP_BACKEND_URL = originalEnv;
    }
  });

  it('returns /api when REACT_APP_BACKEND_URL is empty (production default)', () => {
    expect(resolveApiBaseUrl('')).toBe('/api');
    expect(resolveApiBaseUrl('   ')).toBe('/api');
    delete process.env.REACT_APP_BACKEND_URL;
    expect(resolveApiBaseUrl()).toBe('/api');
  });

  it('returns absolute dev URL when REACT_APP_BACKEND_URL is set', () => {
    expect(resolveApiBaseUrl('http://localhost:8000')).toBe('http://localhost:8000/api');
    expect(resolveApiBaseUrl('http://localhost:8000/')).toBe('http://localhost:8000/api');
  });

  it('never produces anthea.sitereadyshd.fr in production mode', () => {
    const prod = resolveApiBaseUrl('');
    expect(prod).toBe('/api');
    expect(prod).not.toContain('anthea.sitereadyshd.fr');
  });
});
