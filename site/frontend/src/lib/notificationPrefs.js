/** Clés de préférences Web Push (alignées backend push_service). */
export const DEFAULT_NOTIFICATION_PREFS = {
  partner_workout_started: true,
  partner_workout_completed: true,
  scheduled_workout_reminder: true,
  followed_user_post: false,
  post_comment: true,
  post_like: true,
  follow_request: true,
  follow_accepted: true,
  duo_request: true,
  duo_activity: true,
  solo_badge_unlocked: true,
  duo_badge_unlocked: true,
  challenge_ending: true,
  challenge_completed: true,
  streak_reminder: false,
};

/** Structure des groupes (clés i18n dans notifications:prefs.*). */
export const NOTIFICATION_PREF_GROUPS = [
  {
    id: 'sessions',
    keys: [
      'partner_workout_started',
      'partner_workout_completed',
      'scheduled_workout_reminder',
    ],
  },
  {
    id: 'social',
    keys: [
      'followed_user_post',
      'post_comment',
      'post_like',
      'follow_request',
      'follow_accepted',
    ],
  },
  {
    id: 'duo',
    keys: ['duo_request', 'duo_activity'],
  },
  {
    id: 'badges',
    keys: [
      'solo_badge_unlocked',
      'duo_badge_unlocked',
      'challenge_ending',
      'challenge_completed',
    ],
  },
  {
    id: 'reminders',
    keys: ['streak_reminder'],
  },
];

/** Retourne les groupes avec libellés traduits pour l'UI. */
export function getNotificationPrefLabels(t) {
  return NOTIFICATION_PREF_GROUPS.map((group) => ({
    id: group.id,
    label: t(`notifications:prefs.groups.${group.id}`),
    keys: group.keys.map((key) => ({
      key,
      label: t(`notifications:prefs.keys.${key}`),
    })),
  }));
}

export function mergeNotificationPrefs(raw) {
  const merged = { ...DEFAULT_NOTIFICATION_PREFS };
  if (!raw || typeof raw !== 'object') return merged;
  for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFS)) {
    if (key in raw) merged[key] = Boolean(raw[key]);
  }
  return merged;
}
