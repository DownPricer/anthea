import { format } from 'date-fns';

/** Date calendaire locale au format YYYY-MM-DD (sans décalage UTC). */
export function localCalendarDate(d = new Date()) {
  return format(d, 'yyyy-MM-dd');
}

/** Parse une date calendaire YYYY-MM-DD en Date locale (midi pour éviter le drift UTC). */
export function parseCalendarDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  return new Date(`${dateStr}T12:00:00`);
}
