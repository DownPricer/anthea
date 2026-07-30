/**
 * Base URL axios — same-origin en production (/api), URL absolue optionnelle en dev.
 */
export function resolveApiBaseUrl(envBackendUrl = process.env.REACT_APP_BACKEND_URL) {
  const backend = envBackendUrl;
  if (backend != null && String(backend).trim() !== '') {
    const trimmed = String(backend).trim().replace(/\/$/, '');
    return `${trimmed}/api`;
  }
  return '/api';
}
