import type { PhotoDecoDefinition } from "./types";

/**
 * Hand-drawn deco overlays go in public/decos/<id>.png (transparent center).
 * Do NOT run process-photowall-stickers.mjs — it shrinks to 120px.
 * Until a file exists, the procedural theme still draws.
 */
export const PHOTO_DECOS: PhotoDecoDefinition[] = [
  { id: "deco.ribbon-blue", name: "블루 리본", theme: "blue", listed: true },
  { id: "deco.ribbon-purple", name: "퍼플 리본", theme: "purple", listed: true },
  { id: "deco.ribbon-pink", name: "핑크 리본", theme: "pink", listed: true },
  {
    id: "deco.overlay.custom",
    name: "커스텀 테두리",
    theme: "pink",
    src: "/decos/custom.png",
    listed: false,
  },
];

const byId = new Map(PHOTO_DECOS.map((deco) => [deco.id, deco]));

export function getPhotoDeco(id: string | undefined | null): PhotoDecoDefinition | undefined {
  if (!id) return undefined;
  return byId.get(id);
}

export function getListedPhotoDecos(): PhotoDecoDefinition[] {
  return PHOTO_DECOS.filter((deco) => deco.listed !== false);
}
