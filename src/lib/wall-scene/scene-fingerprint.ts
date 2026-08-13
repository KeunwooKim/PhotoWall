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
      const base = {
        id: object.id,
        type: object.type,
        zIndex: object.zIndex,
        groupId: object.groupId ?? null,
      };
      if (object.type === "photo") {
        return {
          ...base,
          src: object.src,
          frameId: object.frameId ?? null,
        };
      }
      if (object.type === "sticker") return { ...base, stickerId: object.stickerId };
      if (object.type === "emoji") return { ...base, text: object.text };
      if (object.type === "text") {
        return {
          ...base,
          text: object.text,
          fontSize: object.fontSize,
          fontFamily: object.fontFamily,
          fill: object.fill,
        };
      }
      if (object.type === "tape") return { ...base, fill: object.fill };
      if (object.type === "path") {
        return {
          ...base,
          stroke: object.stroke,
          strokeWidth: object.strokeWidth,
          opacity: object.opacity,
          tool: object.tool ?? null,
          tapeEndStyle: object.tapeEndStyle ?? null,
          tapePattern: object.tapePattern ?? null,
          tapePatternAccent: object.tapePatternAccent ?? null,
        };
      }
      return base;
    }),
  );
}

export function fingerprintPersistableScene(doc: WallSceneDocument): string {
  return JSON.stringify({
    wallBounds: doc.meta.wallBounds,
    wallSizeLocked: !!doc.meta.wallSizeLocked,
    wallShrinkEnabled: !!doc.meta.wallShrinkEnabled,
    objects: sortForFingerprint(doc.objects),
  });
}

export function sceneObjectsEqual(
  a: WallSceneObject[],
  b: WallSceneObject[],
): boolean {
  return fingerprintSceneObjects(a) === fingerprintSceneObjects(b);
}
