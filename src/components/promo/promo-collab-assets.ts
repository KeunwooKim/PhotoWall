/** Shared promo collab wall assets */
export const PROMO_ASSET_V = "20260807i";

export const PROMO_COLLAB_MEMBERS = [
  { name: "민지", color: "#FF5B8D", initial: "민", role: "방장" },
  { name: "하은", color: "#4A9B83", initial: "하", role: "멤버" },
  { name: "수연", color: "#7C6BB0", initial: "수", role: "멤버" },
] as const;

export type PromoCollabMember = (typeof PROMO_COLLAB_MEMBERS)[number];

export const PROMO_COLLAB_FEATURES = [
  { id: "photo", icon: "📌", label: "사진 붙이기" },
  { id: "collab", icon: "👥", label: "동시 편집" },
  { id: "sticker", icon: "🎨", label: "스티커" },
  { id: "text", icon: "✏️", label: "텍스트" },
  { id: "rotate", icon: "🔄", label: "회전·크기" },
  { id: "sync", icon: "⚡", label: "실시간 동기화" },
] as const;

export type PromoCollabFeatureId = (typeof PROMO_COLLAB_FEATURES)[number]["id"];

export const PROMO_COLLAB_WALL_PHOTOS = [
  {
    id: "strip-day",
    src: `/promo/friends/strips/strip-day.webp?v=${PROMO_ASSET_V}`,
    top: "8%",
    left: "5%",
    w: "17%",
    rotate: -6,
    tape: "#FFE082",
    strip: true,
    by: "민지" as const,
  },
  {
    id: "photo-cafe",
    src: `/promo/friends/photos/photo-cafe.webp?v=${PROMO_ASSET_V}`,
    top: "9%",
    left: "27%",
    w: "25%",
    rotate: 3,
    tape: "#B2DFDB",
    strip: false,
    by: "하은" as const,
  },
  {
    id: "strip-evening",
    src: `/promo/friends/strips/strip-evening.webp?v=${PROMO_ASSET_V}`,
    top: "6%",
    left: "57%",
    w: "16%",
    rotate: 5,
    tape: "#FFCCBC",
    strip: true,
    by: "하은" as const,
  },
  {
    id: "photo-park",
    src: `/promo/friends/photos/photo-park.webp?v=${PROMO_ASSET_V}`,
    top: "47%",
    left: "8%",
    w: "23%",
    rotate: -3,
    tape: "#FFB3C6",
    strip: false,
    by: "수연" as const,
  },
  {
    id: "photo-spring",
    src: `/promo/friends/photos/photo-spring.webp?v=${PROMO_ASSET_V}`,
    top: "45%",
    left: "40%",
    w: "21%",
    rotate: 4,
    tape: "#FFE082",
    strip: false,
    by: "민지" as const,
  },
  {
    id: "strip-night",
    src: `/promo/friends/strips/strip-night.webp?v=${PROMO_ASSET_V}`,
    top: "41%",
    left: "68%",
    w: "15%",
    rotate: -5,
    tape: "#C5B4E3",
    strip: true,
    by: "수연" as const,
  },
] as const;

export type PromoCollabPhotoId = (typeof PROMO_COLLAB_WALL_PHOTOS)[number]["id"];

export const PROMO_COLLAB_STICKERS = [
  {
    id: "heart",
    emoji: "💕",
    top: "26%",
    left: "54%",
    rotate: 14,
    scale: 1.15,
    by: "수연" as const,
  },
  {
    id: "sparkle",
    emoji: "✨",
    top: "58%",
    left: "66%",
    rotate: -10,
    scale: 1,
    by: "수연" as const,
  },
  {
    id: "camera",
    emoji: "📸",
    top: "34%",
    left: "78%",
    rotate: 8,
    scale: 0.95,
    by: "하은" as const,
  },
] as const;

export type PromoCollabStickerId = (typeof PROMO_COLLAB_STICKERS)[number]["id"];

export const PROMO_COLLAB_NOTES = [
  {
    id: "note-summer",
    text: "우리 최고 ✦",
    top: "68%",
    left: "10%",
    rotate: -4,
    bg: "#FFF9C4",
    by: "민지" as const,
  },
  {
    id: "note-date",
    text: "2026.08 ♡",
    top: "22%",
    left: "72%",
    rotate: 6,
    bg: "#E8F5E9",
    by: "하은" as const,
  },
] as const;

export type PromoCollabNoteId = (typeof PROMO_COLLAB_NOTES)[number]["id"];

export const PROMO_COLLAB_CURSORS = [
  { id: "a", name: "민지" as const, color: "#FF5B8D", className: "promo-collab-cursor-a" },
  { id: "b", name: "하은" as const, color: "#4A9B83", className: "promo-collab-cursor-b" },
  { id: "c", name: "수연" as const, color: "#7C6BB0", className: "promo-collab-cursor-c" },
] as const;

export type PromoCollabCursorId = (typeof PROMO_COLLAB_CURSORS)[number]["id"];

export type PromoCollabScene = {
  id: string;
  durationMs: number;
  featureId: PromoCollabFeatureId;
  activeCursor: PromoCollabCursorId;
  photoIds: PromoCollabPhotoId[];
  /** photo id → extra rotation applied on top of base */
  photoRotate?: Partial<Record<PromoCollabPhotoId, number>>;
  stickerIds: PromoCollabStickerId[];
  noteIds: PromoCollabNoteId[];
  toast: {
    who: PromoCollabMember["name"];
    color: string;
    text: string;
    detail?: string;
  };
};

/** Ordered storyboard — each scene adds or adjusts wall content */
export const PROMO_COLLAB_SCENES: PromoCollabScene[] = [
  {
    id: "photo-1",
    durationMs: 3400,
    featureId: "photo",
    activeCursor: "a",
    photoIds: ["strip-day"],
    stickerIds: [],
    noteIds: [],
    toast: {
      who: "민지",
      color: "#FF5B8D",
      text: "네컷 스트립을 붙였어요",
      detail: "카메라·QR로 가져온 사진도 바로 붙여요",
    },
  },
  {
    id: "collab-join",
    durationMs: 3200,
    featureId: "collab",
    activeCursor: "b",
    photoIds: ["strip-day", "photo-cafe"],
    stickerIds: [],
    noteIds: [],
    toast: {
      who: "하은",
      color: "#4A9B83",
      text: "카페 스냅을 올렸어요",
      detail: "초대받은 친구도 같은 벽에 함께 편집해요",
    },
  },
  {
    id: "sticker-1",
    durationMs: 3200,
    featureId: "sticker",
    activeCursor: "c",
    photoIds: ["strip-day", "photo-cafe"],
    stickerIds: ["heart"],
    noteIds: [],
    toast: {
      who: "수연",
      color: "#7C6BB0",
      text: "하트 스티커를 추가했어요",
      detail: "스티커 팩에서 골라 벽에 붙일 수 있어요",
    },
  },
  {
    id: "text-1",
    durationMs: 3200,
    featureId: "text",
    activeCursor: "a",
    photoIds: ["strip-day", "photo-cafe"],
    stickerIds: ["heart"],
    noteIds: ["note-summer"],
    toast: {
      who: "민지",
      color: "#FF5B8D",
      text: "추억 메모를 남겼어요",
      detail: "텍스트·낙서로 벽 분위기를 더해요",
    },
  },
  {
    id: "rotate-1",
    durationMs: 3000,
    featureId: "rotate",
    activeCursor: "a",
    photoIds: ["strip-day", "photo-cafe"],
    photoRotate: { "photo-cafe": 9 },
    stickerIds: ["heart"],
    noteIds: ["note-summer"],
    toast: {
      who: "민지",
      color: "#FF5B8D",
      text: "사진 각도를 맞췄어요",
      detail: "회전·크기·레이어 순서까지 자유롭게",
    },
  },
  {
    id: "photo-2",
    durationMs: 3200,
    featureId: "photo",
    activeCursor: "b",
    photoIds: ["strip-day", "photo-cafe", "strip-evening"],
    photoRotate: { "photo-cafe": 9 },
    stickerIds: ["heart", "camera"],
    noteIds: ["note-summer"],
    toast: {
      who: "하은",
      color: "#4A9B83",
      text: "저녁 네컷도 붙였어요",
      detail: "여러 장을 한 벽에 모아 전시해요",
    },
  },
  {
    id: "collab-more",
    durationMs: 3200,
    featureId: "collab",
    activeCursor: "c",
    photoIds: ["strip-day", "photo-cafe", "strip-evening", "photo-park"],
    photoRotate: { "photo-cafe": 9 },
    stickerIds: ["heart", "camera", "sparkle"],
    noteIds: ["note-summer", "note-date"],
    toast: {
      who: "수연",
      color: "#7C6BB0",
      text: "공원 사진을 추가했어요",
      detail: "누가 올렸는지 표시되어 추억이 선명해져요",
    },
  },
  {
    id: "sync-full",
    durationMs: 4200,
    featureId: "sync",
    activeCursor: "b",
    photoIds: [
      "strip-day",
      "photo-cafe",
      "strip-evening",
      "photo-park",
      "photo-spring",
      "strip-night",
    ],
    photoRotate: { "photo-cafe": 9 },
    stickerIds: ["heart", "camera", "sparkle"],
    noteIds: ["note-summer", "note-date"],
    toast: {
      who: "하은",
      color: "#4A9B83",
      text: "모두의 변경이 실시간 반영됐어요",
      detail: "떨어져 있어도 같은 벽을 함께 꾸며요",
    },
  },
];

export const PROMO_INVITE_CODE = "friends-wall";
