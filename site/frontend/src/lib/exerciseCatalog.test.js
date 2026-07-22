/**
 * Tests catalogue exercices — recherche, debounce, médias, legacy UI.
 */
import {
  createExerciseSearchController,
  EXERCISE_FILTER_PRESETS,
} from './exerciseSearch';
import { FALLBACK_EXERCISE_IMAGE, sanitizeExerciseForApi } from './exerciseMedia';
import { exerciseSecondaryLabel } from '../components/exercises/ExerciseMediaThumb';

describe('exerciseSearch controller', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces search and returns paginated payload', async () => {
    const getAll = jest.fn().mockResolvedValue({
      data: {
        items: [{ id: 'exdb_1', name: 'Bench press' }],
        page: 1,
        limit: 30,
        total: 1,
        has_more: false,
        custom_creation_enabled: false,
      },
    });
    const ctrl = createExerciseSearchController({ api: { getAll }, limit: 30 });
    const p = ctrl.search({ q: 'bench', page: 1 });
    expect(getAll).not.toHaveBeenCalled();
    jest.advanceTimersByTime(250);
    const data = await p;
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(data.items[0].name).toBe('Bench press');
    expect(data.custom_creation_enabled).toBe(false);
  });

  it('caches identical searches', async () => {
    const getAll = jest.fn().mockResolvedValue({
      data: { items: [], page: 1, limit: 30, total: 0, has_more: false },
    });
    const ctrl = createExerciseSearchController({ api: { getAll } });
    const a = ctrl.search({ q: 'squat', page: 1 }, { debounceMs: 0 });
    jest.advanceTimersByTime(0);
    await a;
    const b = await ctrl.search({ q: 'squat', page: 1 }, { debounceMs: 0 });
    jest.advanceTimersByTime(0);
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(b.total).toBe(0);
  });

  it('exposes compact filter presets', () => {
    expect(EXERCISE_FILTER_PRESETS.sports.some((s) => s.value === 'strength')).toBe(true);
    expect(EXERCISE_FILTER_PRESETS.equipment.some((s) => s.value === 'dumbbell')).toBe(true);
  });
});

describe('exercise media helpers', () => {
  it('provides fallback image data url', () => {
    expect(FALLBACK_EXERCISE_IMAGE.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('sanitizes oversized image_url', () => {
    const big = { image_url: 'x'.repeat(600_000), name: 'x' };
    const out = sanitizeExerciseForApi(big);
    expect(out.image_url).toBeNull();
  });

  it('builds secondary label from equipment and muscles', () => {
    expect(
      exerciseSecondaryLabel({
        equipment: ['barbell', 'bench'],
        primary_muscles: ['chest'],
      })
    ).toContain('barbell');
  });
});

describe('CreateWorkoutPage catalog wiring (source)', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.join(__dirname, '../pages/CreateWorkoutPage.jsx'),
    'utf8'
  );

  it('keeps existing dialog selector and uses paginated API search', () => {
    expect(src).toContain('createExerciseSearchController');
    expect(src).toContain('ExerciseMediaThumb');
    expect(src).toContain('exercise_name_snapshot');
    expect(src).toContain('customCreationEnabled');
    expect(src).toContain('onExerciseListScroll');
    expect(src).toContain('debouncedQuery');
  });

  it('hides new custom creation when flag is false', () => {
    expect(src).toContain('customCreationEnabled || editingExerciseId');
    expect(src).toContain('workouts:create.dialog.newExercise');
  });
});

describe('WorkoutPlayer legacy media (source)', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.join(__dirname, '../pages/WorkoutPlayerPage.jsx'),
    'utf8'
  );

  it('falls back to media_snapshot and uses object-contain', () => {
    expect(src).toContain('media_snapshot');
    expect(src).toContain('object-contain');
    expect(src).toContain('getLocalizedExerciseField');
    expect(src).toContain('resolveExerciseMediaUrl');
  });
});

describe('i18n exercise filters FR/EN/ES', () => {
  const fs = require('fs');
  const path = require('path');
  const locales = ['fr', 'en', 'es'];
  locales.forEach((lang) => {
    it(`has filter keys in ${lang}`, () => {
      const json = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, `../i18n/locales/${lang}/workouts.json`),
          'utf8'
        )
      );
      expect(json.create.filters.strength).toBeTruthy();
      expect(json.create.filters.equipmentDumbbell).toBeTruthy();
      expect(json.create.toast.customCreationDisabled).toBeTruthy();
      expect(json.create.loadingMore).toBeTruthy();
    });
  });
});

describe('theme tokens still used on exercise cards', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.join(__dirname, '../pages/CreateWorkoutPage.jsx'),
    'utf8'
  );
  it('uses semantic theme classes for library rows', () => {
    expect(src).toContain('bg-hover');
    expect(src).toContain('text-foreground');
    expect(src).toContain('bg-surface-elevated');
  });
});
