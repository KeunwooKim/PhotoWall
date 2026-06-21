import type { WallBounds } from "@/lib/wall-bounds";
import type { WallSceneDocument, WallSceneObject } from "@/types/wall-scene-v2";

function sortForFingerprint(objects: WallSceneObject[]): WallSceneObject[] {
  return [...objects].sort((a, b) => a.id.localeCompare(b.id));
}

export function fingerprintSceneObjects(objects: WallSceneObject[]): string {
  return JSON.stringify(sortForFingerprint(objects));
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
