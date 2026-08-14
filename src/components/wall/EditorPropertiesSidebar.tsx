"use client";

import {
  DEFAULT_PEN_STYLE_ID,
  PEN_COLORS,
  PEN_STYLES,
  type PenStyleId,
} from "@/lib/wall-scene/pen";
import { TAPE_STROKE_WIDTH_DEFAULT } from "@/lib/wall-scene/highlighter";
import {
  DEFAULT_TAPE_END_STYLE,
  getTapePreset,
  type TapeEndStyle,
  type TapePreset,
} from "@/lib/wall-scene/tape-style";
import PenStrokeWidthControl from "./PenStrokeWidthControl";
import TapeStrokeWidthControl from "./TapeStrokeWidthControl";
import TapeOpacityControl from "./TapeOpacityControl";
import TapeStyleControls from "./TapeStyleControls";
import WallObjectInspector from "./WallObjectInspector";
import type { EditorMode } from "./editor-types";
import type { WallSceneObject, WallSceneText } from "@/types/wall-scene-v2";
import {
  TEXT_COLORS,
  TEXT_FONT_FAMILIES,
  TEXT_SIZE_PRESETS,
  updateTextObject,
} from "@/lib/wall-scene/add-text";
import TextContentField from "@/components/wall/TextContentField";

interface EditorPropertiesSidebarProps {
  mode: EditorMode;
  inspectorObject: WallSceneObject | null;
  editingTextObject: WallSceneText | null;
  cropActive?: boolean;
  colorEditActive?: boolean;
  onStartCrop?: (id: string) => void;
  onStartColorEdit?: (id: string) => void;
  onUpscalePhoto?: (id: string) => void;
  onExplodeFourCut?: () => void;
  upscaleBusy?: boolean;
  onCloseSelection?: () => void;
  onCloseTextEdit?: () => void;
  penColor: string;
  penStyleId: PenStyleId;
  penStrokeWidth: number;
  tapePresetId: string;
  tapeEndStyle: TapeEndStyle;
  tapeStrokeWidth: number;
  tapeOpacity: number;
  onPenColorChange: (color: string) => void;
  onPenStyleIdChange: (id: PenStyleId) => void;
  onPenStrokeWidthChange: (width: number) => void;
  onTapePresetChange: (preset: TapePreset) => void;
  onTapeEndStyleChange: (style: TapeEndStyle) => void;
  onTapeStrokeWidthChange: (width: number) => void;
  onTapeOpacityChange: (opacity: number) => void;
  /** Arrange / document actions (split from 꾸미기) */
  selectionCount?: number;
  showGrid?: boolean;
  snapToGrid?: boolean;
  canAlignSelection?: boolean;
  canDistributeSelection?: boolean;
  canGroupSelection?: boolean;
  canUngroupSelection?: boolean;
  onSelectAll?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onAlignLeft?: () => void;
  onAlignCenterH?: () => void;
  onAlignRight?: () => void;
  onAlignTop?: () => void;
  onAlignMiddle?: () => void;
  onAlignBottom?: () => void;
  onCenterOnWall?: () => void;
  onDistributeHorizontal?: () => void;
  onDistributeVertical?: () => void;
  onFlipHorizontal?: () => void;
  onFlipVertical?: () => void;
  onToggleGrid?: () => void;
  onToggleSnapToGrid?: () => void;
  onClear?: () => void;
}

const idleChip = "bg-foreground/10 text-foreground hover:bg-foreground/15";
const activeChip = "bg-foreground text-background";

/** Right-side properties panel (desktop Figma-style). */
export default function EditorPropertiesSidebar({
  mode,
  inspectorObject,
  editingTextObject,
  cropActive = false,
  colorEditActive = false,
  onStartCrop,
  onStartColorEdit,
  onUpscalePhoto,
  onExplodeFourCut,
  upscaleBusy,
  onCloseSelection,
  onCloseTextEdit,
  penColor,
  penStyleId = DEFAULT_PEN_STYLE_ID,
  penStrokeWidth,
  tapePresetId = getTapePreset(undefined).id,
  tapeEndStyle = DEFAULT_TAPE_END_STYLE,
  tapeStrokeWidth = TAPE_STROKE_WIDTH_DEFAULT,
  tapeOpacity = 0.42,
  onPenColorChange,
  onPenStyleIdChange,
  onPenStrokeWidthChange,
  onTapePresetChange,
  onTapeEndStyleChange,
  onTapeStrokeWidthChange,
  onTapeOpacityChange,
  selectionCount = 0,
  showGrid = false,
  snapToGrid = false,
  canAlignSelection = false,
  canDistributeSelection = false,
  canGroupSelection = false,
  canUngroupSelection = false,
  onSelectAll,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onAlignLeft,
  onAlignCenterH,
  onAlignRight,
  onAlignTop,
  onAlignMiddle,
  onAlignBottom,
  onCenterOnWall,
  onDistributeHorizontal,
  onDistributeVertical,
  onFlipHorizontal,
  onFlipVertical,
  onToggleGrid,
  onToggleSnapToGrid,
  onClear,
}: EditorPropertiesSidebarProps) {
  const hasSelection = selectionCount > 0;
  const showArrange =
    !cropActive &&
    !colorEditActive &&
    (mode === "select" || mode === "hand") &&
    !editingTextObject;

  const panelTitle = (() => {
    if (cropActive) return "자르기";
    if (colorEditActive) return "색 보정";
    if (mode === "pen") return "펜";
    if (mode === "tape") return "테이프";
    if (mode === "hand") return "이동";
    if (mode === "text" || editingTextObject) return "텍스트";
    if (selectionCount > 1) return `선택 (${selectionCount})`;
    switch (inspectorObject?.type) {
      case "photo":
        return "사진";
      case "sticker":
      case "emoji":
      case "svg":
        return "스티커";
      case "text":
        return "텍스트";
      case "tape":
        return "테이프";
      case "path":
        return "펜";
      default:
        return "속성";
    }
  })();

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-foreground/10 bg-surface text-foreground">
      <div className="border-b border-foreground/10 px-3 py-2.5">
        <p className="text-[11px] font-semibold tracking-wide text-muted">{panelTitle}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {cropActive && (
          <p className="rounded-xl bg-foreground/[0.04] px-3 py-2 text-[11px] leading-relaxed text-muted">
            자르기 모드입니다. 캔버스에서 영역을 조정한 뒤 하단 바에서 적용하세요.
          </p>
        )}

        {colorEditActive && !cropActive && (
          <p className="rounded-xl bg-foreground/[0.04] px-3 py-2 text-[11px] leading-relaxed text-muted">
            색 보정 중입니다. 하단 패널에서 슬라이더를 조절한 뒤 적용하세요.
          </p>
        )}

        {!cropActive && !colorEditActive && mode === "pen" && (
          <div className="space-y-3">
            <p className="text-[11px] font-medium text-muted">펜</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PEN_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => onPenStyleIdChange(style.id)}
                  className={`rounded-xl px-2.5 py-2 text-left transition ${
                    penStyleId === style.id ? activeChip : idleChip
                  }`}
                >
                  <span className="block text-[11px] font-medium">{style.label}</span>
                  <span
                    className={`mt-0.5 block text-[10px] ${
                      penStyleId === style.id ? "text-background/70" : "text-muted"
                    }`}
                  >
                    {style.hint}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] font-medium text-muted">크기</p>
            <PenStrokeWidthControl
              styleId={penStyleId}
              value={penStrokeWidth}
              onChange={onPenStrokeWidthChange}
            />
            <p className="text-[11px] font-medium text-muted">색상</p>
            <div className="flex flex-wrap gap-2">
              {PEN_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onPenColorChange(color)}
                  className={`h-8 w-8 rounded-full ring-2 transition ${
                    penColor === color ? "ring-foreground scale-110" : "ring-transparent"
                  }`}
                  style={{ background: color }}
                  aria-label={`펜 색 ${color}`}
                />
              ))}
            </div>
          </div>
        )}

        {!cropActive && !colorEditActive && mode === "tape" && (
          <div className="space-y-3">
            <p className="text-[11px] font-medium text-muted">테이프 두께</p>
            <TapeStrokeWidthControl
              value={tapeStrokeWidth}
              onChange={onTapeStrokeWidthChange}
            />
            <p className="text-[11px] font-medium text-muted">진하기</p>
            <TapeOpacityControl value={tapeOpacity} onChange={onTapeOpacityChange} />
            <p className="text-[11px] text-muted">길이는 드래그를 멈춘 지점까지예요</p>
            <TapeStyleControls
              tapePresetId={tapePresetId}
              tapeEndStyle={tapeEndStyle}
              onTapePresetChange={onTapePresetChange}
              onTapeEndStyleChange={onTapeEndStyleChange}
            />
          </div>
        )}

        {!cropActive &&
          !colorEditActive &&
          mode === "select" &&
          editingTextObject && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-muted">텍스트</p>
                {onCloseTextEdit && (
                  <button
                    type="button"
                    onClick={onCloseTextEdit}
                    className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-medium text-background"
                  >
                    완료
                  </button>
                )}
              </div>
              <TextContentField
                objectId={editingTextObject.id}
                value={editingTextObject.text}
              />
              <p className="text-[11px] font-medium text-muted">글꼴</p>
              <div className="grid grid-cols-1 gap-1.5">
                {TEXT_FONT_FAMILIES.map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() =>
                      updateTextObject(editingTextObject.id, { fontFamily: font.value })
                    }
                    className={`rounded-xl px-2.5 py-2 text-left text-[12px] transition ${
                      editingTextObject.fontFamily === font.value ? activeChip : idleChip
                    }`}
                    style={{ fontFamily: font.value }}
                  >
                    {font.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-medium text-muted">크기</p>
              <div className="flex flex-wrap gap-1.5">
                {TEXT_SIZE_PRESETS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => updateTextObject(editingTextObject.id, { fontSize: size })}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                      editingTextObject.fontSize === size ? activeChip : idleChip
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-medium text-muted">색상</p>
              <div className="flex flex-wrap gap-2">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateTextObject(editingTextObject.id, { fill: color })}
                    className={`h-7 w-7 rounded-full ring-2 transition ${
                      editingTextObject.fill === color ? "ring-foreground" : "ring-transparent"
                    }`}
                    style={{
                      background: color,
                      boxShadow: color === "#ffffff" ? "inset 0 0 0 1px rgba(128,128,128,0.55)" : undefined,
                    }}
                    aria-label={`글자 색 ${color}`}
                  />
                ))}
              </div>
            </div>
          )}

        {!cropActive &&
          !colorEditActive &&
          (mode === "select" || mode === "hand") &&
          !editingTextObject &&
          hasSelection && (
            <div className="mb-3 grid grid-cols-4 gap-1.5">
              <MiniBtn label="복제" onClick={onDuplicate} />
              <MiniBtn label="맨 앞" onClick={onBringToFront} />
              <MiniBtn label="맨 뒤" onClick={onSendToBack} />
              <MiniBtn label="삭제" onClick={onDelete} danger />
            </div>
          )}

        {!cropActive &&
          !colorEditActive &&
          (mode === "select" || mode === "hand") &&
          !editingTextObject &&
          inspectorObject && (
            <WallObjectInspector
              object={inspectorObject}
              variant="sidebar"
              onStartCrop={inspectorObject.type === "photo" ? onStartCrop : undefined}
              onStartColorEdit={inspectorObject.type === "photo" ? onStartColorEdit : undefined}
              onUpscalePhoto={inspectorObject.type === "photo" ? onUpscalePhoto : undefined}
              onExplodeFourCut={
                inspectorObject.type === "photo" && inspectorObject.fourCut
                  ? onExplodeFourCut
                  : undefined
              }
              upscaleBusy={upscaleBusy}
              onClose={onCloseSelection}
            />
          )}

        {!cropActive &&
          !colorEditActive &&
          (mode === "select" || mode === "hand") &&
          !editingTextObject &&
          !inspectorObject && (
            <p className="text-[11px] leading-relaxed text-muted">
              {mode === "hand"
                ? "손 도구로 화면을 이동할 수 있어요. 선택(V)으로 객체를 고르세요."
                : "캔버스에서 사진·스티커·텍스트를 선택하면 속성이 여기에 표시됩니다."}
            </p>
          )}

        {!cropActive && !colorEditActive && mode === "text" && !editingTextObject && (
          <p className="text-[11px] leading-relaxed text-muted">
            캔버스를 탭하면 텍스트가 추가됩니다.
          </p>
        )}

        {showArrange && (
          <div className={`space-y-3 ${inspectorObject || hasSelection ? "mt-5 border-t border-foreground/10 pt-4" : "mt-4"}`}>
            <p className="text-[11px] font-medium text-muted">정렬 · 배치</p>
            {hasSelection ? (
              <>
                {selectionCount > 1 && (
                  <p className="text-[10px] text-muted">{selectionCount}개 선택됨</p>
                )}
                <div className="grid grid-cols-3 gap-1.5">
                  <MiniBtn label="왼쪽" onClick={onAlignLeft} disabled={!canAlignSelection} />
                  <MiniBtn label="가로중앙" onClick={onAlignCenterH} disabled={!canAlignSelection} />
                  <MiniBtn label="오른쪽" onClick={onAlignRight} disabled={!canAlignSelection} />
                  <MiniBtn label="위" onClick={onAlignTop} disabled={!canAlignSelection} />
                  <MiniBtn label="세로중앙" onClick={onAlignMiddle} disabled={!canAlignSelection} />
                  <MiniBtn label="아래" onClick={onAlignBottom} disabled={!canAlignSelection} />
                </div>
                <MiniBtn label="벽 가운데" onClick={onCenterOnWall} block />
                <div className="grid grid-cols-2 gap-1.5">
                  <MiniBtn
                    label="가로 균등"
                    onClick={onDistributeHorizontal}
                    disabled={!canDistributeSelection}
                  />
                  <MiniBtn
                    label="세로 균등"
                    onClick={onDistributeVertical}
                    disabled={!canDistributeSelection}
                  />
                  <MiniBtn label="좌우 뒤집기" onClick={onFlipHorizontal} />
                  <MiniBtn label="상하 뒤집기" onClick={onFlipVertical} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <MiniBtn label="복제" onClick={onDuplicate} />
                  <MiniBtn label="그룹" onClick={onGroup} disabled={!canGroupSelection} />
                  <MiniBtn label="그룹 해제" onClick={onUngroup} disabled={!canUngroupSelection} />
                  <MiniBtn label="앞으로" onClick={onBringForward} />
                  <MiniBtn label="뒤로" onClick={onSendBackward} />
                  <MiniBtn label="맨 앞" onClick={onBringToFront} />
                  <MiniBtn label="맨 뒤" onClick={onSendToBack} />
                  <MiniBtn label="삭제" onClick={onDelete} danger />
                </div>
              </>
            ) : (
              <p className="text-[10px] text-muted">오브젝트를 선택하면 정렬 도구가 열려요</p>
            )}

            <p className="pt-1 text-[11px] font-medium text-muted">문서</p>
            <div className="flex flex-wrap gap-1.5">
              <MiniBtn label="전체 선택" onClick={onSelectAll} />
              <MiniBtn
                label={showGrid ? "격자 숨기기" : "격자 보기"}
                onClick={onToggleGrid}
                active={showGrid}
              />
              <MiniBtn
                label="격자 맞춤"
                onClick={onToggleSnapToGrid}
                active={snapToGrid}
              />
              <MiniBtn label="전체 지우기" onClick={onClear} danger />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function MiniBtn({
  label,
  onClick,
  disabled,
  active,
  danger,
  block,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  block?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`rounded-lg px-2 py-1.5 text-[10px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        block ? "w-full" : ""
      } ${
        danger
          ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
          : active
            ? "bg-foreground text-background"
            : "bg-foreground/10 text-foreground hover:bg-foreground/15"
      }`}
    >
      {label}
    </button>
  );
}
