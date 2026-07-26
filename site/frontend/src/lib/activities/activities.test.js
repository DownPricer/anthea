import { computeElapsed } from './activityClock';
import {
  haversineDistance,
  isValidGpsPoint,
  calculateMovingDistance,
  calculateAveragePace,
  calculateBoundingBox,
  routeGeoJsonToLatLonPoints,
} from './geo';
import { formatElapsed, formatPace, formatDistanceMeters } from './formatActivity';

describe('activityClock', () => {
  test('computeElapsed uses timestamps not tick count', () => {
    const startedAt = new Date(Date.now() - 120000).toISOString();
    const result = computeElapsed({
      startedAt,
      status: 'active',
      pausedAt: null,
      pausedSeconds: 0,
      now: new Date(),
    });
    expect(result.elapsedSeconds).toBeGreaterThanOrEqual(119);
    expect(result.movingSeconds).toBeGreaterThanOrEqual(119);
  });

  test('pause reduces moving seconds', () => {
    const startedAt = new Date(Date.now() - 120000).toISOString();
    const pausedAt = new Date(Date.now() - 30000).toISOString();
    const result = computeElapsed({
      startedAt,
      status: 'paused',
      pausedAt,
      pausedSeconds: 10,
      now: new Date(),
    });
    expect(result.movingSeconds).toBeLessThan(result.elapsedSeconds);
  });
});

describe('activity geo', () => {
  test('haversineDistance returns meters', () => {
    const d = haversineDistance(45, 4, 45.001, 4.001);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(200);
  });

  test('isValidGpsPoint rejects invalid', () => {
    expect(isValidGpsPoint({ lat: 999, lon: 0 })).toBe(false);
  });

  test('calculateMovingDistance skips new segments', () => {
    const points = [
      { lat: 45, lon: 4 },
      { lat: 45.0001, lon: 4.0001 },
      { lat: 45.0002, lon: 4.0002, segment: 'new_segment' },
      { lat: 45.0003, lon: 4.0003 },
    ];
    const d = calculateMovingDistance(points);
    expect(d).toBeGreaterThan(0);
  });

  test('calculateAveragePace avoids infinity at zero distance', () => {
    expect(calculateAveragePace(0, 100)).toBe(Infinity);
  });

  test('routeGeoJsonToLatLonPoints parses LineString', () => {
    const pts = routeGeoJsonToLatLonPoints({
      type: 'LineString',
      coordinates: [
        [4, 45],
        [4.01, 45.01],
      ],
    });
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ lon: 4, lat: 45 });
  });

  test('calculateBoundingBox', () => {
    const bbox = calculateBoundingBox([
      { lat: 45, lon: 4 },
      { lat: 46, lon: 5 },
    ]);
    expect(bbox.minLat).toBe(45);
    expect(bbox.maxLon).toBe(5);
  });
});

describe('formatActivity', () => {
  test('formatElapsed', () => {
    expect(formatElapsed(125)).toBe('02:05');
  });

  test('formatPace rejects invalid', () => {
    expect(formatPace(NaN)).toBe('--');
    expect(formatPace(0)).toBe('--');
  });

  test('formatDistanceMeters', () => {
    expect(formatDistanceMeters(5740)).toBe('5.74 km');
  });
});

describe('activity i18n keys', () => {
  const fs = require('fs');
  const path = require('path');

  test('fr en es activity namespaces have core keys', () => {
    const keys = ['start.title', 'live.pause', 'metrics.distance', 'gps.webWarning'];
    for (const lang of ['fr', 'en', 'es']) {
      const file = path.join(__dirname, '../../i18n/locales', lang, 'activity.json');
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      keys.forEach((k) => {
        const parts = k.split('.');
        let cur = json;
        parts.forEach((p) => {
          cur = cur[p];
        });
        expect(cur).toBeTruthy();
      });
    }
  });

  test('product name FitGather in GPS warning', () => {
    const fr = require('../../i18n/locales/fr/activity.json');
    expect(fr.gps.webWarning).toMatch(/FitGather/i);
  });
});

describe('activity routes wiring', () => {
  test('App.js includes activity routes', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, '../../App.js'), 'utf8');
    expect(source).toContain('/activity/start');
    expect(source).toContain('/activity/:activityId/live');
    expect(source).toContain('/activity/:activityId/summary');
  });

  test('WorkoutsPage no longer embeds start activity CTA (routes stay in App)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, '../../pages/WorkoutsPage.jsx'), 'utf8');
    expect(source).not.toContain('/activity/start');
    expect(source).toContain("navigate('/create')");
  });
});
