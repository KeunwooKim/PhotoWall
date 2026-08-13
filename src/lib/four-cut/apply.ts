import { getCachedHtmlImage, loadHtmlImage } from "@/lib/storage/load-html-image";
import { getCachedPhotoDisplayUrl } from "@/lib/storage/photo-display-cache";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneFourCut, WallScenePhoto } from "@/types/wall-scene-v2";
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

function currentBox(photo: WallScenePhoto): { x: number; y: number; width: number; height: number } {
  return { x: photo.x, y: photo.y, width: photo.width, height: photo.height };
}

function windowsUsable(fourCut: WallSceneFourCut | undefined): boolean {
  if (!fourCut || fourCut.windows.length !== 4) return false;
  return fourCut.windows.every((window) => window.width > 1 && window.height > 1);
}

/** Size before any theme. Never inferred by shrinking a themed box. */
function originalBox(photo: WallScenePhoto): { x: number; y: number; width: number; height: number } {
  if (photo.fourCut?.base) return photo.fourCut.base;
  return currentBox(photo);
}

export async function applyFourCutSkin(
  photoId: string,
  skinId: string | null,
): Promise<ApplyFourCutSkinResult> {
  const photo = photoById(photoId);
  if (!photo) return "not-photo";

  if (!skinId) {
    if (!photo.fourCut) return "ok";
    const box = originalBox(photo);
    const next: WallScenePhoto = {
      ...photo,
      ...box,
      fourCut: { layout: photo.fourCut.layout, windows: photo.fourCut.windows },
    };
    commitPhoto(next);
    return "ok";
  }

  const skin = getFourCutSkin(skinId);
  if (!skin) return "unknown-skin";

  const base = originalBox(photo);
  const size = windowsUsable(photo.fourCut) ? null : await naturalSourceSize(photo);

  let fourCut: WallSceneFourCut;
  if (windowsUsable(photo.fourCut) && photo.fourCut) {
    fourCut = {
      layout: skin.layout,
      windows: photo.fourCut.windows,
      skinId: skin.id,
      base,
    };
  } else {
    if (!size) return "no-source-size";
    fourCut = {
      layout: skin.layout,
      windows: canonicalFourCutWindows(skin.layout, size.width, size.height),
      skinId: skin.id,
      base,
    };
  }

  const next: WallScenePhoto = {
    ...photo,
    ...base,
    fourCut,
  };
  delete next.frameId;
  commitPhoto(next);
  return "ok";
}

export async function clearFourCutSkin(photoId: string): Promise<ApplyFourCutSkinResult> {
  return applyFourCutSkin(photoId, null);
}
