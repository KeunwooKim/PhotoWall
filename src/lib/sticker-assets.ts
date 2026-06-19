export interface StickerAsset {
  id: string;
  name: string;
  /** Fabric loadSVGFromString용 원본 SVG */
  svg: string;
  /** 툴바 미리보기용 data URL */
  src: string;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const HEART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M32 54 C10 38 4 26 10 16 C16 6 28 8 32 16 C36 8 48 6 54 16 C60 26 54 38 32 54Z" fill="#e85d8f"/></svg>`;

const STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M32 4 L38 24 L58 24 L42 36 L48 56 L32 44 L16 56 L22 36 L6 24 L26 24 Z" fill="#f5a623"/></svg>`;

const BOW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><ellipse cx="20" cy="28" rx="14" ry="10" fill="#f9a8c9"/><ellipse cx="44" cy="28" rx="14" ry="10" fill="#f9a8c9"/><circle cx="32" cy="30" r="8" fill="#e85d8f"/><path d="M32 38 L28 56 L32 50 L36 56 Z" fill="#e85d8f"/></svg>`;

const CAMERA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="8" y="18" width="48" height="36" rx="6" fill="#4a4a4a"/><rect x="14" y="24" width="36" height="24" rx="4" fill="#6b6b6b"/><circle cx="32" cy="36" r="10" fill="#3a3a3a"/><circle cx="32" cy="36" r="6" fill="#888"/><rect x="22" y="12" width="12" height="8" rx="2" fill="#4a4a4a"/></svg>`;

const SPARKLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M32 4 L34 28 L58 32 L34 36 L32 60 L30 36 L6 32 L30 28 Z" fill="#c4b5fd"/><path d="M48 8 L49 18 L58 20 L49 22 L48 32 L47 22 L38 20 L47 18 Z" fill="#fde68a"/></svg>`;

const TAPE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="24" viewBox="0 0 80 24"><rect width="80" height="24" rx="2" fill="#a8e6cf" opacity="0.85"/><path d="M0 8 L80 8" stroke="#8ed4b8" stroke-width="0.5"/><path d="M0 16 L80 16" stroke="#8ed4b8" stroke-width="0.5"/></svg>`;

export const SVG_STICKERS: StickerAsset[] = [
  { id: "heart", name: "하트", svg: HEART_SVG, src: svgToDataUrl(HEART_SVG) },
  { id: "star", name: "별", svg: STAR_SVG, src: svgToDataUrl(STAR_SVG) },
  { id: "bow", name: "리본", svg: BOW_SVG, src: svgToDataUrl(BOW_SVG) },
  { id: "camera", name: "카메라", svg: CAMERA_SVG, src: svgToDataUrl(CAMERA_SVG) },
  { id: "sparkle", name: "반짝", svg: SPARKLE_SVG, src: svgToDataUrl(SPARKLE_SVG) },
  { id: "tape", name: "테이프", svg: TAPE_SVG, src: svgToDataUrl(TAPE_SVG) },
];

export const EMOJI_STICKERS = ["✨", "💕", "⭐", "🌸", "📸", "🎀"];
