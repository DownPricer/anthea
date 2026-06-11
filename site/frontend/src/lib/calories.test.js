import { estimateCalories, getCaloriesRatePerMinute, formatCalories } from './calories';

describe('calories', () => {
  test('estimateCalories uses difficulty bands', () => {
    expect(estimateCalories(600, 2)).toBe(30);
    expect(estimateCalories(600, 5)).toBe(50);
    expect(estimateCalories(600, 7)).toBe(70);
    expect(estimateCalories(600, 10)).toBe(80);
    expect(estimateCalories(600, null)).toBe(50);
  });

  test('getCaloriesRatePerMinute defaults', () => {
    expect(getCaloriesRatePerMinute(undefined)).toBe(5);
  });

  test('formatCalories shows approximation prefix', () => {
    expect(formatCalories(120)).toBe('~120 kcal');
    expect(formatCalories(null)).toBe('—');
  });
});
