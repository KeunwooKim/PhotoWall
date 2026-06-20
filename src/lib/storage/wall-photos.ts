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
