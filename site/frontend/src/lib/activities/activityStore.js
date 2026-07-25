/**
 * Stockage IndexedDB pour les activités en cours
 * NE PAS utiliser localStorage pour les coordonnées GPS
 */

const DB_NAME = 'fitmatch_activities';
const DB_VERSION = 1;
const STORE_ACTIVITY = 'active_activity';
const STORE_POINTS = 'pending_points';
const STORE_LAPS = 'pending_laps';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_ACTIVITY)) {
        db.createObjectStore(STORE_ACTIVITY, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_POINTS)) {
        const pointsStore = db.createObjectStore(STORE_POINTS, { autoIncrement: true });
        pointsStore.createIndex('activityId', 'activityId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_LAPS)) {
        const lapsStore = db.createObjectStore(STORE_LAPS, { autoIncrement: true });
        lapsStore.createIndex('activityId', 'activityId', { unique: false });
      }
    };
  });

  return dbPromise;
}

/**
 * Sauvegarde l'activité active
 */
export async function saveActiveActivity(activity) {
  const db = await openDB();
  const tx = db.transaction([STORE_ACTIVITY], 'readwrite');
  const store = tx.objectStore(STORE_ACTIVITY);
  
  await store.put({ ...activity, id: 'current' });
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Récupère l'activité active
 */
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

/**
 * Supprime l'activité active
 */
export async function clearActiveActivity() {
  const db = await openDB();
  const tx = db.transaction([STORE_ACTIVITY], 'readwrite');
  const store = tx.objectStore(STORE_ACTIVITY);
  
  await store.delete('current');
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Ajoute des points GPS en attente de sync
 */
export async function queuePoints(activityId, points) {
  if (!Array.isArray(points) || points.length === 0) return;

  const db = await openDB();
  const tx = db.transaction([STORE_POINTS], 'readwrite');
  const store = tx.objectStore(STORE_POINTS);

  for (const point of points) {
    store.add({ activityId, point, timestamp: Date.now() });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Récupère et supprime les points en attente
 */
export async function drainPoints(activityId) {
  const db = await openDB();
  const tx = db.transaction([STORE_POINTS], 'readwrite');
  const store = tx.objectStore(STORE_POINTS);
  const index = store.index('activityId');
  const request = index.getAll(activityId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const records = request.result || [];
      const points = records.map((r) => r.point);

      // Supprime les records
      const deletePromises = records.map(
        (r) =>
          new Promise((res, rej) => {
            const delReq = store.delete(r.id || r.timestamp);
            delReq.onsuccess = () => res();
            delReq.onerror = () => rej(delReq.error);
          })
      );

      Promise.all(deletePromises)
        .then(() => resolve(points))
        .catch(reject);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Ajoute des longueurs en attente de sync
 */
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

/**
 * Récupère et supprime les longueurs en attente
 */
export async function drainLaps(activityId) {
  const db = await openDB();
  const tx = db.transaction([STORE_LAPS], 'readwrite');
  const store = tx.objectStore(STORE_LAPS);
  const index = store.index('activityId');
  const request = index.getAll(activityId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const records = request.result || [];
      const laps = records.map((r) => r.lap);

      const deletePromises = records.map(
        (r) =>
          new Promise((res, rej) => {
            const delReq = store.delete(r.id || r.timestamp);
            delReq.onsuccess = () => res();
            delReq.onerror = () => rej(delReq.error);
          })
      );

      Promise.all(deletePromises)
        .then(() => resolve(laps))
        .catch(reject);
    };
    request.onerror = () => reject(request.error);
  });
}
