/**
 * Tests catalogue exercices — recherche, debounce, médias, legacy UI.
 */
import {
  createExerciseSearchController,
  EXERCISE_FILTER_PRESETS,
} from './exerciseSearch';
import { FALLBACK_EXERCISE_IMAGE, sanitizeExerciseForApi } from './exerciseMedia';
import { exerciseSecondaryLabel } from '../components/exercises/ExerciseMediaThumb';
import {
  collectRecentExercises,
  mergeRecentWithCatalog,
} from './recentExercises';

describe('exerciseSearch controller', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces search (~250ms), limits to 10, and aborts previous request', async () => {
    const getAll = jest.fn().mockResolvedValue({
      data: {
        items: [{ id: 'exdb_1', name: 'Bench press' }],
        page: 1,
        limit: 10,
        total: 1,
        has_more: false,
        custom_creation_enabled: false,
      },
    });
    const ctrl = createExerciseSearchController({ api: { getAll }, limit: 10 });
    const p = ctrl.search({ q: 'bench', page: 1 });
    expect(getAll).not.toHaveBeenCalled();
    jest.advanceTimersByTime(250);
    const data = await p;
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(getAll.mock.calls[0][0].limit).toBe(10);
    expect(data.items[0].name).toBe('Bench press');
    expect(data.custom_creation_enabled).toBe(false);

    ctrl.search({ q: 'squat', page: 1 });
    ctrl.cancel();
    jest.advanceTimersByTime(250);
  });

  it('caches identical searches', async () => {
    const getAll = jest.fn().mockResolvedValue({
      data: { items: [], page: 1, limit: 10, total: 0, has_more: false },
    });
    const ctrl = createExerciseSearchController({ api: { getAll }, limit: 10 });
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

describe('recent exercises helpers', () => {
  it('reuses recent ids from blocks/templates without extra API', () => {
    const recent = collectRecentExercises({
      blocks: [
        {
          exercises: [
            { exercise_id: 'a', name: 'Pompes', description: 'x'.repeat(300) },
            { exercise_id: 'b', name: 'Squat' },
          ],
        },
      ],
      templates: [
        { blocks: [{ exercises: [{ exercise_id: 'a', name: 'Pompes' }, { id: 'c', name: 'Curl' }] }] },
      ],
      limit: 10,
    });
    expect(recent.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('merges recent with catalog and caps at 10', () => {
    const recent = Array.from({ length: 4 }, (_, i) => ({ id: `r${i}`, name: `R${i}` }));
    const catalog = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, name: `C${i}` }));
    const merged = mergeRecentWithCatalog(recent, catalog, 10);
    expect(merged).toHaveLength(10);
    expect(merged.slice(0, 4).map((e) => e.id)).toEqual(['r0', 'r1', 'r2', 'r3']);
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
    expect(src).toContain('limit: 10');
    expect(src).toContain('collectRecentExercises');
  });

  it('abandons creation back to Mes séances without window.location', () => {
    expect(src).toContain("navigate('/workouts')");
    expect(src).toMatch(/handleAbandonDelete[\s\S]*navigate\('\/workouts'\)/);
    expect(src).not.toMatch(/handleAbandonDelete[\s\S]*navigate\('\/create'\)/);
    expect(src).not.toContain('window.location');
  });

  it('constrains exercise cards and clamps long descriptions', () => {
    expect(src).toContain('workout-exercise-card');
    expect(src).toContain('exercise-library-card');
    expect(src).toContain('line-clamp-2 break-words [overflow-wrap:anywhere]');
    expect(src).toContain('exercise-library-skeletons');
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
