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
  /** Total wall-photos storage per account */
  maxStorageBytes: number;
}

/**
 * Free defaults; `premium` plan is shown in UI as 플러스.
 * Free caps are intentionally tight so casual walls still work, but heavy use
 * (many photos / multi shared walls / storage) pushes toward Plus.
 */
export const WALL_QUOTAS: Record<UserPlan, WallQuota> = {
  free: {
    maxOwnedSharedWalls: 1,
    maxSceneBytes: 2.5 * 1024 * 1024,
    maxSceneObjects: 80,
    maxPhotoBytes: 8 * 1024 * 1024,
    maxStorageBytes: 150 * 1024 * 1024,
  },
  premium: {
    maxOwnedSharedWalls: 5,
    maxSceneBytes: 16 * 1024 * 1024,
    maxSceneObjects: 500,
    maxPhotoBytes: 30 * 1024 * 1024,
    maxStorageBytes: 5 * 1024 * 1024 * 1024,
  },
};

/** Plus plan display prices (KRW). Payment is manual until billing is wired. */
export const PLUS_PRICE_KRW = {
  monthly: 3900,
  yearly: 39000,
} as const;

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

/** Free plan warns earlier so the limit is felt before a hard block. */
export const FREE_QUOTA_WARN_RATIO = 0.5;

export function getQuotaWarnRatio(plan: UserPlan): number {
  return plan === "free" ? FREE_QUOTA_WARN_RATIO : QUOTA_WARN_RATIO;
}

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

export function sceneQuotaMessage(
  violation: SceneQuotaViolation,
  plan: UserPlan = "free",
): string {
  const plusHint = plan === "free" ? " 플러스로 한도를 늘릴 수 있어요." : "";
  if (violation === "too_large") {
    return `벽 용량 제한을 넘었어요. 사진·스티커를 조금 줄여 주세요.${plusHint}`;
  }
  return `사진·스티커·텍스트 개수 제한을 넘었어요. 일부 항목을 지워 주세요.${plusHint}`;
}

export function formatBytesShort(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)}MB`;
  const gb = mb / 1024;
  return `${gb >= 10 ? gb.toFixed(0) : gb.toFixed(1)}GB`;
}

export function formatStorageQuotaLabel(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    const gb = bytes / (1024 * 1024 * 1024);
    return Number.isInteger(gb) ? `${gb}GB` : `${gb.toFixed(1)}GB`;
  }
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb}MB` : `${mb.toFixed(0)}MB`;
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
  const warnRatio = getQuotaWarnRatio(plan);
  const objectRatio = objectCount / quota.maxSceneObjects;
  const byteRatio = sceneBytes / quota.maxSceneBytes;
  const nearObjectLimit = objectRatio >= warnRatio;
  const nearByteLimit = byteRatio >= warnRatio;
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

export function objectLimitReachedMessage(
  usage: SceneUsage,
  plan: UserPlan = "free",
): string {
  const plusHint = plan === "free" ? " 플러스로 올려 보세요." : "";
  return `사진·스티커·텍스트 개수 제한을 넘었어요 (${usage.objectCount}/${usage.maxObjects}). 일부 항목을 지워 주세요.${plusHint}`;
}

export function quotaHintDetail(usage: SceneUsage, plan: UserPlan): string {
  if (usage.atObjectLimit) {
    return plan === "free"
      ? "개수 한도 · 플러스로 확장"
      : "사진·스티커·텍스트 개수 제한을 넘었어요";
  }
  if (usage.atByteLimit) {
    return plan === "free" ? "용량 한도 · 플러스로 확장" : "벽 용량 제한을 넘었어요";
  }
  return plan === "free" ? "기본 한도에 가까워요" : "공간이 거의 찼어요";
}

export type PhotoUploadViolation = "too_large" | "invalid_type" | "storage_full";

export function checkPhotoUpload(
  file: { size: number; type: string },
  plan: UserPlan,
): PhotoUploadViolation | null {
  const type = file.type.toLowerCase().trim();
  if (
    !type ||
    !ALLOWED_PHOTO_MIME_TYPES.includes(type as (typeof ALLOWED_PHOTO_MIME_TYPES)[number])
  ) {
    return "invalid_type";
  }
  if (file.size > getWallQuota(plan).maxPhotoBytes) return "too_large";
  return null;
}

export function checkAccountStorage(
  usedBytes: number,
  additionalBytes: number,
  plan: UserPlan,
): PhotoUploadViolation | null {
  const max = getWallQuota(plan).maxStorageBytes;
  if (usedBytes + additionalBytes > max) return "storage_full";
  return null;
}

export function photoUploadMessage(
  violation: PhotoUploadViolation,
  plan: UserPlan,
): string {
  if (violation === "invalid_type") {
    return "JPG, PNG, WEBP, GIF만 올릴 수 있어요";
  }
  if (violation === "storage_full") {
    const cap = formatStorageQuotaLabel(getWallQuota(plan).maxStorageBytes);
    if (plan === "free") {
      return `저장 공간이 가득 찼어요 (최대 ${cap}). 플러스로 올리거나 사진을 지워 주세요`;
    }
    return `저장 공간이 가득 찼어요 (최대 ${cap}). 사진을 조금 지워 주세요`;
  }
  const maxMb = Math.round(getWallQuota(plan).maxPhotoBytes / (1024 * 1024));
  return `사진은 ${maxMb}MB까지 올릴 수 있어요`;
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

export function assertAccountStorageAllowed(
  usedBytes: number,
  additionalBytes: number,
  plan: UserPlan,
): void {
  const violation = checkAccountStorage(usedBytes, additionalBytes, plan);
  if (violation) throw new PhotoUploadError(violation, plan);
}
