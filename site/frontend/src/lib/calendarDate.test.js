import { localCalendarDate, parseCalendarDate } from './calendarDate';

describe('calendarDate', () => {
  test('localCalendarDate returns YYYY-MM-DD', () => {
    const d = new Date(2026, 7, 8, 1, 35, 0);
    expect(localCalendarDate(d)).toBe('2026-08-08');
  });

  test('parseCalendarDate avoids UTC day shift', () => {
    const parsed = parseCalendarDate('2026-08-08');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(8);
  });

  test('parseCalendarDate returns null for invalid input', () => {
    expect(parseCalendarDate(null)).toBeNull();
    expect(parseCalendarDate('')).toBeNull();
  });
});
