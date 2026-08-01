/**
 * Formatage des erreurs API (codes structurés → i18n).
 * Module séparé pour tests unitaires sans axios.
 */
export function isApiNetworkError(error) {
  const status = error?.response?.status;
  return !error?.response || status === 502 || status === 503 || status === 504;
}

export function formatApiErrorDetail(detail, t) {
  const translate = t || ((key) => key);
  if (detail == null) return translate('errors:generic');
  if (typeof detail === 'object' && !Array.isArray(detail)) {
    const code = detail.code || detail.error_code;
    if (code) {
      const key = `errors:${code}`;
      const translated = translate(key, { defaultValue: '' });
      if (translated && translated !== key && translated !== '') return translated;
    }
    if (typeof detail.message === 'string' && detail.message) return detail.message;
    if (typeof detail.msg === 'string' && detail.msg) return detail.msg;
  }
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(' ');
  }
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
}
