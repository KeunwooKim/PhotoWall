import { getCachedHtmlImage, loadHtmlImage } from "@/lib/storage/load-html-image";
import { getCachedPhotoDisplayUrl } from "@/lib/storage/photo-display-cache";
import { countQuotaObjects } from "@/lib/wall-quotas";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneFourCut, WallScenePhoto } from "@/types/wall-scene-v2";
import { getFourCutSkin } from "./catalog";
import {
  aspectForFourCutBox,
  boxKeepCenter,
  canonicalFourCutWindows,
  explodeFourCutPlacement,
  fourCutBoxAspectClose,
  ensureFourCutBaseWindows,
  layoutFromAspect,
  resizeBoxKeepCenterArea,
} from "./layout";
import type {
  ApplyFourCutSkinResult,
  ExplodeFourCutResult,
  FourCutLayout,
  RelayoutFourCutResult,
} from "./types";

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
    const current = currentBox(photo);
    const base = photo.fourCut.base;
    const layout = base
      ? layoutFromAspect(base.width / Math.max(1, base.height))
      : photo.fourCut.layout;
    const box = base ? boxKeepCenter(current, base) : current;
    const next: WallScenePhoto = {
      ...photo,
      ...box,
      fourCut: ensureFourCutBaseWindows({
        layout,
        windows: photo.fourCut.windows,
        baseWindows: photo.fourCut.baseWindows,
      }),
    };
    commitPhoto(next);
    return "ok";
  }

  const skin = getFourCutSkin(skinId);
  if (!skin) return "unknown-skin";

  const base = originalBox(photo);
  const current = currentBox(photo);
  const currentAspect = current.width / Math.max(1, current.height);
  const targetAspect = aspectForFourCutBox(
    skin.layout,
    windowsUsable(photo.fourCut) ? photo.fourCut?.windows : undefined,
  );
  const needsRelayout =
    !photo.fourCut ||
    photo.fourCut.layout !== skin.layout ||
    !fourCutBoxAspectClose(currentAspect, targetAspect);
  const box = needsRelayout ? resizeBoxKeepCenterArea(current, targetAspect) : current;
  const size = windowsUsable(photo.fourCut) ? null : await naturalSourceSize(photo);

  let fourCut: WallSceneFourCut;
  if (windowsUsable(photo.fourCut) && photo.fourCut) {
    fourCut = ensureFourCutBaseWindows({
      layout: skin.layout,
      windows: photo.fourCut.windows,
      baseWindows: photo.fourCut.baseWindows,
      skinId: skin.id,
      base,
    });
  } else {
    if (!size) return "no-source-size";
    const windows = canonicalFourCutWindows(skin.layout, size.width, size.height);
    fourCut = {
      layout: skin.layout,
      windows,
      baseWindows: windows.map((window) => ({ ...window })) as WallSceneFourCut["windows"],
      skinId: skin.id,
      base,
    };
  }

  const next: WallScenePhoto = {
    ...photo,
    ...box,
    fourCut,
  };
  delete next.frameId;
  commitPhoto(next);
  return "ok";
}

export function relayoutFourCut(photoId: string, layout: FourCutLayout): RelayoutFourCutResult {
  const photo = photoById(photoId);
  if (!photo) return "not-photo";
  if (!windowsUsable(photo.fourCut) || !photo.fourCut) return "not-four-cut";

  const current = currentBox(photo);
  const targetAspect = aspectForFourCutBox(layout, photo.fourCut.windows);
  const currentAspect = current.width / Math.max(1, current.height);
  if (photo.fourCut.layout === layout && fourCutBoxAspectClose(currentAspect, targetAspect)) {
    return "ok";
  }

  const box = resizeBoxKeepCenterArea(current, targetAspect);
  const base = photo.fourCut.base ?? current;
  let skinId = photo.fourCut.skinId ?? null;
  if (skinId) {
    const skin = getFourCutSkin(skinId);
    if (!skin || skin.layout !== layout) skinId = null;
  }

  const fourCut: WallSceneFourCut = ensureFourCutBaseWindows({
    layout,
    windows: photo.fourCut.windows,
    baseWindows: photo.fourCut.baseWindows,
    base,
    skinId,
  });
  commitPhoto({ ...photo, ...box, fourCut });
  return "ok";
}

export async function explodeFourCut(
  photoId: string,
  options: { maxSceneObjects: number },
): Promise<ExplodeFourCutResult> {
  const photo = photoById(photoId);
  if (!photo) return "not-photo";
  if (!windowsUsable(photo.fourCut) || !photo.fourCut) return "not-four-cut";

  const store = useWallSceneStore.getState();
  const objects = store.document.objects;
  if (countQuotaObjects(objects) + 3 > options.maxSceneObjects) return "quota";

  const source = await naturalSourceSize(photo);
  const scaleFrom = photo.fourCut.base ?? currentBox(photo);
  const placements = explodeFourCutPlacement(
    currentBox(photo),
    photo.fourCut.windows,
    source ?? undefined,
    scaleFrom,
  );
  const maxZ = objects.reduce((max, item) => Math.max(max, item.zIndex), 0);
  const cells: WallScenePhoto[] = placements.map((place, index) => {
    const cell: WallScenePhoto = {
      id: crypto.randomUUID(),
      type: "photo",
      x: place.x,
      y: place.y,
      rotation: place.rotation,
      scaleX: 1,
      scaleY: 1,
      zIndex: maxZ + 1 + index,
      src: photo.src,
      width: place.width,
      height: place.height,
      crop: { ...photo.fourCut!.windows[index] },
    };
    if (photo.opacity != null) cell.opacity = photo.opacity;
    if (photo.source) cell.source = photo.source;
    return cell;
  });

  store.recordHistory();
  store.replaceObjects(
    [...objects.filter((item) => item.id !== photoId), ...cells],
    cells.map((cell) => cell.id),
  );
  store.bumpRevision();
  return "ok";
}

export async function clearFourCutSkin(photoId: string): Promise<ApplyFourCutSkinResult> {
  return applyFourCutSkin(photoId, null);
}
