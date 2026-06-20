import { authFetch } from "@/lib/auth/api-fetch";
import {
  applySignedUrlsToFabricJson,
  collectWallPhotoPaths,
  isWallPhotoRef,
  stripUnresolvedWallPhotoRefs,
  wallPhotoRefToPath,
} from "@/lib/storage/wall-photos";
import { packCanvasJson, unpackCanvasJson } from "@/lib/wall-canvas-json";

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

export async function resolveWallPhotoSrc(src: string, wallId: string): Promise<string> {
  if (!isWallPhotoRef(src)) return src;

  const path = wallPhotoRefToPath(src);
  if (!path) return src;

  const signedUrls = await fetchSignedUrls(wallId, [path]);
  return signedUrls[path] ?? src;
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
