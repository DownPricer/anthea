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

export const NOTIFICATION_PREF_GROUPS = [
  {
    id: 'sessions',
    label: 'Séances',
    keys: [
      { key: 'partner_workout_started', label: 'Séance commencée par mon partenaire' },
      { key: 'partner_workout_completed', label: 'Séance terminée par mon partenaire' },
      { key: 'scheduled_workout_reminder', label: 'Rappel de ma séance planifiée' },
    ],
  },
  {
    id: 'social',
    label: 'Réseau social',
    keys: [
      { key: 'followed_user_post', label: "Nouvelle publication d'un compte suivi" },
      { key: 'post_comment', label: 'Nouveau commentaire sur ma publication' },
      { key: 'post_like', label: "Nouveau J'aime sur ma publication" },
      { key: 'follow_request', label: 'Nouvelle demande de suivi' },
      { key: 'follow_accepted', label: 'Demande de suivi acceptée' },
    ],
  },
  {
    id: 'duo',
    label: 'Duo',
    keys: [
      { key: 'duo_request', label: 'Nouvelle demande Duo' },
      { key: 'duo_activity', label: 'Activité importante de mon Duo' },
    ],
  },
  {
    id: 'badges',
    label: 'Badges et défis',
    keys: [
      { key: 'solo_badge_unlocked', label: 'Badge Solo débloqué' },
      { key: 'duo_badge_unlocked', label: 'Badge Duo débloqué' },
      { key: 'challenge_ending', label: 'Défi hebdomadaire bientôt terminé' },
      { key: 'challenge_completed', label: 'Défi Solo ou Duo réussi' },
    ],
  },
  {
    id: 'reminders',
    label: 'Rappels',
    keys: [
      { key: 'streak_reminder', label: 'Rappels de streak' },
    ],
  },
];

export function mergeNotificationPrefs(raw) {
  const merged = { ...DEFAULT_NOTIFICATION_PREFS };
  if (!raw || typeof raw !== 'object') return merged;
  for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFS)) {
    if (key in raw) merged[key] = Boolean(raw[key]);
  }
  return merged;
}
