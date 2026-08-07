// Binary attachment data (note images/voice recordings, the custom background
// image, the custom ambient sound) lives here instead of in the localStorage
// blob written by saveLocal — localStorage is capped around 5-10MB per site,
// which a handful of photos or a short recording blows past instantly.
// IndexedDB has a much larger quota and is built for this.
const DB_NAME = 'makinote_attachments';
const DB_VERSION = 1;
const STORE = 'blobs';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putAttachments(entries) {
  if (!entries.length) return;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      entries.forEach(([key, value]) => store.put(value, key));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error('[attachmentDb] putAttachments failed:', err);
  }
}

export async function deleteAttachments(keys) {
  if (!keys.length) return;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      keys.forEach((key) => store.delete(key));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error('[attachmentDb] deleteAttachments failed:', err);
  }
}

export async function getAllAttachments() {
  try {
    const db = await openDb();
    const map = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const result = new Map();
      const cursorReq = tx.objectStore(STORE).openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) { result.set(cursor.key, cursor.value); cursor.continue(); } else resolve(result);
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
    db.close();
    return map;
  } catch (err) {
    console.error('[attachmentDb] getAllAttachments failed:', err);
    return new Map();
  }
}

// Deletes any stored key not in validKeys, skipping keys under the
// `setting:` prefix (the background image / ambient sound, managed
// separately from per-note attachments and never subject to this prune).
export async function pruneOrphanAttachments(validKeys) {
  try {
    const db = await openDb();
    const allKeys = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    const toDelete = allKeys.filter((k) => !String(k).startsWith('setting:') && !validKeys.has(k));
    if (toDelete.length) await deleteAttachments(toDelete);
  } catch (err) {
    console.error('[attachmentDb] pruneOrphanAttachments failed:', err);
  }
}
