/** Formatage unifié des exercices et previews Hero (cartes compactes). */

const REF_MOVEMENT_I18N = {
  bench: { fr: 'Développé couché', en: 'Bench press', es: 'Press banca' },
  'barbell lunges': { fr: 'Fentes barre', en: 'Barbell lunges', es: 'Zancadas con barra' },
  squats: { fr: 'Squats', en: 'Squats', es: 'Sentadillas' },
  'leg press': { fr: 'Presse à cuisses', en: 'Leg press', es: 'Prensa de piernas' },
  presses: { fr: 'Presses', en: 'Presses', es: 'Presses' },
  'pull-ups': { fr: 'Tractions', en: 'Pull-ups', es: 'Dominadas' },
  pulldowns: { fr: 'Tirages', en: 'Pulldowns', es: 'Jalones' },
  rows: { fr: 'Rowings', en: 'Rows', es: 'Remos' },
  'hip thrust': { fr: 'Hip thrust', en: 'Hip thrust', es: 'Hip thrust' },
  deadlift: { fr: 'Deadlift', en: 'Deadlift', es: 'Peso muerto' },
  'one-arm pull-up': { fr: 'Traction à un bras', en: 'One-arm pull-up', es: 'Dominada a un brazo' },
  push: { fr: 'Push', en: 'Push', es: 'Push' },
  pull: { fr: 'Pull', en: 'Pull', es: 'Pull' },
  legs: { fr: 'Jambes', en: 'Legs', es: 'Piernas' },
};

const SPLIT_I18N = {
  'chest/triceps': { fr: 'Pecs / triceps', en: 'Chest / triceps', es: 'Pecho / tríceps' },
  'back/biceps': { fr: 'Dos / biceps', en: 'Back / biceps', es: 'Espalda / bíceps' },
  shoulders: { fr: 'Épaules', en: 'Shoulders', es: 'Hombros' },
  arms: { fr: 'Bras', en: 'Arms', es: 'Brazos' },
  'chest/back': { fr: 'Pecs / dos', en: 'Chest / back', es: 'Pecho / espalda' },
  legs: { fr: 'Jambes', en: 'Legs', es: 'Piernas' },
};

const CARD_PREVIEW_MAX = 4;

function langKey(lang) {
  return (lang || 'fr').split('-')[0];
}

export function localizeMovement(movement, lang) {
  const key = String(movement || '').trim().toLowerCase();
  const labels = REF_MOVEMENT_I18N[key];
  if (labels) return labels[langKey(lang)] || labels.fr || movement;
  const titled = String(movement || '').trim();
  if (!titled) return '';
  return titled.charAt(0).toUpperCase() + titled.slice(1);
}

function localizeSplitDay(day, lang) {
  const key = String(day || '').trim().toLowerCase();
  const labels = SPLIT_I18N[key];
  if (labels) return labels[langKey(lang)] || labels.fr || day;
  return localizeMovement(day, lang);
}

export function formatDurationSeconds(seconds, lang = 'fr') {
  const sec = Number(seconds);
  if (!sec || sec <= 0) return null;
  const mins = Math.round(sec / 60);
  if (mins < 1) {
    return langKey(lang) === 'en' ? '<1 min' : langKey(lang) === 'es' ? '<1 min' : '<1 min';
  }
  return `${mins} min`;
}

function formatPrescription(ex, lang) {
  const type = ex.exercise_type || 'reps';
  const duration = ex.duration ?? ex.duration_seconds;
  if (type === 'duration' && duration && ex.exercise_id !== 'hero:intervals-20-20') {
    return formatDurationSeconds(duration, lang);
  }
  const sets = ex.sets != null ? Number(ex.sets) : null;
  const reps = ex.reps != null ? Number(ex.reps) : null;
  const yards = ex.distance_yards != null ? Number(ex.distance_yards) : null;
  const perSide = Boolean(ex.per_side);

  let scheme = null;
  if (sets && yards) {
    scheme = `${sets}×${yards} yd`;
  } else if (sets && reps) {
    scheme = `${sets}×${reps}`;
  } else if (sets) {
    scheme = `${sets}×`;
  } else if (reps) {
    scheme = `${reps}`;
  }

  if (!scheme) return null;
  if (perSide) {
    const sideLabel = langKey(lang) === 'en' ? ' / side' : langKey(lang) === 'es' ? ' / lado' : ' / côté';
    return `${scheme}${sideLabel}`;
  }
  return scheme;
}

function compactExerciseName(ex, lang) {
  if (ex.exercise_id === 'hero:intervals-20-20') {
    if (langKey(lang) === 'en') return 'Bike intervals · 6×20 s / 20 s';
    if (langKey(lang) === 'es') return 'Intervalos bici · 6×20 s / 20 s';
    return 'Intervalles vélo · 6×20 s / 20 s';
  }
  if (ex.exercise_id === 'hero:unspecified-arm-shoulder-supersets') {
    if (langKey(lang) === 'en') return '2 arm/shoulder supersets';
    if (langKey(lang) === 'es') return '2 superseries brazos/hombros';
    return '2 supersets bras/épaules';
  }
  const names = ex.name_i18n || {};
  return names[langKey(lang)] || names.fr || ex.name || ex.exercise_id || '';
}

export function formatHeroExerciseLine(ex, lang = 'fr') {
  const name = compactExerciseName(ex, lang);
  const prescription = formatPrescription(ex, lang);
  if (prescription) return `${name} · ${prescription}`;
  return name;
}

function formatCodaLine(ex, lang) {
  const names = ex.name_i18n || {};
  return names[langKey(lang)] || names.fr || ex.name || ex.exercise_id || '';
}

export function heroSeriesCount(challenge) {
  const exs = [...(challenge?.exercises || []), ...(challenge?.coda_exercises || [])];
  const sets = exs.map((e) => e.sets).filter((n) => n != null && n !== '');
  if (!sets.length) return null;
  return Math.max(...sets.map(Number));
}

/** Chips compacts pour cartes — max 3, données programme dans les chips quand pertinent. */
export function heroCardMetaChips(challenge, t) {
  const chips = [];
  const type = challenge?.challenge_type;
  const program = challenge?.program || {};
  const id = challenge?.id;

  if (type) {
    chips.push(
      t(`challenges:hero.types.${type}`, {
        defaultValue: challenge?.format_label || type,
      })
    );
  }

  if (id === 'wolverine-hugh-jackman') {
    chips.push('≈ 1 h 30');
  } else if (id === 'superman-david-corenswet') {
    if (program.sessions_per_week) chips.push(`${program.sessions_per_week}× / semaine`);
    if (program.session_duration_hint) {
      chips.push(String(program.session_duration_hint).replace('~', '≈ '));
    }
  } else if (id === 'black-adam-dwayne-johnson' && program.days_per_week) {
    chips.push(t('challenges:hero.daysPerWeekChip', { count: program.days_per_week }));
  } else {
    const durationMin = challenge?.duration_seconds
      ? Math.round(challenge.duration_seconds / 60)
      : null;
    if (durationMin) chips.push(`${durationMin} min`);
    if (type === 'rounds' && challenge?.rounds) {
      chips.push(t('challenges:hero.roundsChip', { count: challenge.rounds }));
    }
    const series = heroSeriesCount(challenge);
    if (type === 'structured' && series) {
      chips.push(t('challenges:hero.seriesChip', { count: series }));
    }
  }

  return chips.slice(0, 3);
}

/** Sous-titre carte — simplifié pour références. */
export function heroCardSubtitle(challenge, t) {
  if (challenge?.challenge_type === 'strength_reference') {
    return t('challenges:hero.performanceRefSubtitle');
  }
  return challenge?.subtitle || challenge?.character_name || '';
}

/** Preview exercices playable — max 4 lignes + overflow. */
export function heroExercisePreviewLines(challenge, lang, t, maxVisible = CARD_PREVIEW_MAX) {
  const items = [
    ...(challenge?.exercises || []).map((ex) => ({ ex, isCoda: false })),
    ...(challenge?.coda_exercises || []).map((ex) => ({ ex, isCoda: true })),
  ];
  const formatted = items.map(({ ex, isCoda }) => ({
    text: isCoda ? formatCodaLine(ex, lang) : formatHeroExerciseLine(ex, lang),
    isCoda,
  }));
  return {
    lines: formatted.slice(0, maxVisible),
    overflow: Math.max(0, formatted.length - maxVisible),
    overflowLabel:
      formatted.length > maxVisible
        ? t('challenges:hero.moreExercises', { count: formatted.length - maxVisible })
        : null,
  };
}

/** Preview compacte pour programmes / repères de référence. */
export function heroCardReferencePreview(challenge, t, lang = 'fr') {
  const ctype = challenge?.challenge_type;
  const program = challenge?.program || {};
  const id = challenge?.id;

  if (ctype === 'strength_reference') {
    const lines = (challenge.strength_references || []).map((ref) => {
      const mov = localizeMovement(ref.movement, lang);
      return ref.value_kg != null ? `${mov} · ${ref.value_kg} kg` : mov;
    });
    return {
      lines,
      footnote: t('challenges:hero.referenceOnlyDisclaimer'),
    };
  }

  if (ctype !== 'program_reference') {
    return { lines: [], footnote: null };
  }

  if (id === 'wolverine-hugh-jackman') {
    return {
      lines: [
        t('challenges:hero.hughPhasesCompact'),
        ...(program.known_movements || []).map((m) => localizeMovement(m, lang)),
      ],
      footnote: t('challenges:hero.benchPublicRef', { kg: 143 }),
    };
  }

  if (id === 'superman-david-corenswet') {
    const splitLine = (program.split || [])
      .map((s) => localizeSplitDay(s, lang))
      .join(' · ');
    return {
      lines: [splitLine, ...(program.known_movements || []).map((m) => localizeMovement(m, lang))],
      footnote: t('challenges:hero.progressiveOverloadShort'),
    };
  }

  if (id === 'black-adam-dwayne-johnson') {
    const days = (program.split || []).slice(0, 4).map((d) => localizeSplitDay(d, lang));
    return {
      lines: days,
      footnote: t('challenges:hero.blackAdamFootnote'),
    };
  }

  const fallback = [
    ...(program.known_movements || []).slice(0, 4).map((m) => localizeMovement(m, lang)),
  ];
  return { lines: fallback, footnote: null };
}

// Alias conservé pour compatibilité tests existants — non utilisé par les cartes.
export function heroMetaChips(challenge, t) {
  return heroCardMetaChips(challenge, t);
}

export function heroProgramPreviewLines(challenge, t, lang = 'fr') {
  const ref = heroCardReferencePreview(challenge, t, lang);
  return [
    ...ref.lines.map((text) => ({ kind: 'line', text })),
    ...(ref.footnote ? [{ kind: 'note', text: ref.footnote }] : []),
  ];
}

export function buildReferenceDraftExercises(challenge, lang = 'fr') {
  const ctype = challenge?.challenge_type;
  const out = [];
  let order = 0;

  const pushExercise = (movement) => {
    const key = String(movement || '').trim().toLowerCase().replace(/\s+/g, '-');
    out.push({
      exercise_id: `hero:ref:${key}`,
      name: localizeMovement(movement, lang),
      exercise_type: 'reps',
      reps: null,
      sets: null,
      load: null,
      rest_after: 30,
      order,
      tts_enabled: true,
      unspecified: true,
    });
    order += 1;
  };

  if (ctype === 'strength_reference') {
    (challenge.strength_references || []).forEach((ref) => {
      if (ref.movement) pushExercise(ref.movement);
    });
  } else if (ctype === 'program_reference') {
    (challenge.program?.known_movements || []).forEach((mov) => pushExercise(mov));
  }

  return out;
}

export function buildReferenceDraftBlocks(challenge, lang = 'fr') {
  const exercises = buildReferenceDraftExercises(challenge, lang);
  if (!exercises.length) return [];
  return [{ block_type: 'main', expanded: true, exercises }];
}
