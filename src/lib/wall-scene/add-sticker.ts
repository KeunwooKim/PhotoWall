import { getStickerById } from "@/lib/stickers";
import { randomHomePlacementPosition } from "@/lib/wall-scene/wall-home-placement";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneSticker } from "@/types/wall-scene-v2";

export function addStickerToWallScene(
  stickerId: string,
  options: {
    wallWidth: number;
    wallHeight: number;
    position?: { x: number; y: number };
  },
): boolean {
  const definition = getStickerById(stickerId);
  if (!definition) return false;

  const width = definition.defaultWidth ?? definition.defaultSize ?? 64;
  const height = definition.defaultHeight ?? definition.defaultSize ?? 64;

  const fallback = randomHomePlacementPosition(options.wallWidth, options.wallHeight);
  const x = options.position?.x ?? fallback.x;
  const y = options.position?.y ?? fallback.y;

  const objects = useWallSceneStore.getState().document.objects;
  const maxZ = objects.reduce((max, object) => Math.max(max, object.zIndex), 0);

  const sticker: WallSceneSticker = {
    id: crypto.randomUUID(),
    type: "sticker",
    stickerId,
    x: x - width / 2,
    y: y - height / 2,
    rotation: options.position ? 0 : -12 + Math.random() * 24,
    scaleX: 1,
    scaleY: 1,
    zIndex: maxZ + 1,
    width,
    height,
  };

  useWallSceneStore.getState().recordHistory();
  useWallSceneStore.getState().upsertObject(sticker);
  useWallSceneStore.getState().setSelectedIds([sticker.id]);
  useWallSceneStore.getState().bumpRevision();
  return true;
}
