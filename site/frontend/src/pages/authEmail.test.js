const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const LEGACY_API_HOST = 'https://anthea.sitereadyshd.fr';

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('email auth UI', () => {
  const loginSrc = read('pages/LoginPage.jsx');
  const registerSrc = read('pages/RegisterPage.jsx');
  const verifySrc = read('pages/VerifyEmailPage.jsx');
  const checkSrc = read('pages/CheckEmailPage.jsx');
  const legacySrc = read('pages/LegacyAccountPage.jsx');
  const forgotSrc = read('pages/ForgotPasswordPage.jsx');
  const resetSrc = read('pages/ResetPasswordPage.jsx');
  const appSrc = read('App.js');
  const apiSrc = read('lib/api.js');
  const authCtx = read('context/AuthContext.jsx');
  const registerEmailLib = read('lib/registerEmail.js');
  const fr = JSON.parse(read('i18n/locales/fr/auth.json'));
  const en = JSON.parse(read('i18n/locales/en/auth.json'));
  const es = JSON.parse(read('i18n/locales/es/auth.json'));

  test('login uses email field and links forgot/legacy', () => {
    expect(loginSrc).toContain('login-email');
    expect(loginSrc).toContain("type=\"email\"");
    expect(loginSrc).toContain('/forgot-password');
    expect(loginSrc).toContain('/legacy-account');
    expect(loginSrc).not.toContain('login-username');
  });

  test('register asks handle email password confirmation', () => {
    expect(registerSrc).toContain('register-handle');
    expect(registerSrc).toContain('register-email');
    expect(registerSrc).toContain('register-password');
    expect(registerSrc).toContain('register-confirm-password');
    expect(registerSrc).toContain('password_confirmation');
    expect(registerSrc).toMatch(/password !== confirmPassword/);
    expect(registerSrc).toContain('isValidRegisterEmail');
    expect(registerSrc).toContain('qa_bypass_unavailable');
    expect(registerSrc).toContain("type=\"text\"");
    expect(registerSrc).not.toMatch(/register-email[\s\S]*type="email"/);
  });

  test('verify-email page reads token and avoids double submit', () => {
    expect(verifySrc).toContain("searchParams.get('token')");
    expect(verifySrc).toContain('started.current');
    expect(verifySrc).toContain('verifyEmail');
  });

  test('check-email page supports resend cooldown', () => {
    expect(checkSrc).toContain('resendVerification');
    expect(checkSrc).toContain('cooldown');
  });

  test('legacy account two-step flow', () => {
    expect(legacySrc).toContain('legacyLogin');
    expect(legacySrc).toContain('legacyEmail');
    expect(legacySrc).toContain('legacy.intro');
  });

  test('forgot and reset password pages', () => {
    expect(forgotSrc).toContain('forgotPassword');
    expect(resetSrc).toContain('resetPassword');
    expect(resetSrc).toContain("searchParams.get('token')");
  });

  test('routes registered in App.js', () => {
    expect(appSrc).toContain('/verify-email');
    expect(appSrc).toContain('/check-email');
    expect(appSrc).toContain('/legacy-account');
    expect(appSrc).toContain('/forgot-password');
    expect(appSrc).toContain('/reset-password');
  });

  test('authApi endpoints under /auth and no legacy host', () => {
    expect(apiSrc).toContain("/auth/verify-email");
    expect(apiSrc).toContain("/auth/resend-verification");
    expect(apiSrc).toContain("/auth/legacy/login");
    expect(apiSrc).toContain("/auth/forgot-password");
    expect(apiSrc).toContain("/auth/reset-password");
    expect(apiSrc).not.toContain(LEGACY_API_HOST);
    expect(authCtx).not.toContain(LEGACY_API_HOST);
    expect(authCtx).toContain('data?.user');
    expect(registerSrc).toContain('requires_verification');
  });

  test('register email QA prefix validation helper', () => {
    expect(registerEmailLib).toContain("export const QA_EMAIL_PREFIX = '///***'");
    expect(registerEmailLib).toContain('registerEmailForValidation');
    expect(registerEmailLib).toContain('isValidRegisterEmail');
    expect(registerEmailLib).toContain('.slice(QA_EMAIL_PREFIX.length)');
  });

  test('FR/EN/ES auth keys present', () => {
    for (const loc of [fr, en, es]) {
      expect(loc.login.email).toBeTruthy();
      expect(loc.login.forgotPassword).toBeTruthy();
      expect(loc.login.legacyAccount).toBeTruthy();
      expect(loc.register.email).toBeTruthy();
      expect(loc.verify.success).toBeTruthy();
      expect(loc.legacy.intro).toBeTruthy();
      expect(loc.forgot.sent).toBeTruthy();
      expect(loc.reset.success).toBeTruthy();
    }
  });
});
