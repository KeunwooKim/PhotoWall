export const WALL_PHOTOS_BUCKET = "wall-photos";
export const WALL_PHOTO_REF_PREFIX = "wall-photo://";

type FabricObjectJson = {
  type?: string;
  src?: string;
  objects?: FabricObjectJson[];
};

export function toWallPhotoRef(storagePath: string): string {
  return `${WALL_PHOTO_REF_PREFIX}${storagePath}`;
}

export function isWallPhotoRef(src: string): boolean {
  return src.startsWith(WALL_PHOTO_REF_PREFIX);
}

export function wallPhotoRefToPath(ref: string): string | null {
  if (!isWallPhotoRef(ref)) return null;
  const path = ref.slice(WALL_PHOTO_REF_PREFIX.length).trim();
  return path.length > 0 ? path : null;
}

/** public 또는 signed Supabase Storage URL에서 object path 추출 */
export function extractWallPhotoPathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;

  const rest = url.slice(idx + marker.length);
  const withoutAccess = rest.replace(/^(public|sign|authenticated)\//, "");
  if (!withoutAccess.startsWith(`${WALL_PHOTOS_BUCKET}/`)) return null;

  const path = withoutAccess.slice(WALL_PHOTOS_BUCKET.length + 1).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

export function normalizeImageSrcForStorage(src: string): string {
  if (isWallPhotoRef(src)) return src;

  const fromUrl = extractWallPhotoPathFromUrl(src);
  if (fromUrl) return toWallPhotoRef(fromUrl);

  return src;
}

function walkFabricObjects(
  objects: FabricObjectJson[],
  visit: (obj: FabricObjectJson) => void,
): void {
  for (const obj of objects) {
    visit(obj);
    if (Array.isArray(obj.objects)) {
      walkFabricObjects(obj.objects, visit);
    }
  }
}

export function collectWallPhotoPaths(fabricJson: object): string[] {
  const record = fabricJson as Record<string, unknown>;
  const objects = record.objects;
  if (!Array.isArray(objects)) return [];

  const paths = new Set<string>();

  walkFabricObjects(objects as FabricObjectJson[], (obj) => {
    if (obj.type !== "Image" || typeof obj.src !== "string") return;

    const fromRef = wallPhotoRefToPath(obj.src);
    if (fromRef) {
      paths.add(fromRef);
      return;
    }

    const fromUrl = extractWallPhotoPathFromUrl(obj.src);
    if (fromUrl) paths.add(fromUrl);
  });

  return [...paths];
}

/** Collect storage paths from packed canvas_json (v2 scene or legacy Fabric). */
export function collectWallPhotoPathsFromCanvas(canvasJson: unknown): string[] {
  if (!canvasJson || typeof canvasJson !== "object") return [];

  const record = canvasJson as Record<string, unknown>;

  const scene =
    record.photowallScene && typeof record.photowallScene === "object"
      ? (record.photowallScene as Record<string, unknown>)
      : record;

  if (Array.isArray(scene.objects)) {
    const paths = new Set<string>();
    for (const raw of scene.objects) {
      if (!raw || typeof raw !== "object") continue;
      const obj = raw as { type?: string; src?: string };
      if (
        (obj.type === "photo" || obj.type === "Image") &&
        typeof obj.src === "string"
      ) {
        const fromRef = wallPhotoRefToPath(obj.src);
        if (fromRef) paths.add(fromRef);
        else {
          const fromUrl = extractWallPhotoPathFromUrl(obj.src);
          if (fromUrl) paths.add(fromUrl);
        }
      }
    }
    if (paths.size > 0) return [...paths];
  }

  return collectWallPhotoPaths(canvasJson as object);
}

function mapFabricObjects(
  objects: FabricObjectJson[],
  mapSrc: (src: string) => string,
): FabricObjectJson[] {
  return objects.map((obj) => {
    if (Array.isArray(obj.objects)) {
      return { ...obj, objects: mapFabricObjects(obj.objects, mapSrc) };
    }

    if (obj.type === "Image" && typeof obj.src === "string") {
      return { ...obj, src: mapSrc(obj.src) };
    }

    return obj;
  });
}

export function normalizeFabricJsonForStorage(fabricJson: object): object {
  const record = fabricJson as Record<string, unknown>;
  const objects = record.objects;
  if (!Array.isArray(objects)) return fabricJson;

  return {
    ...record,
    objects: mapFabricObjects(objects as FabricObjectJson[], normalizeImageSrcForStorage),
  };
}

export function applySignedUrlsToFabricJson(
  fabricJson: object,
  signedByPath: Record<string, string>,
): object {
  const record = fabricJson as Record<string, unknown>;
  const objects = record.objects;
  if (!Array.isArray(objects)) return fabricJson;

  const mapSrc = (src: string): string => {
    const refPath = wallPhotoRefToPath(src);
    if (refPath && signedByPath[refPath]) return signedByPath[refPath];

    const urlPath = extractWallPhotoPathFromUrl(src);
    if (urlPath && signedByPath[urlPath]) return signedByPath[urlPath];

    return src;
  };

  return {
    ...record,
    objects: mapFabricObjects(objects as FabricObjectJson[], mapSrc),
  };
}

export function stripUnresolvedWallPhotoRefs(fabricJson: object): object {
  const record = fabricJson as Record<string, unknown>;
  const objects = record.objects;
  if (!Array.isArray(objects)) return fabricJson;

  const filterObjects = (items: FabricObjectJson[]): FabricObjectJson[] => {
    const kept: FabricObjectJson[] = [];

    for (const obj of items) {
      if (Array.isArray(obj.objects)) {
        kept.push({ ...obj, objects: filterObjects(obj.objects) });
        continue;
      }

      if (obj.type === "Image" && typeof obj.src === "string" && isWallPhotoRef(obj.src)) {
        continue;
      }

      kept.push(obj);
    }

    return kept;
  };

  return {
    ...record,
    objects: filterObjects(objects as FabricObjectJson[]),
  };
}

export function isOwnWallPhotoPath(path: string, userId: string): boolean {
  return path.split("/")[0] === userId;
}

export function allPathsOwnedByUser(paths: string[], userId: string): boolean {
  return paths.length > 0 && paths.every((path) => isOwnWallPhotoPath(path, userId));
}

/** Loose UUID shape (hex + dashes) — avoid rejecting valid crypto.randomUUID() edge cases. */
const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHOTO_FILE_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|webp|gif)$/i;

/**
 * Storage layout from upload-photo: `{userId}/{uuid}.{ext}`
 * Also allows preview paths:
 * - `{userId}/previews/{wallId}.jpg` (legacy)
 * - `{userId}/previews/{wallId}-{timestamp}.jpg` (cache-busting revisions)
 * Rejects traversal / odd shapes used for IDOR probes.
 */
export function isSafeWallPhotoStoragePath(path: string): boolean {
  if (!path || path.includes("..") || path.includes("//") || path.startsWith("/")) {
    return false;
  }
  const parts = path.split("/");
  if (parts.length === 2) {
    return UUID_LIKE.test(parts[0]) && PHOTO_FILE_LIKE.test(parts[1]);
  }
  if (parts.length === 3 && parts[1] === "previews") {
    const file = parts[2];
    if (!/\.jpe?g$/i.test(file)) return false;
    const stem = file.replace(/\.jpe?g$/i, "");
    // legacy: wallId.jpg  |  revision: wallId-1712345678901.jpg
    const m = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-\d+)?$/i.exec(
      stem,
    );
    return !!m && UUID_LIKE.test(parts[0]);
  }
  return false;
}
