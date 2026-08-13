import { getCachedHtmlImage, loadHtmlImage } from "@/lib/storage/load-html-image";
import { getCachedPhotoDisplayUrl } from "@/lib/storage/photo-display-cache";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { FourCutLayout, WallSceneFourCut, WallScenePhoto } from "@/types/wall-scene-v2";
import { getFourCutSkin } from "./catalog";
import { canonicalFourCutWindows } from "./layout";
import type { ApplyFourCutSkinResult } from "./types";

function photoById(photoId: string): WallScenePhoto | null {
  const object = useWallSceneStore.getState().document.objects.find((item) => item.id === photoId);
  if (!object || object.type !== "photo") return null;
  return object;
}

function commitPhoto(next: WallScenePhoto): void {
  const store = useWallSceneStore.getState();
  store.recordHistory();
  store.upsertObject(next);
  store.bumpRevision();
}

function resizeToAspect(photo: WallScenePhoto, aspect: number): { x: number; y: number; width: number; height: number } {
  const area = Math.max(1, photo.width * photo.height);
  const height = Math.sqrt(area / Math.max(0.05, aspect));
  const width = height * aspect;
  const cx = photo.x + photo.width / 2;
  const cy = photo.y + photo.height / 2;
  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
  };
}

function displaySrcFor(photo: WallScenePhoto): string {
  return getCachedPhotoDisplayUrl(photo.src) ?? photo.src;
}

async function naturalSourceSize(
  photo: WallScenePhoto,
): Promise<{ width: number; height: number } | null> {
  const src = displaySrcFor(photo);
  try {
    const img = getCachedHtmlImage(src) ?? (await loadHtmlImage(src));
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (width < 8 || height < 8) return null;
    return { width, height };
  } catch {
    return null;
  }
}

function windowsMatchLayout(photo: WallScenePhoto, layout: FourCutLayout): boolean {
  const fourCut = photo.fourCut;
  if (!fourCut || fourCut.layout !== layout || fourCut.windows.length !== 4) return false;
  return fourCut.windows.every((window) => window.width > 1 && window.height > 1);
}

export async function applyFourCutSkin(
  photoId: string,
  skinId: string | null,
): Promise<ApplyFourCutSkinResult> {
  const photo = photoById(photoId);
  if (!photo) return "not-photo";

  if (!skinId) {
    if (!photo.fourCut) return "ok";
    const next: WallScenePhoto = {
      ...photo,
      fourCut: { ...photo.fourCut, skinId: null },
    };
    commitPhoto(next);
    return "ok";
  }

  const skin = getFourCutSkin(skinId);
  if (!skin) return "unknown-skin";

  let fourCut: WallSceneFourCut;
  if (windowsMatchLayout(photo, skin.layout) && photo.fourCut) {
    fourCut = { ...photo.fourCut, skinId: skin.id };
  } else {
    const size = await naturalSourceSize(photo);
    if (!size) return "no-source-size";
    fourCut = {
      layout: skin.layout,
      windows: canonicalFourCutWindows(skin.layout, size.width, size.height),
      skinId: skin.id,
    };
  }

  const box = resizeToAspect(photo, skin.aspect);
  const next: WallScenePhoto = {
    ...photo,
    ...box,
    fourCut,
  };
  delete next.frameId;
  commitPhoto(next);
  return "ok";
}

export async function clearFourCutSkin(photoId: string): Promise<ApplyFourCutSkinResult> {
  return applyFourCutSkin(photoId, null);
}
