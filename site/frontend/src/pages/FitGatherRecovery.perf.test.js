/**
 * Couverture reprise auto, offline, wake lock, branding FitGather, perf Duo.
 */

import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');

describe('activity recovery & idempotence (source)', () => {
  const tracked = fs.readFileSync(
    path.join(root, 'components/player/TrackedActivityInPlayer.jsx'),
    'utf8',
  );
  const checkpoint = fs.readFileSync(
    path.join(root, 'lib/activities/activityCheckpoint.js'),
    'utf8',
  );
  const store = fs.readFileSync(
    path.join(root, 'lib/activities/activityStore.js'),
    'utf8',
  );
  const api = fs.readFileSync(path.join(root, 'lib/api.js'), 'utf8');
  const boot = fs.readFileSync(
    path.join(root, 'components/activities/ActivityBootRecovery.jsx'),
    'utf8',
  );
  const player = fs.readFileSync(path.join(root, 'pages/WorkoutPlayerPage.jsx'), 'utf8');
  const clock = fs.readFileSync(path.join(root, 'hooks/useActivityClock.js'), 'utf8');

  test('checkpoint interval is 10–15s', () => {
    expect(checkpoint).toContain('CHECKPOINT_INTERVAL_MS = 12000');
  });

  test('idempotency key helpers exist', () => {
    expect(checkpoint).toContain('activity:${activityId}:event:');
    expect(checkpoint).toContain('activity:${activityId}:lap:');
    expect(checkpoint).toContain('activity:${activityId}:route:');
  });

  test('TrackedActivityInPlayer has no conflict dialog', () => {
    expect(tracked).not.toContain('tracked-conflict-resume');
    expect(tracked).not.toContain('Une autre activité est déjà en cours');
    expect(tracked).toContain('redirectIfOtherExercise');
    expect(tracked).toContain('CHECKPOINT_INTERVAL_MS');
    expect(tracked).toContain('tracked-offline-save');
    expect(tracked).toContain('keepaliveMetricsCheckpoint');
    expect(tracked).toContain('pagehide');
  });

  test('ActivityBootRecovery restores without modal', () => {
    expect(boot).toContain('/player/');
    expect(boot).toContain('activityRestored');
    expect(boot).not.toContain('Dialog');
    expect(boot).not.toContain('confirm(');
  });

  test('api refreshes token with in-flight dedupe', () => {
    expect(api).toContain('/auth/refresh');
    expect(api).toContain('refreshInflight');
    expect(api).toContain('_retry');
  });

  test('clock recalculates on visibility/pageshow', () => {
    expect(clock).toContain('visibilitychange');
    expect(clock).toContain('pageshow');
    expect(clock).toContain('computeElapsed');
  });

  test('Player exposes keep-screen-awake toggle and wake lock', () => {
    expect(player).toContain('player-keep-screen-awake');
    expect(player).toContain('getKeepScreenAwakePref');
    expect(player).toContain('useWakeLock');
  });

  test('IndexedDB migrates from fitmatch_activities legacy name', () => {
    expect(store).toContain("DB_NAME = 'fitgather_activities'");
    expect(store).toContain("LEGACY_DB_NAME = 'fitmatch_activities'");
    expect(store).toContain('migrateLegacyIfNeeded');
  });

  test('mergeLocalAndServer helper present', () => {
    expect(checkpoint).toContain('export function mergeLocalAndServer');
  });
});

describe('DuoProfilePage load priority (source)', () => {
  const src = fs.readFileSync(path.join(root, 'pages/DuoProfilePage.jsx'), 'utf8');

  test('no full-screen spinner; uses header skeleton', () => {
    expect(src).not.toContain('min-h-screen flex items-center justify-center');
    expect(src).toContain('DuoHeaderSkeleton');
    expect(src).toContain('DuoStatsCardsSkeleton');
  });

  test('defers stats and activity; uses public stats endpoint only', () => {
    expect(src).toContain('scheduleSecondary');
    expect(src).toContain('duoProfilesApi.getStats');
    expect(src).not.toContain('duoApi.getStats');
    expect(src).toContain('activityRequested');
    expect(src).toContain('postsMounted');
    expect(src).toContain('dedupeInflight');
    expect(src).toContain('AbortController');
  });

  test('does not load GPS routes on profile', () => {
    expect(src).not.toContain('route_chunks');
    expect(src).not.toContain('include_route');
    expect(src).not.toContain('activity_route');
  });
});

describe('FitGather branding (source)', () => {
  test('manifest and HTML title are FitGather', () => {
    const manifest = fs.readFileSync(
      path.join(root, '../public/manifest.json'),
      'utf8',
    );
    const indexHtml = fs.readFileSync(path.join(root, '../public/index.html'), 'utf8');
    expect(manifest).toContain('"name": "FitGather"');
    expect(manifest).toContain('"short_name": "FitGather"');
    expect(indexHtml).toContain('<title>FitGather</title>');
    expect(manifest).not.toMatch(/FitMatch/i);
    expect(indexHtml).not.toMatch(/FitMatch/i);
  });

  test('FR/EN/ES brand strings are FitGather', () => {
    for (const locale of ['fr', 'en', 'es']) {
      const common = JSON.parse(
        fs.readFileSync(path.join(root, `i18n/locales/${locale}/common.json`), 'utf8'),
      );
      expect(common.app.brand).toBe('FitGather');
      expect(common.app.name).toBe('FitGather');
      const activity = JSON.parse(
        fs.readFileSync(path.join(root, `i18n/locales/${locale}/activity.json`), 'utf8'),
      );
      expect(activity.gps.webWarning).toMatch(/FitGather/);
      expect(activity.gps.webWarning).not.toMatch(/FitMatch/);
    }
  });

  test('no public FitMatch in i18n locales', () => {
    const localesDir = path.join(root, 'i18n/locales');
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (name.endsWith('.json')) {
          const text = fs.readFileSync(full, 'utf8');
          expect(text).not.toMatch(/FitMatch|FITMATCH/);
        }
      }
    };
    walk(localesDir);
  });

  test('push SW default title is FitGather', () => {
    const sw = fs.readFileSync(path.join(root, '../public/sw.js'), 'utf8');
    expect(sw).toContain("'FitGather'");
    expect(sw).not.toContain("'FitMatch'");
  });

  test('header and login display FitGather brand', () => {
    const nav = fs.readFileSync(path.join(root, 'components/layout/DesktopNav.jsx'), 'utf8');
    const login = fs.readFileSync(path.join(root, 'pages/LoginPage.jsx'), 'utf8');
    expect(nav).toContain('FitGather');
    expect(login).toContain('common:app.brand');
  });
});
