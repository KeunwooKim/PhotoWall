import {
  DEFAULT_WALL_BOUNDS,
  clampWallBounds,
  type WallBounds,
} from "@/lib/wall-bounds";

const PHOTOWALL_KEY = "photowall";

export interface PhotoWallMeta {
  version: 1;
  wallBounds: WallBounds;
}

export function packCanvasJson(fabricJson: object, wallBounds: WallBounds): object {
  return {
    ...fabricJson,
    [PHOTOWALL_KEY]: {
      version: 1,
      wallBounds: clampWallBounds(wallBounds),
    } satisfies PhotoWallMeta,
  };
}

export function unpackCanvasJson(json: object): {
  fabricJson: object;
  wallBounds: WallBounds;
} {
  const record = json as Record<string, unknown>;
  const meta = record[PHOTOWALL_KEY] as PhotoWallMeta | undefined;

  if (meta?.wallBounds?.width && meta?.wallBounds?.height) {
    const fabricJson = { ...record };
    delete fabricJson[PHOTOWALL_KEY];
    return {
      fabricJson,
      wallBounds: clampWallBounds(meta.wallBounds),
    };
  }

  const legacyWidth = typeof record.width === "number" ? record.width : null;
  const legacyHeight = typeof record.height === "number" ? record.height : null;

  return {
    fabricJson: json,
    wallBounds: clampWallBounds({
      width: legacyWidth ?? DEFAULT_WALL_BOUNDS.width,
      height: legacyHeight ?? DEFAULT_WALL_BOUNDS.height,
    }),
  };
}
