/**
 * Calcule le meilleur streak historique à partir du calendrier streak API.
 * Ne compte pas les jours sans séance prévue (neutral → ok côté backend).
 */
export function computeBestStreak(calendarDays = []) {
  if (!calendarDays.length) return null;

  const sorted = [...calendarDays].sort((a, b) => a.date.localeCompare(b.date));
  let max = 0;
  let current = 0;
  let prevDate = null;

  for (const day of sorted) {
    if (day.is_future || day.skip) continue;

    if (prevDate) {
      const prev = new Date(`${prevDate}T12:00:00`);
      const cur = new Date(`${day.date}T12:00:00`);
      const diffDays = Math.round((cur - prev) / (86400000));
      if (diffDays > 1) current = 0;
    }

    const contributes = isStreakContributingDay(day);
    if (contributes) {
      current += 1;
      max = Math.max(max, current);
      prevDate = day.date;
    } else if (day.has_planned && day.combined === 'fail') {
      current = 0;
      prevDate = day.date;
    } else if (!day.rest && !day.has_planned) {
      prevDate = day.date;
    } else if (day.combined === 'fail') {
      current = 0;
      prevDate = day.date;
    }
  }

  return max > 0 ? max : null;
}

export function isStreakContributingDay(day) {
  if (day.is_future || day.skip) return false;
  if (day.combined === 'fail') return false;
  if (day.rest) return true;
  if (!day.has_planned) return false;
  return day.combined === 'ok' || day.combined === 'today_pending';
}
