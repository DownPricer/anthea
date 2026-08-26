import fs from 'fs';
import path from 'path';
import {
  formatHeroExerciseLine,
  buildReferenceDraftBlocks,
  heroCardMetaChips,
  heroCardReferencePreview,
  heroCardSubtitle,
  heroExercisePreviewLines,
} from './heroExerciseFormat';

describe('heroExerciseFormat', () => {
  const simuBike = {
    exercise_id: 'hero:bike',
    name_i18n: { fr: 'Vélo', en: 'Bike' },
    exercise_type: 'duration',
    duration: 300,
  };
  const trapBar = {
    exercise_id: 'hero:trap-bar-deadlift-bands',
    name_i18n: { fr: 'Trap-bar deadlift avec bandes', en: 'Trap-bar deadlift with bands' },
    exercise_type: 'reps',
    sets: 5,
    reps: 5,
  };
  const sled = {
    exercise_id: 'hero:sled-sprint',
    name_i18n: { fr: 'Traîneau + sprint', en: 'Sled + sprint' },
    sets: 5,
    reps: 1,
    distance_yards: 20,
  };
  const medBall = {
    exercise_id: 'hero:med-ball-slam',
    name_i18n: { fr: 'Med-ball slam', en: 'Med-ball slam' },
    sets: 3,
    reps: 5,
    per_side: true,
  };

  const t = (key, opts = {}) => {
    const map = {
      'challenges:hero.types.structured': 'Structuré',
      'challenges:hero.types.program_reference': 'Programme',
      'challenges:hero.types.strength_reference': 'Repères',
      'challenges:hero.seriesChip': `${opts.count} séries`,
      'challenges:hero.roundsChip': `${opts.count} tours`,
      'challenges:hero.moreExercises': `+ ${opts.count} exercices`,
      'challenges:hero.performanceRefSubtitle': 'Performances de référence',
      'challenges:hero.referenceOnlyDisclaimer': 'Références uniquement · charges non recommandées',
      'challenges:hero.hughPhasesCompact': 'Lourd / tempo lent / explosif',
      'challenges:hero.benchPublicRef': `Bench public : ${opts.kg} kg · référence uniquement`,
      'challenges:hero.progressiveOverloadShort': 'Progression par surcharge progressive',
      'challenges:hero.blackAdamFootnote': 'Musculation + cardio · giant sets documentés',
      'challenges:hero.daysPerWeekChip': `${opts.count} j / semaine`,
    };
    return map[key] || key;
  };

  test('formats bike duration', () => {
    expect(formatHeroExerciseLine(simuBike, 'fr')).toBe('Vélo · 5 min');
  });

  test('formats sets x reps', () => {
    expect(formatHeroExerciseLine(trapBar, 'fr')).toBe('Trap-bar deadlift avec bandes · 5×5');
  });

  test('formats sled distance', () => {
    expect(formatHeroExerciseLine(sled, 'fr')).toBe('Traîneau + sprint · 5×20 yd');
  });

  test('formats per side', () => {
    expect(formatHeroExerciseLine(medBall, 'fr')).toBe('Med-ball slam · 3×5 / côté');
  });

  test('formats wonder woman interval and superset compactly', () => {
    expect(
      formatHeroExerciseLine(
        {
          exercise_id: 'hero:intervals-20-20',
          name_i18n: { fr: '6 tours : 20 s fort / 20 s repos' },
          exercise_type: 'duration',
          sets: 6,
          duration: 20,
        },
        'fr'
      )
    ).toBe('Intervalles vélo · 6×20 s / 20 s');
    expect(
      formatHeroExerciseLine(
        {
          exercise_id: 'hero:unspecified-arm-shoulder-supersets',
          name_i18n: { fr: '2 supersets bras/épaules — détails non précisés' },
        },
        'fr'
      )
    ).toBe('2 supersets bras/épaules');
  });

  test('reference draft never prefills loads', () => {
    const brie = {
      challenge_type: 'strength_reference',
      strength_references: [
        { movement: 'hip thrust', value_kg: 181 },
        { movement: 'deadlift', value_kg: 91 },
      ],
    };
    const blocks = buildReferenceDraftBlocks(brie, 'fr');
    expect(blocks[0].exercises).toHaveLength(2);
    blocks[0].exercises.forEach((ex) => {
      expect(ex.load).toBeNull();
      expect(ex.sets).toBeNull();
      expect(ex.reps).toBeNull();
    });
  });

  test('brie reference preview is compact without duplicate heading or yellow box', () => {
    const preview = heroCardReferencePreview(
      {
        id: 'captain-marvel-brie-larson',
        challenge_type: 'strength_reference',
        strength_references: [
          { movement: 'hip thrust', value_kg: 181 },
          { movement: 'deadlift', value_kg: 91 },
          { movement: 'one-arm pull-up' },
        ],
      },
      t,
      'fr'
    );
    expect(preview.lines).toEqual([
      'Hip thrust · 181 kg',
      'Deadlift · 91 kg',
      'Traction à un bras',
    ]);
    expect(preview.footnote).toBe('Références uniquement · charges non recommandées');
    expect(heroCardSubtitle({ challenge_type: 'strength_reference' }, t)).toBe(
      'Performances de référence'
    );
  });

  test('david preview has no raw english program notes', () => {
    const preview = heroCardReferencePreview(
      {
        id: 'superman-david-corenswet',
        challenge_type: 'program_reference',
        program: {
          split: ['Push', 'Pull', 'Legs'],
          sessions_per_week: '3-4',
          session_duration_hint: '~2h',
          known_movements: ['presses', 'pull-ups', 'pulldowns', 'rows'],
          notes: ['progressive overload', 'no exact sets/reps in provided data'],
        },
      },
      t,
      'fr'
    );
    expect(preview.lines[0]).toBe('Push · Pull · Jambes');
    expect(preview.footnote).toBe('Progression par surcharge progressive');
    expect(JSON.stringify(preview)).not.toMatch(/progressive overload/i);
    expect(JSON.stringify(preview)).not.toMatch(/no exact sets/i);
  });

  test('black adam preview avoids raw english notes', () => {
    const preview = heroCardReferencePreview(
      {
        id: 'black-adam-dwayne-johnson',
        challenge_type: 'program_reference',
        program: {
          days_per_week: 6,
          split: ['chest/triceps', 'back/biceps', 'shoulders', 'arms', 'chest/back', 'legs'],
          notes: ['lifting + daily cardio', 'chest/triceps giant sets of 4 exercises — exact exercises not provided'],
        },
      },
      t,
      'fr'
    );
    expect(preview.lines).toHaveLength(4);
    expect(preview.footnote).toBe('Musculation + cardio · giant sets documentés');
    expect(JSON.stringify(preview)).not.toMatch(/lifting \+ daily cardio/i);
  });

  test('exercise preview caps at four lines with overflow', () => {
    const simu = {
      exercises: [
        simuBike,
        trapBar,
        { exercise_id: 'a', name_i18n: { fr: 'Box jumps' }, sets: 5, reps: 5 },
        sled,
        medBall,
        { exercise_id: 'b', name_i18n: { fr: 'Tirage vertical' }, sets: 3, reps: 15 },
      ],
    };
    const preview = heroExercisePreviewLines(simu, 'fr', t);
    expect(preview.lines).toHaveLength(4);
    expect(preview.overflow).toBe(2);
    expect(preview.overflowLabel).toBe('+ 2 exercices');
  });

  test('meta chips include structured series count', () => {
    const chips = heroCardMetaChips(
      {
        challenge_type: 'structured',
        exercises: [{ sets: 5, reps: 5 }],
      },
      t
    );
    expect(chips).toContain('Structuré');
    expect(chips).toContain('5 séries');
  });
});

describe('hero card compact layout', () => {
  const cardSrc = fs.readFileSync(
    path.join(__dirname, '../components/hero/HeroChallengeCard.jsx'),
    'utf8'
  );
  const createSrc = fs.readFileSync(
    path.join(__dirname, '../pages/CreateWorkoutPage.jsx'),
    'utf8'
  );

  test('avoids stretch layout responsible for vertical gaps', () => {
    expect(cardSrc).not.toMatch(/\bh-full\b/);
    expect(cardSrc).not.toMatch(/\bflex-1\b/);
    expect(cardSrc).not.toMatch(/\bmt-auto\b/);
    expect(createSrc).toContain('sm:items-start');
    expect(createSrc).not.toContain('sm:items-stretch');
  });

  test('keeps train CTA', () => {
    expect(cardSrc).toContain('startWorkout');
    expect(cardSrc).toContain('hero-card-cta');
  });
});
