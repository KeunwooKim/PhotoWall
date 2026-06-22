import { parseWallScene, serializeWallScene } from "@/lib/wall-scene/fabric-import";
import type { WallScenePhoto } from "@/types/wall-scene-v2";

/** Append a guestbook photo to v2 scene (or migrate legacy Fabric JSON first). */
export function appendGuestbookPhoto(
  canvasJson: object,
  imageDataUrl: string,
  imageWidth: number,
  imageHeight: number,
): object {
  const doc = parseWallScene(canvasJson);
  const { wallBounds } = doc.meta;

  const maxWidth = Math.min(220, wallBounds.width * 0.35);
  const scale = Math.min(1, maxWidth / Math.max(imageWidth, imageHeight, 1));
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  const x = wallBounds.width * 0.2 + Math.random() * (wallBounds.width * 0.2);
  const y = wallBounds.height * 0.15 + Math.random() * (wallBounds.height * 0.2);
  const maxZ = doc.objects.reduce((max, object) => Math.max(max, object.zIndex), 0);

  const photo: WallScenePhoto = {
    id: crypto.randomUUID(),
    type: "photo",
    x: x - width / 2,
    y: y - height / 2,
    rotation: -8 + Math.random() * 16,
    scaleX: 1,
    scaleY: 1,
    zIndex: maxZ + 1,
    src: imageDataUrl,
    width,
    height,
  };

  return serializeWallScene({
    ...doc,
    meta: { ...doc.meta, revision: doc.meta.revision + 1 },
    objects: [...doc.objects, photo],
  });
}
