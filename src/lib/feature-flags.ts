export const FEATURE_FLAG_KEYS = [
  "shared_walls",
  "guestbook",
  "comments",
  "likes",
  "qr_import",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export interface FeatureFlag {
  key: FeatureFlagKey;
  enabled: boolean;
  label: string;
  description: string;
  updatedAt: string;
}

export const DEFAULT_FEATURE_FLAGS: Record<FeatureFlagKey, boolean> = {
  shared_walls: true,
  guestbook: true,
  comments: true,
  likes: true,
  qr_import: true,
};

export const FEATURE_FLAG_LABELS: Record<FeatureFlagKey, { label: string; description: string }> = {
  shared_walls: { label: "공동 벽", description: "공동 벽 생성·편집·실시간 협업" },
  guestbook: { label: "방명록", description: "공개 벽 방명록 사진" },
  comments: { label: "댓글", description: "공개 벽 응원 댓글" },
  likes: { label: "좋아요", description: "공개 벽 응원하기" },
  qr_import: { label: "QR 가져오기", description: "/import 부스 QR 네컷 가져오기" },
};

export function mergeFeatureFlags(
  rows: { key: string; enabled: boolean }[],
): Record<FeatureFlagKey, boolean> {
  const merged = { ...DEFAULT_FEATURE_FLAGS };
  for (const row of rows) {
    if (row.key in merged) {
      merged[row.key as FeatureFlagKey] = row.enabled;
    }
  }
  return merged;
}
