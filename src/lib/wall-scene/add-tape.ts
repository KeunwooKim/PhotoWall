import { randomHomePlacementPosition } from "@/lib/wall-scene/wall-home-placement";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneTape } from "@/types/wall-scene-v2";

export function addTapeToWallScene(
  color: string,
  options: {
    wallWidth: number;
    wallHeight: number;
    position?: { x: number; y: number };
  },
): void {
  const width = 140;
  const height = 28;

  const fallback = randomHomePlacementPosition(options.wallWidth, options.wallHeight);
  const x = options.position?.x ?? fallback.x;
  const y = options.position?.y ?? fallback.y;

  const objects = useWallSceneStore.getState().document.objects;
  const maxZ = objects.reduce((max, object) => Math.max(max, object.zIndex), 0);

  const tape: WallSceneTape = {
    id: crypto.randomUUID(),
    type: "tape",
    x: x - width / 2,
    y: y - height / 2,
    rotation: options.position ? 0 : -4 + Math.random() * 8,
    scaleX: 1,
    scaleY: 1,
    zIndex: maxZ + 1,
    opacity: 0.75,
    width,
    height,
    fill: color,
  };

  useWallSceneStore.getState().recordHistory();
  useWallSceneStore.getState().upsertObject(tape);
  useWallSceneStore.getState().setSelectedIds([tape.id]);
  useWallSceneStore.getState().bumpRevision();
}
