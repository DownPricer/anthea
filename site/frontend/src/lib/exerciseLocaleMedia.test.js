/**
 * Tests médias animés + localisation catalogue FR/EN/ES.
 */
import {
  FALLBACK_EXERCISE_IMAGE,
  handleExerciseImageError,
  resolveExerciseMediaUrl,
  resolveLocalMediaUrl,
  sanitizeExerciseForApi,
} from './exerciseMedia';
import {
  buildExerciseNameI18nSnapshot,
  getLocalizedExerciseField,
  normalizeExerciseLocale,
} from './exerciseLocale';
import { exerciseSecondaryLabel } from '../components/exercises/ExerciseMediaThumb';

describe('resolveExerciseMediaUrl', () => {
  it('keeps absolute https urls untouched', () => {
    const url = 'https://static.exercisedb.dev/media/2gPfomN.gif';
    expect(resolveExerciseMediaUrl(url)).toBe(url);
  });

  it('keeps http data and blob urls', () => {
    expect(resolveExerciseMediaUrl('http://static.exercisedb.dev/media/x.webp')).toBe(
      'http://static.exercisedb.dev/media/x.webp'
    );
    expect(resolveExerciseMediaUrl('data:image/gif;base64,abc')).toBe('data:image/gif;base64,abc');
    expect(resolveExerciseMediaUrl('blob:https://x/1')).toBe('blob:https://x/1');
  });

  it('never prefixes absolute urls with site origin or uploads', () => {
    const url = 'https://static.exercisedb.dev/media/x.gif';
    const resolved = resolveExerciseMediaUrl(url);
    expect(resolved).not.toContain('anthea');
    expect(resolved).not.toMatch(/^\/uploads\//);
    expect(resolved.startsWith('https://')).toBe(true);
  });

  it('resolves relative local media only', () => {
    expect(resolveLocalMediaUrl('/uploads/a.gif')).toBe('/uploads/a.gif');
    expect(resolveExerciseMediaUrl('uploads/a.gif')).toBe('/uploads/a.gif');
  });

  it('returns null for empty', () => {
    expect(resolveExerciseMediaUrl(null)).toBeNull();
    expect(resolveExerciseMediaUrl('')).toBeNull();
  });
});

describe('media error fallback without infinite loop', () => {
  it('applies fallback once', () => {
    const img = { dataset: {}, src: 'https://x/bad.gif' };
    const event = { currentTarget: img };
    handleExerciseImageError(event);
    expect(img.src).toBe(FALLBACK_EXERCISE_IMAGE);
    expect(img.dataset.fallbackApplied).toBe('1');
    const before = img.src;
    handleExerciseImageError(event);
    expect(img.src).toBe(before);
  });
});

describe('getLocalizedExerciseField', () => {
  const exercise = {
    name: 'Fallback name',
    provider_name: 'barbell bench press',
    name_i18n: {
      en: 'Barbell bench press',
      fr: 'Développé couché à la barre',
      es: 'Press de banca con barra',
    },
    description_i18n: {
      en: 'EN desc',
      fr: 'FR desc',
      es: 'ES desc',
    },
  };

  it('normalizes locale', () => {
    expect(normalizeExerciseLocale('fr-FR')).toBe('fr');
    expect(normalizeExerciseLocale('en-US')).toBe('en');
  });

  it('returns localized name per locale with english fallback', () => {
    expect(getLocalizedExerciseField(exercise, 'name', 'fr-FR')).toBe(
      'Développé couché à la barre'
    );
    expect(getLocalizedExerciseField(exercise, 'name', 'en-US')).toBe('Barbell bench press');
    expect(getLocalizedExerciseField(exercise, 'name', 'es-ES')).toBe(
      'Press de banca con barra'
    );
    expect(getLocalizedExerciseField({ name_i18n: { en: 'Only EN' } }, 'name', 'fr')).toBe(
      'Only EN'
    );
  });

  it('returns localized description', () => {
    expect(getLocalizedExerciseField(exercise, 'description', 'fr')).toBe('FR desc');
    expect(getLocalizedExerciseField(exercise, 'description', 'es')).toBe('ES desc');
  });

  it('does not translate custom exercises', () => {
    const custom = {
      source_kind: 'custom',
      name: 'Pont fessier',
      description: 'maison',
      name_i18n: { fr: 'NE PAS UTILISER', en: 'bridge' },
    };
    expect(getLocalizedExerciseField(custom, 'name', 'en')).toBe('Pont fessier');
    expect(getLocalizedExerciseField(custom, 'description', 'es')).toBe('maison');
  });

  it('uses exercise_name_i18n_snapshot in player context', () => {
    const snap = {
      exercise_name_snapshot: 'Développé couché à la barre',
      exercise_name_i18n_snapshot: {
        en: 'Barbell bench press',
        fr: 'Développé couché à la barre',
        es: 'Press de banca con barra',
      },
    };
    expect(getLocalizedExerciseField(snap, 'name', 'es')).toBe('Press de banca con barra');
  });

  it('builds multilingual snapshots for new sessions', () => {
    const snap = buildExerciseNameI18nSnapshot(exercise);
    expect(snap.fr).toContain('couché');
    expect(snap.en).toContain('bench');
    expect(snap.es).toContain('banca');
  });
});

describe('exerciseSecondaryLabel prefers translated labels', () => {
  it('uses equipment_labels and muscle_labels', () => {
    const label = exerciseSecondaryLabel({
      equipment: ['dumbbell'],
      equipment_labels: ['haltères'],
      primary_muscles: ['biceps'],
      muscle_labels: ['biceps'],
    });
    expect(label).toContain('haltères');
    expect(label).toContain('biceps');
  });
});

describe('CreateWorkoutPage / Player media + locale wiring (source)', () => {
  const fs = require('fs');
  const path = require('path');
  const createSrc = fs.readFileSync(
    path.join(__dirname, '../pages/CreateWorkoutPage.jsx'),
    'utf8'
  );
  const playerSrc = fs.readFileSync(
    path.join(__dirname, '../pages/WorkoutPlayerPage.jsx'),
    'utf8'
  );
  const thumbSrc = fs.readFileSync(
    path.join(__dirname, '../components/exercises/ExerciseMediaThumb.jsx'),
    'utf8'
  );

  it('uses getLocalizedExerciseField and i18n snapshots', () => {
    expect(createSrc).toContain('getLocalizedExerciseField');
    expect(createSrc).toContain('exercise_name_i18n_snapshot');
    expect(createSrc).toContain('customBadge');
  });

  it('library thumb has lazy loading referrerPolicy and error states', () => {
    expect(thumbSrc).toContain('referrerPolicy="no-referrer"');
    expect(thumbSrc).toContain("loading={eager ? 'eager' : 'lazy'}");
    expect(thumbSrc).toContain("setStatus('error')");
    expect(thumbSrc).toContain('prefers-reduced-motion');
    expect(thumbSrc).toContain('object-contain');
  });

  it('player resolves media_snapshot with object-contain and no-referrer', () => {
    expect(playerSrc).toContain('media_snapshot');
    expect(playerSrc).toContain('object-contain');
    expect(playerSrc).toContain('referrerPolicy="no-referrer"');
    expect(playerSrc).toContain('getLocalizedExerciseField');
    expect(playerSrc).toContain('resolveExerciseMediaUrl');
  });

  it('sanitizer still available', () => {
    expect(sanitizeExerciseForApi({ image_url: 'ok' }).image_url).toBe('ok');
  });
});

describe('i18n custom badge FR/EN/ES', () => {
  const fs = require('fs');
  const path = require('path');
  const locales = {
    fr: 'Exercice personnalisé',
    en: 'Custom exercise',
    es: 'Ejercicio personalizado',
  };
  Object.entries(locales).forEach(([lang, expected]) => {
    it(`customBadge in ${lang}`, () => {
      const json = JSON.parse(
        fs.readFileSync(path.join(__dirname, `../i18n/locales/${lang}/workouts.json`), 'utf8')
      );
      expect(json.create.customBadge).toBe(expected);
    });
  });
});
