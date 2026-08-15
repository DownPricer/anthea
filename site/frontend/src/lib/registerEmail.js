/** Préfixe QA inscription (commande serveur, pas une adresse réelle). */
export const QA_EMAIL_PREFIX = '///***';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Adresse utilisée pour la validation côté client (sans préfixe QA). */
export function registerEmailForValidation(rawEmail) {
  const trimmed = String(rawEmail || '').trim();
  if (trimmed.startsWith(QA_EMAIL_PREFIX)) {
    return trimmed.slice(QA_EMAIL_PREFIX.length);
  }
  return trimmed;
}

export function isValidRegisterEmail(rawEmail) {
  const validationEmail = registerEmailForValidation(rawEmail);
  if (!validationEmail) return false;
  return EMAIL_RE.test(validationEmail);
}
