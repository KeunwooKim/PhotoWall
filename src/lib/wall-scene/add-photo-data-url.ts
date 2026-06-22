import { loadHtmlImage } from "@/lib/storage/load-html-image";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallScenePhoto } from "@/types/wall-scene-v2";

export async function addPhotoDataUrlToWallScene(
  dataUrl: string,
  options: {
    wallWidth: number;
    wallHeight: number;
    position?: { x: number; y: number };
  },
): Promise<void> {
  const { width: naturalW, height: naturalH } = await loadHtmlImage(dataUrl).then((img) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
  }));

  const maxWidth = Math.min(220, options.wallWidth * 0.35);
  const scale = Math.min(1, maxWidth / naturalW);
  const width = naturalW * scale;
  const height = naturalH * scale;

  const x =
    options.position?.x ??
    options.wallWidth * 0.2 + Math.random() * (options.wallWidth * 0.2);
  const y =
    options.position?.y ??
    options.wallHeight * 0.15 + Math.random() * (options.wallHeight * 0.2);

  const objects = useWallSceneStore.getState().document.objects;
  const maxZ = objects.reduce((max, object) => Math.max(max, object.zIndex), 0);

  const photo: WallScenePhoto = {
    id: crypto.randomUUID(),
    type: "photo",
    x: x - width / 2,
    y: y - height / 2,
    rotation: options.position ? 0 : -8 + Math.random() * 16,
    scaleX: 1,
    scaleY: 1,
    zIndex: maxZ + 1,
    src: dataUrl,
    width,
    height,
  };

  useWallSceneStore.getState().recordHistory();
  useWallSceneStore.getState().upsertObject(photo);
  useWallSceneStore.getState().setSelectedId(photo.id);
  useWallSceneStore.getState().bumpRevision();
}
