/** Transforme la réponse /streak/calendar en map { 'yyyy-MM-dd': day } */
export function calendarDaysToMap(days = []) {
  const map = {};
  for (const d of days) {
    map[d.date] = d;
  }
  return map;
}
