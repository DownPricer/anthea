/** Formatage unifié des exercices et previews Hero. */

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
  'chest/triceps': { fr: 'Pecs/triceps', en: 'Chest/triceps', es: 'Pecho/tríceps' },
  'back/biceps': { fr: 'Dos/biceps', en: 'Back/biceps', es: 'Espalda/bíceps' },
  shoulders: { fr: 'Épaules', en: 'Shoulders', es: 'Hombros' },
  arms: { fr: 'Bras', en: 'Arms', es: 'Brazos' },
  'chest/back': { fr: 'Pecs/dos', en: 'Chest/back', es: 'Pecho/espalda' },
  legs: { fr: 'Jambes', en: 'Legs', es: 'Piernas' },
};

const PHASE_I18N = {
  'heavy phase with long rest': {
    fr: 'lourd · repos longs',
    en: 'heavy · long rest',
    es: 'pesado · descansos largos',
  },
  'lighter / slower phase': {
    fr: 'plus léger · tempo lent',
    en: 'lighter · slow tempo',
    es: 'más ligero · tempo lento',
  },
  'explosive phase': {
    fr: 'explosif',
    en: 'explosive',
    es: 'explosivo',
  },
};

function langKey(lang) {
  return (lang || 'fr').split('-')[0];
}

export function localizeMovement(movement, lang) {
  const key = String(movement || '').trim().toLowerCase();
  const labels = REF_MOVEMENT_I18N[key];
  if (labels) return labels[langKey(lang)] || labels.fr || movement;
  return movement;
}

export function localizePhase(phase, lang) {
  const key = String(phase || '').trim();
  const labels = PHASE_I18N[key];
  if (labels) return labels[langKey(lang)] || labels.fr || phase;
  return phase;
}

export function formatDurationSeconds(seconds, lang = 'fr') {
  const sec = Number(seconds);
  if (!sec || sec <= 0) return null;
  const mins = Math.round(sec / 60);
  if (mins < 1) return langKey(lang) === 'en' ? '<1 min' : langKey(lang) === 'es' ? '<1 min' : '<1 min';
  if (langKey(lang) === 'en') return `${mins} min`;
  if (langKey(lang) === 'es') return `${mins} min`;
  return `${mins} min`;
}

function formatPrescription(ex, lang) {
  const type = ex.exercise_type || 'reps';
  const duration = ex.duration ?? ex.duration_seconds;
  if (type === 'duration' && duration) {
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

export function formatHeroExerciseLine(ex, lang = 'fr') {
  const names = ex.name_i18n || {};
  const name = names[langKey(lang)] || names.fr || ex.name || ex.exercise_id || '';
  const prescription = formatPrescription(ex, lang);
  if (prescription) return `${name} · ${prescription}`;
  return name;
}

export function heroSeriesCount(challenge) {
  const exs = [...(challenge?.exercises || []), ...(challenge?.coda_exercises || [])];
  const sets = exs.map((e) => e.sets).filter((n) => n != null && n !== '');
  if (!sets.length) return null;
  return Math.max(...sets.map(Number));
}

export function heroMetaChips(challenge, t) {
  const chips = [];
  const type = challenge?.challenge_type;
  if (type) {
    chips.push(
      t(`challenges:hero.types.${type}`, {
        defaultValue: challenge?.format_label || type,
      })
    );
  }
  const durationMin = challenge?.duration_seconds
    ? Math.round(challenge.duration_seconds / 60)
    : null;
  if (durationMin) {
    chips.push(`${durationMin} min`);
  }
  if (type === 'rounds' && challenge?.rounds) {
    chips.push(t('challenges:hero.roundsChip', { count: challenge.rounds }));
  }
  const series = heroSeriesCount(challenge);
  if (type === 'structured' && series) {
    chips.push(t('challenges:hero.seriesChip', { count: series }));
  }
  return chips;
}

export function heroProgramPreviewLines(challenge, t, lang = 'fr') {
  const lines = [];
  const ctype = challenge?.challenge_type;
  const program = challenge?.program || {};

  if (ctype === 'program_reference' && program) {
    if (program.daily_duration_hint) {
      lines.push({ kind: 'meta', text: program.daily_duration_hint });
    }
    if (program.session_duration_hint) {
      lines.push({ kind: 'meta', text: program.session_duration_hint });
    }
    if (program.sessions_per_week) {
      lines.push({
        kind: 'meta',
        text: `${program.sessions_per_week} ${t('challenges:hero.programSessionsPerWeek').toLowerCase()}`,
      });
    }
    if ((program.split || []).length) {
      lines.push({
        kind: 'heading',
        text: t('challenges:hero.programSplit'),
      });
      (program.split || []).forEach((item) => {
        lines.push({ kind: 'bullet', text: localizeMovement(item, lang) });
      });
    }
    if ((program.phases || []).length) {
      lines.push({ kind: 'heading', text: t('challenges:hero.programPhases') });
      (program.phases || []).forEach((phase) => {
        lines.push({ kind: 'bullet', text: localizePhase(phase, lang) });
      });
    }
    if ((program.known_movements || []).length) {
      lines.push({ kind: 'heading', text: t('challenges:hero.programMovements') });
      (program.known_movements || []).forEach((mov) => {
        lines.push({ kind: 'bullet', text: localizeMovement(mov, lang) });
      });
    }
    if (program.days_per_week) {
      lines.push({
        kind: 'meta',
        text: `${program.days_per_week} ${t('challenges:hero.daysPerWeek')}`,
      });
    }
    (program.notes || []).slice(0, 2).forEach((note) => {
      lines.push({ kind: 'note', text: note });
    });
  }

  if (ctype === 'strength_reference') {
    lines.push({ kind: 'heading', text: t('challenges:hero.strengthRefHeading') });
    (challenge.strength_references || []).forEach((ref) => {
      const mov = localizeMovement(ref.movement, lang);
      const kg = ref.value_kg != null ? `${ref.value_kg} kg` : null;
      lines.push({ kind: 'bullet', text: kg ? `${mov} · ${kg}` : mov });
    });
    lines.push({ kind: 'disclaimer', text: t('challenges:hero.performanceReference') });
  }

  const benchRef = (challenge.strength_references || []).find((r) => r.movement === 'bench' && r.value_kg);
  if (ctype === 'program_reference' && benchRef?.value_kg) {
    lines.push({
      kind: 'note',
      text: t('challenges:hero.benchReferenceNote', { kg: benchRef.value_kg }),
    });
  }

  if (program.notes?.includes('progressive overload') || (program.notes || []).some((n) => /progressive/i.test(n))) {
    lines.push({ kind: 'note', text: t('challenges:hero.progressiveOverload') });
  }

  return lines;
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
