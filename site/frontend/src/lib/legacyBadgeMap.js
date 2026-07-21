/**
 * Anciens IDs → IDs canoniques (miroir de badge_catalog.py LEGACY_BADGE_ID_MAP).
 * Préserve featured_badges / posts historiques.
 */
export const LEGACY_BADGE_ID_MAP = {
  streak_3: 'solo_streak_three',
  streak_7: 'solo_streak_seven',
  streak_3_weeks: 'solo_streak_twenty_one',
  vol_5: 'solo_five_workouts',
  vol_10: 'solo_ten_workouts',
  vol_25: 'solo_twenty_five_workouts',
  vol_50: 'solo_fifty_workouts',
  vol_100: 'solo_one_hundred_workouts',
  challenge_1: 'solo_first_weekly_challenge',
  challenge_10: 'solo_ten_challenges',
  duo_first: 'duo_first_common_workout',
  duo_3: 'duo_three_common_workouts',
  duo_together_first: 'duo_first_common_workout',
  duo_streak_7: 'duo_streak_seven',
  duo_encourage_10: 'duo_ten_encouragements',
  duo_presence_5: 'duo_three_active_days',
  duo_challenge_week: 'duo_first_challenge_participation',
  duo_regular: 'duo_ten_common_workouts',
  duo_legendary_legacy: 'duo_fifty_common_workouts',
  // Alias historique : ancien duo_legendary (50 séances) → épique actuel
  duo_legendary: 'duo_fifty_common_workouts',
};

export function canonicalBadgeId(badgeId) {
  if (!badgeId) return '';
  const id = String(badgeId);
  return LEGACY_BADGE_ID_MAP[id] || id;
}
