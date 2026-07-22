/**
 * Deep link notification badge → catalogue + fiche.
 */
export function badgeNotificationDeepLink(notif) {
  if (!notif) return '/badges?scope=solo';
  if (notif.url && String(notif.url).includes('badge=')) return notif.url;
  const badgeId = notif.badge_id || notif.translation_params?.badge_id;
  const scope =
    notif.scope ||
    (notif.type === 'duo_badge_unlocked' || String(badgeId || '').startsWith('duo_')
      ? 'duo'
      : 'solo');
  if (badgeId) return `/badges?scope=${scope}&badge=${encodeURIComponent(String(badgeId))}`;
  return `/badges?scope=${scope}`;
}

export function isBadgeUnlockNotification(type) {
  return type === 'badge_unlocked' || type === 'duo_badge_unlocked';
}
