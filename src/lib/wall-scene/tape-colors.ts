export const TAPE_COLORS = [
  { id: "pink", color: "#f9a8c9", label: "핑크" },
  { id: "coral", color: "#fda4af", label: "코랄" },
  { id: "peach", color: "#fdba74", label: "피치" },
  { id: "yellow", color: "#fde68a", label: "옐로" },
  { id: "mint", color: "#a8e6cf", label: "민트" },
  { id: "sky", color: "#7dd3fc", label: "스카이" },
  { id: "lavender", color: "#c4b5fd", label: "라벤더" },
  { id: "lilac", color: "#e9d5ff", label: "라일락" },
  { id: "cream", color: "#fef3c7", label: "크림" },
  { id: "white", color: "#f5f5f4", label: "화이트" },
] as const;

/** Re-export expanded tape style API. */
export {
  TAPE_PRESETS,
  TAPE_SOLID_PRESETS,
  TAPE_PATTERN_PRESETS,
  TAPE_END_STYLES,
  DEFAULT_TAPE_END_STYLE,
  DEFAULT_TAPE_PATTERN,
  getTapePreset,
  tapePresetSwatchStyle,
  clampTapeEndStyle,
  clampTapePattern,
  type TapeEndStyle,
  type TapePatternId,
  type TapePreset,
} from "@/lib/wall-scene/tape-style";
