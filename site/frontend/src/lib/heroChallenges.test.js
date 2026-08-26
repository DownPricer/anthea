import fs from 'fs';
import path from 'path';
import { fetchHeroCatalog, clearHeroChallengesCache, heroPlayerKind } from './heroChallenges';

describe('heroChallenges helpers', () => {
  beforeEach(() => clearHeroChallengesCache());

  it('caches a single catalog fetch', async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return { challenges: [{ id: 'spider-man-tom-holland' }] };
    };
    const a = await fetchHeroCatalog(loader);
    const b = await fetchHeroCatalog(loader);
    expect(calls).toBe(1);
    expect(a).toBe(b);
  });

  it('keeps classic player unless source is hero_challenge', () => {
    expect(heroPlayerKind({ source_type: 'template' })).toBeNull();
    expect(
      heroPlayerKind({
        source_type: 'hero_challenge',
        hero_challenge_snapshot: { challenge_type: 'amrap' },
      })
    ).toBe('amrap');
  });
});

describe('create workout UX + hero surfaces', () => {
  const createSrc = fs.readFileSync(
    path.join(__dirname, '../pages/CreateWorkoutPage.jsx'),
    'utf8'
  );
  const playerSrc = fs.readFileSync(
    path.join(__dirname, '../pages/WorkoutPlayerPage.jsx'),
    'utf8'
  );
  const amrapSrc = fs.readFileSync(
    path.join(__dirname, '../components/hero/HeroAmrapPlayer.jsx'),
    'utf8'
  );
  const resultSrc = fs.readFileSync(
    path.join(__dirname, '../components/hero/HeroResultScreen.jsx'),
    'utf8'
  );
  const postSrc = fs.readFileSync(
    path.join(__dirname, '../components/hero/HeroPostCard.jsx'),
    'utf8'
  );
  const css = fs.readFileSync(path.join(__dirname, '../index.css'), 'utf8');

  it('places template icon in the header next to save', () => {
    const header = createSrc.slice(
      createSrc.indexOf('<header'),
      createSrc.indexOf('</header>')
    );
    expect(header).toContain('open-templates-btn');
    expect(header).toContain('Library');
    expect(header).toContain('saveDraftTitle');
    expect(createSrc).not.toMatch(/h-14 w-14 shrink-0[\s\S]*open-templates-btn/);
  });

  it('aligns the time clock control', () => {
    expect(createSrc).toContain('workout-time-input');
    expect(createSrc).toContain('absolute left-3 top-1/2');
    expect(createSrc).toContain('pl-10');
    expect(css).toContain('workout-time-input');
    expect(css).toContain('::-webkit-calendar-picker-indicator');
  });

  it('adds hero tab without mixing template delete', () => {
    expect(createSrc).toContain('templates-tab-hero');
    expect(createSrc).toContain('templates-tab-mine');
    expect(createSrc).toContain('HeroChallengeCard');
  });

  it('uses a hero player extension and keeps classic completion', () => {
    expect(playerSrc).toContain('HeroAmrapPlayer');
    expect(amrapSrc).toContain('hero-plus-round');
    expect(playerSrc).toContain('completeCurrentExercise');
    expect(playerSrc).toContain("source_type === 'hero_challenge'");
  });

  it('adds themed launch, result and post surfaces', () => {
    expect(amrapSrc).toContain('hero-launch-screen');
    expect(amrapSrc).toContain('hero-launch-button');
    expect(amrapSrc).toContain('resolveExerciseMediaUrl');
    expect(playerSrc).toContain('HeroThemePattern');
    expect(resultSrc).toContain('goalMissed');
    expect(resultSrc).toContain('publishSession');
    expect(resultSrc).toContain('newBadge');
    expect(postSrc).toContain('badgeUnlocked');
    expect(postSrc).toContain('resolveHeroThemeId');
    expect(postSrc).not.toMatch(/\|\|\s*20/);
  });
});
