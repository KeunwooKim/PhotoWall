import type {
  WallSceneDocument,
  WallSceneEnvelope,
  WallSceneObject,
  WallSceneObjectType,
} from "@/types/wall-scene-v2";

export type UserPlan = "free" | "premium";

export interface WallQuota {
  maxOwnedSharedWalls: number;
  maxSceneBytes: number;
  maxSceneObjects: number;
  /** Per-file upload limit for wall photos */
  maxPhotoBytes: number;
}

/** Free defaults; `premium` plan is shown in UI as 플러스. */
export const WALL_QUOTAS: Record<UserPlan, WallQuota> = {
  free: {
    maxOwnedSharedWalls: 1,
    maxSceneBytes: 2 * 1024 * 1024,
    maxSceneObjects: 80,
    maxPhotoBytes: 5 * 1024 * 1024,
  },
  premium: {
    maxOwnedSharedWalls: 5,
    maxSceneBytes: 5 * 1024 * 1024,
    maxSceneObjects: 200,
    maxPhotoBytes: 12 * 1024 * 1024,
  },
};

export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** UI label — never say "프리미엄" in product copy. */
export const PLAN_UI_NAME: Record<UserPlan, string> = {
  free: "기본",
  premium: "플러스",
};

/**
 * Object types that count toward maxSceneObjects.
 * Excluded (unlimited by count; still limited by scene bytes): path, emoji, stamp tape.
 */
export const QUOTA_COUNTED_OBJECT_TYPES: readonly WallSceneObjectType[] = [
  "photo",
  "sticker",
  "text",
  "svg",
] as const;

export function isQuotaCountedObject(
  object: Pick<WallSceneObject, "type"> | WallSceneObjectType | null | undefined,
): boolean {
  if (object == null) return false;
  const type = typeof object === "string" ? object : object.type;
  return (QUOTA_COUNTED_OBJECT_TYPES as readonly string[]).includes(type);
}

export function countQuotaObjects(
  objects: ReadonlyArray<Pick<WallSceneObject, "type">>,
): number {
  return objects.reduce((n, object) => n + (isQuotaCountedObject(object) ? 1 : 0), 0);
}

/** Show usage chrome at or above this ratio of any quota. */
export const QUOTA_WARN_RATIO = 0.7;

export function getWallQuota(plan: UserPlan): WallQuota {
  return WALL_QUOTAS[plan];
}

function sceneObjectsFromCanvasJson(canvasJson: unknown): unknown[] {
  if (!canvasJson || typeof canvasJson !== "object") return [];
  const env = canvasJson as WallSceneEnvelope;
  if (env.photowallScene?.objects && Array.isArray(env.photowallScene.objects)) {
    return env.photowallScene.objects;
  }
  if (Array.isArray(env.objects)) return env.objects;
  return [];
}

/** Total objects (admin / diagnostics). */
export function countSceneObjects(canvasJson: unknown): number {
  return sceneObjectsFromCanvasJson(canvasJson).length;
}

/** Objects that consume the item-count quota. */
export function countQuotaSceneObjects(canvasJson: unknown): number {
  return countQuotaObjects(
    sceneObjectsFromCanvasJson(canvasJson).filter(
      (object): object is Pick<WallSceneObject, "type"> =>
        !!object && typeof object === "object" && "type" in object,
    ) as Pick<WallSceneObject, "type">[],
  );
}

export function measureSceneBytes(canvasJson: unknown): number {
  return new TextEncoder().encode(JSON.stringify(canvasJson)).length;
}

export type SceneQuotaViolation = "too_large" | "too_many_objects";

export function checkSceneQuota(
  canvasJson: unknown,
  plan: UserPlan,
): SceneQuotaViolation | null {
  const quota = getWallQuota(plan);
  if (measureSceneBytes(canvasJson) > quota.maxSceneBytes) return "too_large";
  if (countQuotaSceneObjects(canvasJson) > quota.maxSceneObjects) return "too_many_objects";
  return null;
}

export function sceneQuotaMessage(violation: SceneQuotaViolation): string {
  if (violation === "too_large") {
    return "개발 단계에서 벽 용량 제한을 넘었어요. 사진·스티커를 조금 줄여 주세요";
  }
  return "개발 단계에서 사진·스티커·텍스트 개수 제한을 넘었어요. 일부 항목을 지워 주세요";
}

export function formatBytesShort(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)}MB`;
}

export interface SceneUsage {
  objectCount: number;
  maxObjects: number;
  objectRatio: number;
  sceneBytes: number;
  maxBytes: number;
  byteRatio: number;
  /** Near or over either limit — show chrome */
  showHint: boolean;
  atObjectLimit: boolean;
  atByteLimit: boolean;
  nearObjectLimit: boolean;
  nearByteLimit: boolean;
}

export function getSceneUsage(
  objectCount: number,
  sceneBytes: number,
  plan: UserPlan,
): SceneUsage {
  const quota = getWallQuota(plan);
  const objectRatio = objectCount / quota.maxSceneObjects;
  const byteRatio = sceneBytes / quota.maxSceneBytes;
  const nearObjectLimit = objectRatio >= QUOTA_WARN_RATIO;
  const nearByteLimit = byteRatio >= QUOTA_WARN_RATIO;
  const atObjectLimit = objectCount >= quota.maxSceneObjects;
  const atByteLimit = sceneBytes >= quota.maxSceneBytes;

  return {
    objectCount,
    maxObjects: quota.maxSceneObjects,
    objectRatio,
    sceneBytes,
    maxBytes: quota.maxSceneBytes,
    byteRatio,
    showHint: nearObjectLimit || nearByteLimit || atObjectLimit || atByteLimit,
    atObjectLimit,
    atByteLimit,
    nearObjectLimit,
    nearByteLimit,
  };
}

export function getDocumentSceneUsage(
  document: WallSceneDocument,
  serialize: (doc: WallSceneDocument) => object,
  plan: UserPlan,
): SceneUsage {
  const json = serialize(document);
  return getSceneUsage(countQuotaObjects(document.objects), measureSceneBytes(json), plan);
}

export function objectLimitReachedMessage(usage: SceneUsage): string {
  return `개발 단계에서 사진·스티커·텍스트 개수 제한을 넘었어요 (${usage.objectCount}/${usage.maxObjects}). 일부 항목을 지워 주세요`;
}

export function quotaHintDetail(usage: SceneUsage, _plan: UserPlan): string {
  if (usage.atObjectLimit) {
    return "개발 단계에서 사진·스티커·텍스트 개수 제한을 넘었어요";
  }
  if (usage.atByteLimit) {
    return "개발 단계에서 용량 제한을 넘었어요";
  }
  return "개발 단계에서 공간이 거의 찼어요";
}

export type PhotoUploadViolation = "too_large" | "invalid_type";

export function checkPhotoUpload(
  file: { size: number; type: string },
  plan: UserPlan,
): PhotoUploadViolation | null {
  const type = file.type.toLowerCase();
  if (
    type &&
    !ALLOWED_PHOTO_MIME_TYPES.includes(type as (typeof ALLOWED_PHOTO_MIME_TYPES)[number])
  ) {
    return "invalid_type";
  }
  // Some browsers leave type empty — allow and rely on size only
  if (file.size > getWallQuota(plan).maxPhotoBytes) return "too_large";
  return null;
}

export function photoUploadMessage(
  violation: PhotoUploadViolation,
  plan: UserPlan,
): string {
  if (violation === "invalid_type") {
    return "JPG, PNG, WEBP, GIF만 올릴 수 있어요";
  }
  const maxMb = Math.round(getWallQuota(plan).maxPhotoBytes / (1024 * 1024));
  return `개발 단계에서는 사진을 ${maxMb}MB까지 올릴 수 있어요`;
}

export class PhotoUploadError extends Error {
  readonly code: PhotoUploadViolation;
  readonly plan: UserPlan;

  constructor(code: PhotoUploadViolation, plan: UserPlan) {
    super(photoUploadMessage(code, plan));
    this.name = "PhotoUploadError";
    this.code = code;
    this.plan = plan;
  }
}

export function assertPhotoUploadAllowed(
  file: { size: number; type: string },
  plan: UserPlan,
): void {
  const violation = checkPhotoUpload(file, plan);
  if (violation) throw new PhotoUploadError(violation, plan);
}

