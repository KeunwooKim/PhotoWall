import type { WallBounds } from "@/lib/wall-bounds";
import type { WallSceneDocument, WallSceneObject } from "@/types/wall-scene-v2";

function sortForFingerprint(objects: WallSceneObject[]): WallSceneObject[] {
  return [...objects].sort((a, b) => a.id.localeCompare(b.id));
}

export function fingerprintSceneObjects(objects: WallSceneObject[]): string {
  return JSON.stringify(sortForFingerprint(objects));
}

/** Detect structural changes (add/remove/reorder) for realtime full sync. */
export function structuralSceneFingerprint(objects: WallSceneObject[]): string {
  return JSON.stringify(
    sortForFingerprint(objects).map((object) => {
      const base = { id: object.id, type: object.type, zIndex: object.zIndex };
      if (object.type === "photo") return { ...base, src: object.src };
      if (object.type === "sticker") return { ...base, stickerId: object.stickerId };
      if (object.type === "emoji") return { ...base, text: object.text };
      if (object.type === "tape") return { ...base, fill: object.fill };
      return base;
    }),
  );
}

export function fingerprintPersistableScene(doc: WallSceneDocument): string {
  return JSON.stringify({
    wallBounds: doc.meta.wallBounds satisfies WallBounds,
    objects: sortForFingerprint(doc.objects),
  });
}

export function sceneObjectsEqual(
  a: WallSceneObject[],
  b: WallSceneObject[],
): boolean {
  return fingerprintSceneObjects(a) === fingerprintSceneObjects(b);
}
