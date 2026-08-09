// Periodic disaster-recovery snapshots, independent of the live synced
// notes -- if a sync bug ever wipes or corrupts the real data, these exist
// outside that data path entirely and can't be wiped by the same bug.
const DB_NAME = 'makinote_backups';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'snapshots'; // key: timestamp (ms), value: full backup payload
const META_STORE = 'meta'; // key: 'folderHandle' -> FileSystemDirectoryHandle

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE);
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSnapshot(payload) {
  const db = await openDb();
  const timestamp = Date.now();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
    tx.objectStore(SNAPSHOT_STORE).put(payload, timestamp);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return timestamp;
}

export async function pruneOldSnapshots(maxAgeMs) {
  const db = await openDb();
  const cutoff = Date.now() - maxAgeMs;
  const keysToDelete = await new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
    const req = tx.objectStore(SNAPSHOT_STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result.filter((k) => k < cutoff));
    req.onerror = () => reject(req.error);
  });
  if (keysToDelete.length) {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE);
      keysToDelete.forEach((k) => store.delete(k));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  db.close();
  return keysToDelete.length;
}

export async function listSnapshotTimestamps() {
  const db = await openDb();
  const keys = await new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
    const req = tx.objectStore(SNAPSHOT_STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return keys.sort((a, b) => b - a);
}

export async function getSnapshot(timestamp) {
  const db = await openDb();
  const payload = await new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
    const req = tx.objectStore(SNAPSHOT_STORE).get(timestamp);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return payload;
}

export async function saveFolderHandle(handle) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put(handle, 'folderHandle');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getFolderHandle() {
  const db = await openDb();
  const handle = await new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get('folderHandle');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return handle;
}

export async function clearFolderHandle() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).delete('folderHandle');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

const FILENAME_RE = /^makinote-backup-(\d+)\.json$/;

export async function writeFolderBackup(handle, timestamp, jsonString) {
  const fileHandle = await handle.getFileHandle(`makinote-backup-${timestamp}.json`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(jsonString);
  await writable.close();
}

export async function pruneFolderBackups(handle, maxAgeMs) {
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind !== 'file') continue;
    const match = name.match(FILENAME_RE);
    if (!match) continue;
    if (parseInt(match[1], 10) < cutoff) { await handle.removeEntry(name); removed++; }
  }
  return removed;
}
