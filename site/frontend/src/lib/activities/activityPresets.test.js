import {
  ACTIVITY_PRESETS,
  START_PAGE_PRESET_IDS,
  getLocalizedStartPagePresets,
  filterReliableCompatibleExercises,
  isBlockedCatalogExercise,
  BLOCKED_CATALOG_GPS_PATTERNS,
} from './activityPresets';

describe('activityPresets', () => {
  test('start page presets include core sports', () => {
    const ids = getLocalizedStartPagePresets('fr').map((p) => p.id);
    expect(ids).toContain('outdoor_running');
    expect(ids).toContain('pool_swimming');
    expect(ids).toContain('interval_running');
    expect(ids).toContain('treadmill_running');
    expect(ids).toContain('yoga_session');
    expect(ids).toContain('stretching_session');
    expect(ids).toHaveLength(START_PAGE_PRESET_IDS.length);
  });

  test('localized labels FR EN ES', () => {
    const fr = getLocalizedStartPagePresets('fr').find((p) => p.id === 'outdoor_running');
    const en = getLocalizedStartPagePresets('en').find((p) => p.id === 'outdoor_running');
    const es = getLocalizedStartPagePresets('es').find((p) => p.id === 'outdoor_running');
    expect(fr.label).toBe('Course extérieure');
    expect(en.label).toBe('Outdoor running');
    expect(es.label).toBe('Carrera al aire libre');

    const swimFr = getLocalizedStartPagePresets('fr').find((p) => p.id === 'pool_swimming');
    const swimEn = getLocalizedStartPagePresets('en').find((p) => p.id === 'pool_swimming');
    const swimEs = getLocalizedStartPagePresets('es').find((p) => p.id === 'pool_swimming');
    expect(swimFr.label).toBe('Natation');
    expect(swimEn.label).toBe('Swimming');
    expect(swimEs.label).toBe('Natación');

    const hiitFr = getLocalizedStartPagePresets('fr').find((p) => p.id === 'interval_running');
    expect(hiitFr.label).toBe('Fractionné');
    expect(hiitFr.mode).toBe('intervals');
  });

  test('GPS presets use gps mode', () => {
    const gpsPresets = ACTIVITY_PRESETS.filter((p) => p.activity_tracking_mode === 'gps');
    expect(gpsPresets.some((p) => p.id === 'outdoor_running')).toBe(true);
    gpsPresets.forEach((p) => {
      expect(p.activity_tracking_mode).toBe('gps');
    });
  });

  test('blocked catalog exercises never shown as compatible GPS', () => {
    const blocked = [
      { name: 'band assisted wheel rollerout', activity_tracking_mode: 'gps', activity_classification_confidence: 'high' },
      { name: 'barbell skier', activity_tracking_mode: 'gps', activity_classification_confidence: 'high' },
      { name: 'cable thibaudeau kayak row', activity_tracking_mode: 'gps', activity_classification_confidence: 'high' },
    ];
    blocked.forEach((ex) => {
      expect(isBlockedCatalogExercise(ex)).toBe(true);
    });
    const filtered = filterReliableCompatibleExercises(blocked);
    expect(filtered).toHaveLength(0);
  });

  test('filterReliableCompatibleExercises rejects standard and gps', () => {
    const list = [
      { name: 'Tabata', activity_tracking_mode: 'intervals', activity_classification_confidence: 'high' },
      { name: 'Squat', activity_tracking_mode: 'standard', activity_classification_confidence: 'high' },
      { name: 'Run', activity_tracking_mode: 'gps', activity_classification_confidence: 'high' },
    ];
    const filtered = filterReliableCompatibleExercises(list);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Tabata');
  });

  test('blocked patterns cover rollerout ski kayak', () => {
    expect(BLOCKED_CATALOG_GPS_PATTERNS.some((re) => re.test('wheel rollerout'))).toBe(true);
    expect(BLOCKED_CATALOG_GPS_PATTERNS.some((re) => re.test('barbell skier'))).toBe(true);
    expect(BLOCKED_CATALOG_GPS_PATTERNS.some((re) => re.test('kayak row'))).toBe(true);
  });
});

describe('StartActivityPage layout (mobile 320px)', () => {
  test('preset labels are short enough for narrow screens', () => {
    getLocalizedStartPagePresets('fr').forEach((preset) => {
      expect(preset.label.length).toBeLessThan(40);
    });
  });
});
