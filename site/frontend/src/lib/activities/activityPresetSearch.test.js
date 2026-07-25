import {
  foldSearchText,
  searchActivityPresets,
  getPopularActivityPresets,
  getActivityPresetsForDiscovery,
  PRESET_SEARCH_ALIASES,
} from './activityPresetSearch';
import { ACTIVITY_PRESETS } from './activityPresets';

describe('activityPresetSearch', () => {
  test('search course finds outdoor running and treadmill', () => {
    const results = searchActivityPresets('course', 'fr', ACTIVITY_PRESETS);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('outdoor_running');
    expect(ids).toContain('treadmill_running');
  });

  test('search courir finds outdoor running', () => {
    const results = searchActivityPresets('courir', 'fr', ACTIVITY_PRESETS);
    expect(results.some((r) => r.id === 'outdoor_running')).toBe(true);
  });

  test('search natation finds swimming', () => {
    const results = searchActivityPresets('natation', 'fr', ACTIVITY_PRESETS);
    expect(results[0]?.id).toBe('pool_swimming');
  });

  test('search piscine finds swimming', () => {
    const results = searchActivityPresets('piscine', 'fr', ACTIVITY_PRESETS);
    expect(results.some((r) => r.id === 'pool_swimming')).toBe(true);
  });

  test('search rameur finds indoor rowing', () => {
    const results = searchActivityPresets('rameur', 'fr', ACTIVITY_PRESETS);
    expect(results.some((r) => r.id === 'indoor_rowing')).toBe(true);
  });

  test('search fractionné finds interval running', () => {
    const results = searchActivityPresets('fractionné', 'fr', ACTIVITY_PRESETS);
    expect(results.some((r) => r.id === 'interval_running')).toBe(true);
  });

  test('english search swim finds swimming', () => {
    const results = searchActivityPresets('swim', 'en', ACTIVITY_PRESETS);
    expect(results.some((r) => r.id === 'pool_swimming')).toBe(true);
  });

  test('spanish search natacion finds swimming', () => {
    const results = searchActivityPresets('natacion', 'es', ACTIVITY_PRESETS);
    expect(results.some((r) => r.id === 'pool_swimming')).toBe(true);
  });

  test('ignores accents in search', () => {
    const withAccent = searchActivityPresets('randonnée', 'fr', ACTIVITY_PRESETS);
    const withoutAccent = searchActivityPresets('randonnee', 'fr', ACTIVITY_PRESETS);
    expect(withAccent.some((r) => r.id === 'hiking')).toBe(true);
    expect(withoutAccent.some((r) => r.id === 'hiking')).toBe(true);
  });

  test('popular presets limited to four', () => {
    const popular = getPopularActivityPresets('fr', ACTIVITY_PRESETS);
    expect(popular).toHaveLength(4);
    expect(popular.map((p) => p.id)).toEqual([
      'outdoor_running',
      'outdoor_walking',
      'pool_swimming',
      'treadmill_running',
    ]);
  });

  test('empty query returns popular not all 17', () => {
    const results = getActivityPresetsForDiscovery({
      query: '',
      locale: 'fr',
      hasFilters: false,
      presets: ACTIVITY_PRESETS,
    });
    expect(results).toHaveLength(4);
  });

  test('filters hide activity presets', () => {
    const results = getActivityPresetsForDiscovery({
      query: 'course',
      locale: 'fr',
      hasFilters: true,
      presets: ACTIVITY_PRESETS,
    });
    expect(results).toHaveLength(0);
  });

  test('aliases map covers all presets', () => {
    ACTIVITY_PRESETS.forEach((preset) => {
      expect(PRESET_SEARCH_ALIASES[preset.id]).toBeTruthy();
    });
  });

  test('foldSearchText normalizes unicode', () => {
    expect(foldSearchText('Étirements')).toBe('etirements');
  });

  test('GPS preset has gps mode for outdoor running', () => {
    const results = searchActivityPresets('course exterieure', 'fr', ACTIVITY_PRESETS);
    const outdoor = results.find((r) => r.id === 'outdoor_running');
    expect(outdoor?.mode).toBe('gps');
  });

  test('swimming preset has laps mode', () => {
    const results = searchActivityPresets('natation', 'fr', ACTIVITY_PRESETS);
    expect(results.find((r) => r.id === 'pool_swimming')?.mode).toBe('laps');
  });

  test('interval preset has intervals mode', () => {
    const results = searchActivityPresets('fractionné', 'fr', ACTIVITY_PRESETS);
    expect(results.find((r) => r.id === 'interval_running')?.mode).toBe('intervals');
  });
});

describe('CreateWorkoutPage activity discovery wiring (source)', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.join(__dirname, '../../pages/CreateWorkoutPage.jsx'),
    'utf8',
  );

  test('uses separate activity and exercise sections', () => {
    expect(src).toContain('activity-preset-search-section');
    expect(src).toContain('exercise-catalog-search-section');
    expect(src).toContain('ActivityPresetSearchCard');
    expect(src).toContain('handleActivityPresetSelect');
  });

  test('activity click adds preset to workout block not navigate', () => {
    expect(src).not.toMatch(/handleActivityPresetSelect[\s\S]*navigate\(`\/activity\/start\?preset=/);
    expect(src).toContain('buildActivityExerciseFromPreset');
    expect(src).toContain('handleActivityPresetSelect');
    expect(src).toMatch(/handleActivityPresetSelect[\s\S]*exercises\.push\(newExercise\)/);
  });

  test('preserves exercise search debounce and limit 10', () => {
    expect(src).toContain('debouncedQuery');
    expect(src).toContain('limit: 10');
    expect(src).toContain('createExerciseSearchController');
  });

  test('responsive min-w-0 on discovery lists', () => {
    expect(src).toContain('min-w-0');
    expect(src).toContain('max-w-full');
  });
});

describe('StartActivityPage preset deep link (source)', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.join(__dirname, '../../pages/StartActivityPage.jsx'),
    'utf8',
  );

  test('reads preset query param and auto-starts', () => {
    expect(src).toContain('useSearchParams');
    expect(src).toContain("searchParams.get('preset')");
    expect(src).toContain('localizePreset');
    expect(src).toContain("setStep('configure')");
  });
});

describe('ActivityPresetSearchCard layout (source)', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.join(__dirname, '../../components/activities/ActivityPresetSearchCard.jsx'),
    'utf8',
  );

  test('uses icon not gif and compact badge', () => {
    expect(src).not.toContain('ExerciseMediaThumb');
    expect(src).not.toContain('image_url');
    expect(src).toContain('line-clamp-2');
    expect(src).toContain('min-w-0');
    expect(src).toContain('max-w-full');
  });
});

describe('i18n activity search sections FR/EN/ES', () => {
  const fs = require('fs');
  const path = require('path');
  ['fr', 'en', 'es'].forEach((lang) => {
    test(`has activitySearch keys in ${lang}`, () => {
      const json = JSON.parse(
        fs.readFileSync(path.join(__dirname, `../../i18n/locales/${lang}/workouts.json`), 'utf8'),
      );
      expect(json.create.activitySearch.activitiesSection).toBeTruthy();
      expect(json.create.activitySearch.exercisesSection).toBeTruthy();
      expect(json.create.activitySearch.popularSection).toBeTruthy();
    });
  });
});
