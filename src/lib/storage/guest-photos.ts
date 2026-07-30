import {
  guestPhotoRefToId,
  isGuestPhotoRef,
  toGuestPhotoRef,
} from "@/lib/storage/guest-photo-refs";

const DB_NAME = "photowall-guest-photos";
const DB_VERSION = 1;
const STORE = "blobs";

type GuestPhotoRecord = {
  id: string;
  blob: Blob;
  mime: string;
  createdAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function putGuestPhoto(file: Blob, mimeHint?: string): Promise<string> {
  const id = crypto.randomUUID();
  const mime = mimeHint || (file.type && file.type.startsWith("image/") ? file.type : "image/jpeg");
  const record: GuestPhotoRecord = {
    id,
    blob: file,
    mime,
    createdAt: new Date().toISOString(),
  };

  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await idbReq(tx.objectStore(STORE).put(record));
  } finally {
    db.close();
  }

  return toGuestPhotoRef(id);
}

export async function getGuestPhotoBlob(refOrId: string): Promise<Blob | null> {
  const id = isGuestPhotoRef(refOrId) ? guestPhotoRefToId(refOrId) : refOrId;
  if (!id) return null;

  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const record = await idbReq(tx.objectStore(STORE).get(id));
    return (record as GuestPhotoRecord | undefined)?.blob ?? null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function deleteGuestPhoto(refOrId: string): Promise<void> {
  const id = isGuestPhotoRef(refOrId) ? guestPhotoRefToId(refOrId) : refOrId;
  if (!id) return;

  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await idbReq(tx.objectStore(STORE).delete(id));
  } finally {
    db.close();
  }
}

export async function listGuestPhotoIds(): Promise<string[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const keys = await idbReq(tx.objectStore(STORE).getAllKeys());
    return keys.map(String);
  } catch {
    return [];
  } finally {
    db.close();
  }
}

/** Delete guest blobs not referenced by any of the given refs. */
export async function pruneOrphanGuestPhotos(keepRefs: Iterable<string>): Promise<void> {
  const keep = new Set<string>();
  for (const ref of keepRefs) {
    const id = guestPhotoRefToId(ref);
    if (id) keep.add(id);
  }

  const all = await listGuestPhotoIds();
  await Promise.all(all.filter((id) => !keep.has(id)).map((id) => deleteGuestPhoto(id)));
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || "image/jpeg";
  const isBase64 = !!match[2];
  const data = match[3];
  try {
    if (isBase64) {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(data)], { type: mime });
  } catch {
    return null;
  }
}
