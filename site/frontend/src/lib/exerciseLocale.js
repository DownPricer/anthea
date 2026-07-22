/**
 * Localisation unique des champs exercices (catalogue + customs).
 * Fallback : locale → en → provider_name → « Exercice »
 */

export function normalizeExerciseLocale(locale) {
  if (!locale) return 'fr';
  return String(locale).split('-')[0].toLowerCase();
}

export function getLocalizedExerciseField(exercise, field, locale = 'fr') {
  if (!exercise) {
    return field === 'name' ? 'Exercice' : '';
  }

  // Customs / legacy string fields — ne pas retraduire
  if (exercise.source_kind === 'custom' || exercise.legacy_label) {
    if (field === 'name') {
      return exercise.name || exercise.exercise_name_snapshot || 'Exercice';
    }
    if (field === 'description') return exercise.description || '';
    return exercise[field] ?? '';
  }

  const lang = normalizeExerciseLocale(locale);

  if (field === 'name') {
    const bags = [
      exercise.name_i18n,
      exercise.exercise_name_i18n_snapshot,
      typeof exercise.name === 'object' ? exercise.name : null,
    ].filter(Boolean);
    for (const bag of bags) {
      const value = bag[lang] || bag.en;
      if (value) return value;
    }
    return (
      exercise.exercise_name_snapshot ||
      exercise.provider_name ||
      (typeof exercise.name === 'string' ? exercise.name : null) ||
      'Exercice'
    );
  }

  if (field === 'description') {
    const bags = [
      exercise.description_i18n,
      typeof exercise.short_description === 'object' ? exercise.short_description : null,
      typeof exercise.description === 'object' ? exercise.description : null,
    ].filter(Boolean);
    for (const bag of bags) {
      const value = bag[lang] || bag.en;
      if (value) return value;
    }
    return typeof exercise.description === 'string' ? exercise.description : '';
  }

  if (exercise[field] && typeof exercise[field] === 'object') {
    const bag = exercise[field];
    return bag[lang] || bag.en || '';
  }
  return exercise[field] ?? '';
}

export function buildExerciseNameI18nSnapshot(exercise) {
  if (exercise?.name_i18n && typeof exercise.name_i18n === 'object') {
    return {
      en: exercise.name_i18n.en || exercise.provider_name || exercise.name || null,
      fr: exercise.name_i18n.fr || null,
      es: exercise.name_i18n.es || null,
    };
  }
  if (exercise?.exercise_name_i18n_snapshot && typeof exercise.exercise_name_i18n_snapshot === 'object') {
    return { ...exercise.exercise_name_i18n_snapshot };
  }
  return {
    en: exercise?.provider_name || exercise?.name || null,
    fr: typeof exercise?.name === 'string' ? exercise.name : null,
    es: null,
  };
}
