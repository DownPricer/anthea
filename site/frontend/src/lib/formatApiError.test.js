import { formatApiErrorDetail, isApiNetworkError } from './formatApiErrorDetail';

const translations = {
  'errors:generic': 'Une erreur est survenue. Veuillez réessayer.',
  'errors:ALREADY_FOLLOWING': 'Vous suivez déjà cet utilisateur.',
  'errors:CANNOT_FOLLOW_SELF': 'Impossible de se suivre soi-même.',
};

function t(key, opts) {
  if (opts?.defaultValue === '' && !(key in translations)) return '';
  return translations[key] || key;
}

describe('formatApiErrorDetail structured codes', () => {
  it('translates ALREADY_FOLLOWING from code', () => {
    expect(
      formatApiErrorDetail(
        { code: 'ALREADY_FOLLOWING', message: 'Vous suivez déjà cet utilisateur' },
        t
      )
    ).toBe('Vous suivez déjà cet utilisateur.');
  });

  it('falls back to backend message when code unknown', () => {
    expect(
      formatApiErrorDetail({ code: 'UNKNOWN_CODE', message: 'Message backend' }, t)
    ).toBe('Message backend');
  });

  it('keeps string detail as fallback for old endpoints', () => {
    expect(formatApiErrorDetail('Vous suivez déjà cet utilisateur', t)).toBe(
      'Vous suivez déjà cet utilisateur'
    );
  });
});

describe('isApiNetworkError', () => {
  it('detects network and gateway errors only', () => {
    expect(isApiNetworkError({})).toBe(true);
    expect(isApiNetworkError({ response: { status: 502 } })).toBe(true);
    expect(isApiNetworkError({ response: { status: 503 } })).toBe(true);
    expect(isApiNetworkError({ response: { status: 504 } })).toBe(true);
    expect(isApiNetworkError({ response: { status: 500 } })).toBe(false);
    expect(isApiNetworkError({ response: { status: 403 } })).toBe(false);
  });
});
