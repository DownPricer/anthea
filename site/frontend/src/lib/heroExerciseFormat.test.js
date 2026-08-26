import {
  formatHeroExerciseLine,
  buildReferenceDraftBlocks,
  heroMetaChips,
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

  test('meta chips include structured series count', () => {
    const t = (key, opts) => {
      if (key.endsWith('types.structured')) return 'Structuré';
      if (key.endsWith('seriesChip')) return `${opts.count} séries`;
      return key;
    };
    const chips = heroMetaChips(
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
