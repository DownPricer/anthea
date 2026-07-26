/**
 * Stockage IndexedDB pour les activités en cours
 * NE PAS utiliser localStorage pour les coordonnées GPS
 * Migration douce fitmatch_activities → fitgather_activities
 */

const LEGACY_DB_NAME = 'fitmatch_activities';
const DB_NAME = 'fitgather_activities';
const DB_VERSION = 2;
const STORE_ACTIVITY = 'active_activity';
const STORE_POINTS = 'pending_points';
const STORE_LAPS = 'pending_laps';
const STORE_CHECKPOINTS = 'pending_checkpoints';

let dbPromise = null;
let migrated = false;

async function copyStore(fromDb, toDb, storeName) {
  if (!fromDb.objectStoreNames.contains(storeName) || !toDb.objectStoreNames.contains(storeName)) {
    return;
  }
  const readTx = fromDb.transaction([storeName], 'readonly');
  const writeTx = toDb.transaction([storeName], 'readwrite');
  const fromStore = readTx.objectStore(storeName);
  const toStore = writeTx.objectStore(storeName);
  const all = await new Promise((resolve, reject) => {
    const req = fromStore.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  for (const row of all) {
    try {
      toStore.put(row);
    } catch {
      /* ignore row */
    }
  }
  await new Promise((resolve, reject) => {
    writeTx.oncomplete = () => resolve();
    writeTx.onerror = () => reject(writeTx.error);
  });
}

function openNamedDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_ACTIVITY)) {
        db.createObjectStore(STORE_ACTIVITY, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_POINTS)) {
        const pointsStore = db.createObjectStore(STORE_POINTS, {
          keyPath: 'qid',
          autoIncrement: true,
        });
        pointsStore.createIndex('activityId', 'activityId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_LAPS)) {
        const lapsStore = db.createObjectStore(STORE_LAPS, {
          keyPath: 'qid',
          autoIncrement: true,
        });
        lapsStore.createIndex('activityId', 'activityId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CHECKPOINTS)) {
        const cpStore = db.createObjectStore(STORE_CHECKPOINTS, {
          keyPath: 'qid',
          autoIncrement: true,
        });
        cpStore.createIndex('activityId', 'activityId', { unique: false });
      }
    };
  });
}

async function migrateLegacyIfNeeded(newDb) {
  if (migrated) return;
  migrated = true;
  try {
    const legacyExists = await new Promise((resolve) => {
      const req = indexedDB.open(LEGACY_DB_NAME);
      req.onsuccess = () => {
        const db = req.result;
        const has = db.objectStoreNames.contains(STORE_ACTIVITY);
        db.close();
        resolve(has);
      };
      req.onerror = () => resolve(false);
    });
    if (!legacyExists) return;

    const legacy = await openNamedDB(LEGACY_DB_NAME, 2).catch(() => null);
    if (!legacy) return;

    // Ne migrer que si la nouvelle DB n'a pas encore d'activité active
    const existing = await new Promise((resolve) => {
      try {
        const tx = newDb.transaction([STORE_ACTIVITY], 'readonly');
        const req = tx.objectStore(STORE_ACTIVITY).get('current');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    if (!existing) {
      await copyStore(legacy, newDb, STORE_ACTIVITY);
      await copyStore(legacy, newDb, STORE_POINTS);
      await copyStore(legacy, newDb, STORE_LAPS);
      if (legacy.objectStoreNames.contains(STORE_CHECKPOINTS)) {
        await copyStore(legacy, newDb, STORE_CHECKPOINTS);
      }
    }
    legacy.close();
  } catch {
    /* migration best-effort */
  }
}

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const db = await openNamedDB(DB_NAME, DB_VERSION);
    await migrateLegacyIfNeeded(db);
    return db;
  })();

  return dbPromise;
}

function drainByActivityId(storeName, activityId, mapFn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const index = store.index('activityId');
        const request = index.getAll(activityId);
        let items = [];
        request.onsuccess = () => {
          const records = request.result || [];
          items = records.map(mapFn);
          records.forEach((r) => {
            if (r.qid != null) store.delete(r.qid);
          });
        };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve(items);
        tx.onerror = () => reject(tx.error);
      }),
  );
}

/**
 * Sauvegarde l'activité active (snapshot local enrichi)
 */
export async function saveActiveActivity(activity) {
  const db = await openDB();
  const tx = db.transaction([STORE_ACTIVITY], 'readwrite');
  const store = tx.objectStore(STORE_ACTIVITY);
  const payload = {
    ...activity,
    id: 'current',
    activity_id: activity.activity_id || activity.id,
    updated_at: activity.updated_at || new Date().toISOString(),
  };
  // Ne pas écraser activity_id réel avec 'current'
  if (payload.activity_id === 'current' && activity.id && activity.id !== 'current') {
    payload.activity_id = activity.id;
  }
  store.put(payload);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getActiveActivity() {
  const db = await openDB();
  const tx = db.transaction([STORE_ACTIVITY], 'readonly');
  const store = tx.objectStore(STORE_ACTIVITY);
  const request = store.get('current');

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function clearActiveActivity() {
  const db = await openDB();
  const tx = db.transaction([STORE_ACTIVITY], 'readwrite');
  const store = tx.objectStore(STORE_ACTIVITY);
  store.delete('current');

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function queuePoints(activityId, points) {
  if (!Array.isArray(points) || points.length === 0) return;

  const db = await openDB();
  const tx = db.transaction([STORE_POINTS], 'readwrite');
  const store = tx.objectStore(STORE_POINTS);

  for (const point of points) {
    store.add({
      activityId,
      point: {
        ...point,
        idempotency_key:
          point.idempotency_key ||
          `activity:${activityId}:route:${point.timestamp}-${point.lat ?? point.latitude}-${point.lon ?? point.longitude}`,
      },
      timestamp: Date.now(),
    });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function drainPoints(activityId) {
  return drainByActivityId(STORE_POINTS, activityId, (r) => r.point);
}

export async function queueLaps(activityId, laps) {
  if (!Array.isArray(laps) || laps.length === 0) return;

  const db = await openDB();
  const tx = db.transaction([STORE_LAPS], 'readwrite');
  const store = tx.objectStore(STORE_LAPS);

  for (const lap of laps) {
    store.add({ activityId, lap, timestamp: Date.now() });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function drainLaps(activityId) {
  return drainByActivityId(STORE_LAPS, activityId, (r) => r.lap);
}

export async function queueCheckpoint(activityId, checkpoint) {
  if (!activityId || !checkpoint) return;
  const db = await openDB();
  const tx = db.transaction([STORE_CHECKPOINTS], 'readwrite');
  const store = tx.objectStore(STORE_CHECKPOINTS);
  store.add({
    activityId,
    ...checkpoint,
    timestamp: checkpoint.timestamp || Date.now(),
  });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function drainCheckpoints(activityId) {
  return drainByActivityId(STORE_CHECKPOINTS, activityId, (r) => ({
    kind: r.kind,
    payload: r.payload,
    event_id: r.event_id,
    timestamp: r.timestamp,
  }));
}

/** Préférence wake lock (défaut: activé) */
const WAKE_PREF_KEY = 'anthea_keep_screen_awake';
const GPS_TIP_KEY = 'anthea_gps_keep_open_tip_seen';

export function getKeepScreenAwakePref() {
  try {
    const v = localStorage.getItem(WAKE_PREF_KEY);
    if (v === null) return true;
    return v === '1' || v === 'true';
  } catch {
    return true;
  }
}

export function setKeepScreenAwakePref(enabled) {
  try {
    localStorage.setItem(WAKE_PREF_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function hasSeenGpsKeepOpenTip() {
  try {
    return localStorage.getItem(GPS_TIP_KEY) === '1';
  } catch {
    return false;
  }
}

export function markGpsKeepOpenTipSeen() {
  try {
    localStorage.setItem(GPS_TIP_KEY, '1');
  } catch {
    /* ignore */
  }
}
