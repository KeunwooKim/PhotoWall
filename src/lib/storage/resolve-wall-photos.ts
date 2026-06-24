import { authFetch } from "@/lib/auth/api-fetch";
import {
  cachePhotoDisplayUrl,
  collectWallPhotoRefsFromScene,
  getCachedPhotoDisplayUrl,
} from "@/lib/storage/photo-display-cache";
import {
  applySignedUrlsToFabricJson,
  collectWallPhotoPaths,
  isWallPhotoRef,
  stripUnresolvedWallPhotoRefs,
  wallPhotoRefToPath,
} from "@/lib/storage/wall-photos";
import { packCanvasJson, unpackCanvasJson } from "@/lib/wall-canvas-json";
import { preloadHtmlImages, loadHtmlImage } from "@/lib/storage/load-html-image";
import type { WallSceneDocument } from "@/types/wall-scene-v2";

async function fetchSignedUrls(
  wallId: string,
  paths: string[],
): Promise<Record<string, string>> {
  const res = await authFetch(`/api/walls/${wallId}/signed-photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths }),
  });

  if (!res.ok) return {};

  const body = (await res.json()) as { signedUrls?: Record<string, string> };
  return body.signedUrls ?? {};
}

type SignedUrlBatch = {
  paths: Set<string>;
  waiters: Map<string, Array<(url: string | undefined) => void>>;
  scheduled: boolean;
};

const signedUrlBatches = new Map<string, SignedUrlBatch>();

async function flushSignedUrlBatch(wallId: string): Promise<void> {
  const batch = signedUrlBatches.get(wallId);
  if (!batch) return;

  signedUrlBatches.delete(wallId);
  const paths = [...batch.paths];
  const waiters = batch.waiters;

  let signedUrls: Record<string, string> = {};
  try {
    signedUrls = await fetchSignedUrls(wallId, paths);
  } catch {
    signedUrls = {};
  }

  for (const path of paths) {
    const signed = signedUrls[path];
    for (const resolve of waiters.get(path) ?? []) {
      resolve(signed);
    }
  }
}

function queueSignedUrl(wallId: string, path: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    let batch = signedUrlBatches.get(wallId);
    if (!batch) {
      batch = { paths: new Set(), waiters: new Map(), scheduled: false };
      signedUrlBatches.set(wallId, batch);
    }

    batch.paths.add(path);
    const list = batch.waiters.get(path) ?? [];
    list.push(resolve);
    batch.waiters.set(path, list);

    if (!batch.scheduled) {
      batch.scheduled = true;
      setTimeout(() => {
        void flushSignedUrlBatch(wallId);
      }, 32);
    }
  });
}

export async function resolveWallPhotoSrc(src: string, wallId: string): Promise<string> {
  if (!isWallPhotoRef(src)) return src;

  const cached = getCachedPhotoDisplayUrl(src);
  if (cached) return cached;

  const path = wallPhotoRefToPath(src);
  if (!path) return src;

  const signed = await queueSignedUrl(wallId, path);
  if (signed) {
    cachePhotoDisplayUrl(src, signed);
    void loadHtmlImage(signed);
    return signed;
  }

  return src;
}

export async function prefetchWallScenePhotoUrls(
  doc: WallSceneDocument,
  wallId: string,
): Promise<void> {
  const refs = collectWallPhotoRefsFromScene(doc.objects);
  const paths = refs
    .map((ref) => wallPhotoRefToPath(ref))
    .filter((path): path is string => !!path);

  if (paths.length === 0) return;

  const signedUrls = await fetchSignedUrls(wallId, paths);

  const displayUrls: string[] = [];
  for (const ref of refs) {
    const path = wallPhotoRefToPath(ref);
    if (path && signedUrls[path]) {
      cachePhotoDisplayUrl(ref, signedUrls[path]);
      displayUrls.push(signedUrls[path]);
    }
  }

  await preloadHtmlImages(displayUrls);
}

export async function resolveCanvasPhotoUrls(
  packedJson: object,
  wallId: string,
): Promise<object> {
  const { fabricJson, wallBounds } = unpackCanvasJson(packedJson);
  const paths = collectWallPhotoPaths(fabricJson);

  if (paths.length === 0) return packedJson;

  const signedUrls = await fetchSignedUrls(wallId, paths);

  if (Object.keys(signedUrls).length === 0) {
    const stripped = stripUnresolvedWallPhotoRefs(fabricJson);
    return packCanvasJson(stripped, wallBounds);
  }

  const resolvedFabric = applySignedUrlsToFabricJson(fabricJson, signedUrls);
  const cleanedFabric = stripUnresolvedWallPhotoRefs(resolvedFabric);

  return packCanvasJson(cleanedFabric, wallBounds);
}
