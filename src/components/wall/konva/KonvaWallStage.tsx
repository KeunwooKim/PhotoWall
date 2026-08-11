"use client";

import type { MutableRefObject, RefObject } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Layer, Line, Rect, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import { configureKonvaForWallEditor, syncKonvaPixelRatioForWall } from "@/lib/konva-device";
import { installKonvaDragOffsetSync } from "@/lib/wall-scene/konva-drag-offset-sync";
import { createKonvaStageExportAdapter } from "@/lib/wall-scene/konva-stage-export";
import { stashWallPreviewFromStage } from "@/hooks/useWallPreviewFlush";
import type { WallStageExportHandle } from "@/components/wall/pixi/PixiWallStage";
import {
  applyOmniWallExpandAfterDrag,
  getEffectivePan,
  getEffectiveWallBounds,
  getEffectiveWallpaperOffset,
  registerLiveWallBoundsApplier,
  setLiveContentShiftMode,
} from "@/lib/wall-scene/wall-drag-expand";
import { setViewportWorldCenterGetter } from "@/lib/wall-scene/wall-home-placement";
import type { WallThemeId } from "@/types/wall";
import type { EditorMode } from "@/components/wall/editor-types";
import { getWallTheme } from "@/lib/wall-themes";
import { computeFitScale, wallpaperDisplayOffset } from "@/lib/wall-bounds";
import { debounce } from "@/lib/debounce";
import { parseWallScene, serializeWallScene } from "@/lib/wall-scene/fabric-import";
import { fingerprintPersistableScene, fingerprintSceneObjects } from "@/lib/wall-scene/scene-fingerprint";
import {
  finalizeTapeEndpoints,
  HIGHLIGHTER_OPACITY,
  type LineEndpoints,
  endpointsToPoints,
} from "@/lib/wall-scene/highlighter";
import { commitPenStroke, commitTapeStroke } from "@/lib/wall-scene/add-path";
import { addTextToWallScene } from "@/lib/wall-scene/add-text";
import {
  PEN_SAMPLE_DISTANCE,
  getPenStyle,
  resolvePenShadowBlur,
  type PenStyleId,
} from "@/lib/wall-scene/pen";
import { cullObjectsForViewport } from "@/lib/wall-scene/viewport-culling";
import { hardClampObjectPositionToWall } from "@/lib/wall-scene/clamp-object-to-wall";
import { OBJECT_MAX_VISUAL_EDGE, clampObjectScalePair } from "@/lib/wall-scene/object-scale";
import { bakeTextTransformScale } from "@/lib/wall-scene/bake-text-transform";
import { selectionStrokeWallPx } from "@/lib/wall-scene/selection-chrome";
import { containerCenter } from "@/lib/wall-scene/viewport-zoom";
import { setWallNodeDragging, isAnyWallNodeDragging, getWallNode } from "@/lib/wall-scene/realtime/wall-node-sync";
import { usePeerLockedObjectIds } from "@/lib/wall-scene/realtime/wall-presence-store";
import { shouldSkipWallPersist } from "@/lib/wall-scene/realtime/wall-persist-gate";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import { createLivePatchBroadcaster } from "@/lib/wall-scene/realtime/live-object-patch";
import { isTransformableObject } from "@/lib/wall-scene/selectable-objects";
import { objectsInMarquee, primarySelectedId } from "@/lib/wall-scene/selection-utils";
import {
  WallSceneObject,
} from "@/types/wall-scene-v2";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import PhotoCropLayer from "./PhotoCropLayer";
import WallPhotoNode from "./WallPhotoNode";
import type { CropAspectPresetId } from "@/lib/wall-scene/photo-crop";
import type { PhotoCropRect } from "@/types/wall-scene-v2";
import WallStickerNode from "./WallStickerNode";
import WallEmojiNode from "./WallEmojiNode";
import WallTextNode from "./WallTextNode";
import WallTapeNode from "./WallTapeNode";
import WallPathNode from "./WallPathNode";
import WallTapeShape from "./WallTapeShape";
import WallPresenceOverlay from "./WallPresenceOverlay";
import {
  DEFAULT_TAPE_END_STYLE,
  DEFAULT_TAPE_PATTERN,
  type TapeEndStyle,
  type TapePatternId,
} from "@/lib/wall-scene/tape-style";
import PeerHighlightsLayer from "./PeerHighlightsLayer";
import SnapGuideLines from "./SnapGuideLines";
import {
  WallContextMenuProvider,
  type WallContextMenuRequestFn,
} from "./wall-context-menu-context";

configureKonvaForWallEditor();

/** Client-px movement below this counts as a tap (clear selection). */
const TAP_CLEAR_PX = 10;

function isStrokeMode(mode: EditorMode) {
  return mode === "pen" || mode === "tape";
}

function isHandMode(mode: EditorMode) {
  return mode === "hand";
}

export interface KonvaWallStageProps {
  themeId: WallThemeId;
  initialJson?: object;
  readOnly?: boolean;
  wallId?: string;
  resolvePhotoSrc?: (src: string) => Promise<string>;
  /** Presence peers come from wall-presence-store — do not pass as props (iOS re-render). */
  currentSessionId?: string;
  onDocumentChange?: (json: object) => void;
  onPointerMove?: (x: number, y: number) => void;
  onPresenceSelection?: (objectIds: string[] | null) => void;
  onPresenceManipulating?: (active: boolean) => void;
  onObjectPatch?: (id: string, patch: WallObjectPatch) => void;
  onReady?: () => void;
  wallStageRef?: RefObject<HTMLDivElement | null>;
  /** Stage export handle — region/full capture adapter. */
  konvaStageRef?: RefObject<WallStageExportHandle | null>;
  editorMode?: EditorMode;
  drawColor?: string;
  /** Masking-tape stroke width in wall px. */
  tapeStrokeWidth?: number;
  tapeEndStyle?: TapeEndStyle;
  tapePattern?: TapePatternId;
  tapePatternAccent?: string;
  tapeOpacity?: number;
  penStyleId?: PenStyleId;
  /** Absolute stroke width for the active brush (after size level). */
  penStrokeWidth?: number;
  /** Return false to block quota-counted adds (text). Pen/tape ignore this. */
  onGuardQuotaAdd?: (count?: number) => boolean;
  onQuotaBlocked?: () => void;
  onRequestSelectMode?: () => void;
  /** Open text style editor (double-click / long-press / after place). */
  onEditText?: (objectId: string) => void;
  onStartPhotoCrop?: (objectId: string) => void;
  onContextMenuRequest?: WallContextMenuRequestFn;
  cropPhotoId?: string | null;
  /** When set, disables transformer (e.g. color edit session). */
  interactionLockId?: string | null;
  cropAspectPreset?: CropAspectPresetId;
  onCropDraftChange?: (
    crop: PhotoCropRect,
    display: { x: number; y: number; width: number; height: number },
  ) => void;
  onCropNaturalSize?: (width: number, height: number) => void;
  instagramExportActive?: boolean;
  /** Rendered inside the stage workspace (viewport-aligned overlays). */
  stageOverlay?: React.ReactNode;
}

function KonvaWallStage({
  themeId,
  initialJson,
  readOnly = false,
  wallId,
  resolvePhotoSrc,
  currentSessionId,
  onDocumentChange,
  onPointerMove,
  onPresenceSelection,
  onPresenceManipulating,
  onObjectPatch,
  onReady,
  wallStageRef,
  konvaStageRef,
  editorMode = "select",
  drawColor = "#fff59d",
  tapeStrokeWidth = 16,
  tapeEndStyle = DEFAULT_TAPE_END_STYLE,
  tapePattern = DEFAULT_TAPE_PATTERN,
  tapePatternAccent = "#ffffff",
  tapeOpacity,
  penStyleId = "ink",
  penStrokeWidth,
  onGuardQuotaAdd,
  onQuotaBlocked,
  onRequestSelectMode,
  onEditText,
  onStartPhotoCrop,
  onContextMenuRequest,
  cropPhotoId = null,
  interactionLockId = null,
  cropAspectPreset = "free",
  onCropDraftChange,
  onCropNaturalSize,
  instagramExportActive = false,
  stageOverlay,
}: KonvaWallStageProps) {
  const theme = getWallTheme(themeId);
  const containerRef = useRef<HTMLDivElement>(null);
  const rawStageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRegistry = useRef(new Map<string, Konva.Group>());
  const locallyDraggingIds = useRef(new Set<string>());
  const drawingRef = useRef<LineEndpoints | null>(null);
  const freehandRef = useRef<number[] | null>(null);
  const editorModeRef = useRef(editorMode);
  const drawColorRef = useRef(drawColor);
  const tapeStrokeWidthRef = useRef(tapeStrokeWidth);
  const tapeEndStyleRef = useRef(tapeEndStyle);
  const tapePatternRef = useRef(tapePattern);
  const tapePatternAccentRef = useRef(tapePatternAccent);
  const tapeOpacityRef = useRef(tapeOpacity);
  const penStyleIdRef = useRef(penStyleId);
  const penStrokeWidthRef = useRef(penStrokeWidth);

  editorModeRef.current = editorMode;
  drawColorRef.current = drawColor;
  tapeStrokeWidthRef.current = tapeStrokeWidth;
  tapeEndStyleRef.current = tapeEndStyle;
  tapePatternRef.current = tapePattern;
  tapePatternAccentRef.current = tapePatternAccent;
  tapeOpacityRef.current = tapeOpacity;
  penStyleIdRef.current = penStyleId;
  penStrokeWidthRef.current = penStrokeWidth;

  const [draftPoints, setDraftPoints] = useState<number[] | null>(null);

  const document = useWallSceneStore((s) => s.document);
  const selectedIds = useWallSceneStore((s) => s.selectedIds);
  const showGrid = useWallSceneStore((s) => s.showGrid);
  const gridSize = useWallSceneStore((s) => s.gridSize);
  const loadDocument = useWallSceneStore((s) => s.loadDocument);
  const setSelectedIds = useWallSceneStore((s) => s.setSelectedIds);
  const selectObject = useWallSceneStore((s) => s.selectObject);
  const clearSelection = useWallSceneStore((s) => s.clearSelection);
  const setViewportScale = useWallSceneStore((s) => s.setViewportScale);
  const viewportScale = useWallSceneStore((s) => s.viewportScale);
  const userZoom = useWallSceneStore((s) => s.userZoom);
  const setViewportZoomAtPoint = useWallSceneStore((s) => s.setViewportZoomAtPoint);
  // Subscribe — display pan reads getEffectivePan() (includes live expand compensation).
  useWallSceneStore((s) => s.panX);
  useWallSceneStore((s) => s.panY);
  const addPan = useWallSceneStore((s) => s.addPan);
  const patchObject = useWallSceneStore((s) => s.patchObject);

  const [containerSize, setContainerSize] = useState({ width: 390, height: 600 });
  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const marqueeStartRef = useRef<{ x1: number; y1: number; shiftKey: boolean } | null>(null);
  const instagramExportActiveRef = useRef(instagramExportActive);
  instagramExportActiveRef.current = instagramExportActive;
  // Live expand updates bounds + pan together. Reading store pan alone with live
  // bounds makes the opposite edge drift on React re-render during west/north grow.
  const wallBounds = getEffectiveWallBounds();
  const effectivePan = getEffectivePan();
  const wallpaperOffset = getEffectiveWallpaperOffset();
  const wallpaperTile = wallpaperDisplayOffset(wallBounds, wallpaperOffset);
  const displayPanX = effectivePan.x;
  const displayPanY = effectivePan.y;

  useEffect(() => installKonvaDragOffsetSync(), []);

  useEffect(() => {
    setLiveContentShiftMode("immediate");
    registerLiveWallBoundsApplier((layout) => {
      const wrapper = wallStageRef?.current;
      const stage = rawStageRef.current;
      if (wrapper) {
        wrapper.style.width = `${layout.bounds.width}px`;
        wrapper.style.height = `${layout.bounds.height}px`;
        wrapper.style.transform = `translate(calc(-50% + ${layout.panX}px), calc(-50% + ${layout.panY}px)) scale(${layout.viewportScale})`;
        if (!showGrid) {
          const tile = wallpaperDisplayOffset(layout.bounds, {
            x: layout.wallpaperOffsetX,
            y: layout.wallpaperOffsetY,
          });
          wrapper.style.backgroundPosition = `${tile.x}px ${tile.y}px`;
        }
      }
      if (
        stage &&
        (stage.width() !== layout.bounds.width || stage.height() !== layout.bounds.height)
      ) {
        stage.width(layout.bounds.width);
        stage.height(layout.bounds.height);
      }
    });
    return () => {
      registerLiveWallBoundsApplier(null);
      setLiveContentShiftMode("immediate");
    };
  }, [konvaStageRef, wallStageRef, showGrid]);

  useEffect(() => {
    setViewportWorldCenterGetter(() => {
      const bounds = getEffectiveWallBounds();
      const pan = getEffectivePan();
      const scale = useWallSceneStore.getState().viewportScale;
      if (!(scale > 0)) return null;
      return {
        x: bounds.x + bounds.width / 2 - pan.x / scale,
        y: bounds.y + bounds.height / 2 - pan.y / scale,
      };
    });
    return () => setViewportWorldCenterGetter(null);
  }, []);

  useEffect(() => {
    if (isAnyWallNodeDragging()) return;
    const stored = useWallSceneStore.getState().document.meta.wallBounds;
    const stage = rawStageRef.current;
    syncKonvaPixelRatioForWall(stored.width, stored.height, stage ?? null);
  }, [document.meta.wallBounds.width, document.meta.wallBounds.height]);

  const attachStageRef = useCallback(
    (node: Konva.Stage | null) => {
      const prev = rawStageRef.current;
      if (!node && prev && !readOnly) {
        stashWallPreviewFromStage({
          wallId,
          themeId,
          stage: prev,
        });
      }
      rawStageRef.current = node;
      if (konvaStageRef) {
        (konvaStageRef as MutableRefObject<WallStageExportHandle | null>).current = node
          ? createKonvaStageExportAdapter(node, getEffectiveWallBounds)
          : null;
      }
      if (node) {
        const stored = useWallSceneStore.getState().document.meta.wallBounds;
        syncKonvaPixelRatioForWall(stored.width, stored.height, node);
      }
    },
    [konvaStageRef, readOnly, themeId, wallId],
  );

  const primaryId = primarySelectedId(selectedIds);

  const peerLockedIds = usePeerLockedObjectIds(currentSessionId);

  useEffect(() => {
    if (peerLockedIds.size === 0) return;
    const { selectedIds: current, setSelectedIds } = useWallSceneStore.getState();
    const next = current.filter((id) => !peerLockedIds.has(id));
    if (next.length !== current.length) {
      setSelectedIds(next);
      onPresenceSelection?.(next.length > 0 ? next : null);
    }
  }, [peerLockedIds, onPresenceSelection]);

  const transformableSelectedIds = useMemo(() => {
    const selected = new Set(selectedIds);
    return document.objects
      .filter(
        (object) =>
          selected.has(object.id) &&
          object.id !== cropPhotoId &&
          object.id !== interactionLockId &&
          isTransformableObject(object) &&
          !peerLockedIds.has(object.id),
      )
      .map((object) => object.id);
  }, [cropPhotoId, interactionLockId, document.objects, selectedIds, peerLockedIds]);

  const transformerAnchors = useMemo(() => {
    const corners = ["top-left", "top-right", "bottom-left", "bottom-right"];
    if (transformableSelectedIds.length !== 1) return corners;
    const obj = document.objects.find((o) => o.id === transformableSelectedIds[0]);
    if (obj?.type !== "text") return corners;
    return [
      ...corners,
      "middle-left",
      "middle-right",
      "top-center",
      "bottom-center",
    ];
  }, [document.objects, transformableSelectedIds]);

  const cropPhoto = useMemo(() => {
    if (!cropPhotoId) return null;
    const object = document.objects.find(
      (item): item is Extract<WallSceneObject, { type: "photo" }> =>
        item.id === cropPhotoId && item.type === "photo",
    );
    return object ?? null;
  }, [cropPhotoId, document.objects]);

  const setManipulating = useCallback(
    (active: boolean, objectId?: string) => {
      if (objectId) {
        if (active) locallyDraggingIds.current.add(objectId);
        else locallyDraggingIds.current.delete(objectId);
        setWallNodeDragging(objectId, active);
      }
      onPresenceManipulating?.(active);
    },
    [onPresenceManipulating],
  );
  const readyRef = useRef(false);
  const skipPersistRef = useRef(true);
  const onReadyRef = useRef(onReady);
  const onDocumentChangeRef = useRef(onDocumentChange);
  onReadyRef.current = onReady;
  onDocumentChangeRef.current = onDocumentChange;

  useEffect(() => {
    if (!initialJson) return;
    skipPersistRef.current = true;
    loadDocument(parseWallScene(initialJson));
    if (!readyRef.current) {
      readyRef.current = true;
      onReadyRef.current?.();
    }
    queueMicrotask(() => {
      skipPersistRef.current = false;
    });
  }, [initialJson, loadDocument]);

  useEffect(() => {
    const unsub = useWallSceneStore.subscribe(
      (s) => fingerprintPersistableScene(s.document),
      () => {
        if (skipPersistRef.current) return;
        if (shouldSkipWallPersist()) return;
        onDocumentChangeRef.current?.(
          serializeWallScene(useWallSceneStore.getState().document),
        );
      },
    );
    return unsub;
  }, []);

  useEffect(() => {
    const reconcile = debounce(() => {
      // Remote sync already brings authoritative bounds — local sanitize here
      // would shift peers' cameras.
      if (shouldSkipWallPersist()) return;
      useWallSceneStore.getState().reconcileWallBoundsFromObjects();
    }, 100);

    const unsub = useWallSceneStore.subscribe(
      (s) => fingerprintSceneObjects(s.document.objects),
      () => reconcile(),
    );

    return () => unsub();
  }, []);

  const fitScale = useMemo(
    () =>
      computeFitScale(
        containerSize.width,
        containerSize.height,
        wallBounds.width,
        wallBounds.height,
      ),
    [containerSize.width, containerSize.height, wallBounds.width, wallBounds.height],
  );

  /** Fit used for display. Kept across local expand so opposite edges stay screen-fixed. */
  const layoutFitRef = useRef<number | null>(null);
  const prevContainerSizeRef = useRef({ width: 0, height: 0 });
  const prevUserZoomRef = useRef(userZoom);
  const frozenFitScaleRef = useRef<number | null>(null);

  useEffect(() => {
    const prevContainer = prevContainerSizeRef.current;
    const containerChanged =
      prevContainer.width !== containerSize.width ||
      prevContainer.height !== containerSize.height;
    prevContainerSizeRef.current = {
      width: containerSize.width,
      height: containerSize.height,
    };

    // Zoom reset button → re-fit to the current wall size.
    const zoomResetToDefault = userZoom === 1 && prevUserZoomRef.current !== 1;
    prevUserZoomRef.current = userZoom;

    if (
      containerSize.width > 0 &&
      containerSize.height > 0 &&
      (layoutFitRef.current == null || containerChanged || zoomResetToDefault)
    ) {
      layoutFitRef.current = fitScale;
    }
    // Do not re-fit on local wall expand/shrink — pan already locks the opposite
    // edge (west grow → right stays). Re-fitting zooms out and slides that edge.

    const displayFit = layoutFitRef.current ?? fitScale;

    if (isAnyWallNodeDragging()) {
      if (frozenFitScaleRef.current === null) {
        frozenFitScaleRef.current = displayFit;
      }
      setViewportScale(frozenFitScaleRef.current * userZoom);
      return;
    }

    frozenFitScaleRef.current = null;
    setViewportScale(displayFit * userZoom);
  }, [
    fitScale,
    userZoom,
    setViewportScale,
    containerSize.width,
    containerSize.height,
    wallBounds.width,
    wallBounds.height,
  ]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [setViewportScale]);

  // ─── 핀치 줌 + 두 손가락 패닝 (모바일) ───────────────────────────────────
  const pinchDistRef = useRef<number | null>(null);
  const pinchMidpointRef = useRef<{ x: number; y: number } | null>(null);
  const spaceHeldRef = useRef(false);
  const containerPanRef = useRef<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const getContainerCenter = useCallback(() => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    return containerCenter(el.getBoundingClientRect());
  }, []);

  const handleTouchStartZoom = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDistRef.current = Math.hypot(dx, dy);
      pinchMidpointRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  }, []);

  const handleTouchMoveZoom = useCallback(
    (e: TouchEvent) => {
      // Block browser scroll / pull-to-refresh while touching the workspace.
      if (e.cancelable) e.preventDefault();

      if (e.touches.length !== 2 || pinchDistRef.current === null) return;
      if (isStrokeMode(editorModeRef.current)) return;

      const midpoint = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };

      if (pinchMidpointRef.current) {
        const panDx = midpoint.x - pinchMidpointRef.current.x;
        const panDy = midpoint.y - pinchMidpointRef.current.y;
        if (panDx !== 0 || panDy !== 0) {
          addPan(panDx, panDy);
        }
      }
      pinchMidpointRef.current = midpoint;

      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchDistRef.current;
      pinchDistRef.current = dist;

      const current = useWallSceneStore.getState().userZoom;
      const center = getContainerCenter();
      setViewportZoomAtPoint(
        current * ratio,
        midpoint.x,
        midpoint.y,
        center.x,
        center.y,
      );
    },
    [addPan, getContainerCenter, setViewportZoomAtPoint],
  );

  const handleTouchEndZoom = useCallback(() => {
    pinchDistRef.current = null;
    pinchMidpointRef.current = null;
  }, []);

  // ─── 휠 줌 (PC) — 커서 기준 ─────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (isStrokeMode(editorModeRef.current)) return;
      e.preventDefault();

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const current = useWallSceneStore.getState().userZoom;
      const center = getContainerCenter();
      setViewportZoomAtPoint(
        current * delta,
        e.clientX,
        e.clientY,
        center.x,
        center.y,
      );
    },
    [getContainerCenter, setViewportZoomAtPoint],
  );

  // ─── Space + 드래그 패닝 (PC) ─────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      spaceHeldRef.current = true;
      setIsPanning(true);
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      spaceHeldRef.current = false;
      if (!containerPanRef.current) setIsPanning(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Space + drag (temporary hand) or hand tool — pan anywhere on the workspace.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || readOnly) return;

    const canPan = () =>
      isHandMode(editorModeRef.current) || spaceHeldRef.current;

    const onMouseDown = (e: MouseEvent) => {
      if (!canPan() || isStrokeMode(editorModeRef.current)) return;
      if (e.button !== 0) return;
      containerPanRef.current = { x: e.clientX, y: e.clientY };
      setIsPanning(true);
      e.preventDefault();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!containerPanRef.current) return;
      const dx = e.clientX - containerPanRef.current.x;
      const dy = e.clientY - containerPanRef.current.y;
      if (dx !== 0 || dy !== 0) addPan(dx, dy);
      containerPanRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => {
      containerPanRef.current = null;
      setIsPanning(false);
    };

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [addPan, readOnly]);

  // Touch: hand tool pans anywhere; select mode on gray area only clears selection on tap.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || readOnly) return;

    let panStart: {
      x: number;
      y: number;
      originX: number;
      originY: number;
      allowPan: boolean;
    } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        panStart = null;
        return;
      }
      if (isStrokeMode(editorModeRef.current)) return;

      const mode = editorModeRef.current;
      const target = e.target as Node | null;
      const wallEl = wallStageRef?.current;
      const onWall = !!(wallEl && target && wallEl.contains(target));

      if (isHandMode(mode)) {
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        panStart = { x, y, originX: x, originY: y, allowPan: true };
        setIsPanning(true);
        return;
      }

      if (mode === "select" && !onWall) {
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        panStart = { x, y, originX: x, originY: y, allowPan: false };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!panStart || e.touches.length !== 1) return;
      if (e.cancelable) e.preventDefault();
      if (!panStart.allowPan) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - panStart.x;
      const dy = y - panStart.y;
      if (dx !== 0 || dy !== 0) addPan(dx, dy);
      panStart = { ...panStart, x, y };
    };

    const onTouchEnd = () => {
      if (panStart && !panStart.allowPan && editorModeRef.current === "select") {
        const moved = Math.hypot(
          panStart.x - panStart.originX,
          panStart.y - panStart.originY,
        );
        if (moved < TAP_CLEAR_PX) {
          clearSelection();
          onPresenceSelection?.(null);
        }
      }
      panStart = null;
      setIsPanning(false);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [addPan, clearSelection, onPresenceSelection, readOnly, wallStageRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("touchstart", handleTouchStartZoom, { passive: true });
    el.addEventListener("touchmove", handleTouchMoveZoom, { passive: false });
    el.addEventListener("touchend", handleTouchEndZoom, { passive: true });
    el.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      el.removeEventListener("touchstart", handleTouchStartZoom);
      el.removeEventListener("touchmove", handleTouchMoveZoom);
      el.removeEventListener("touchend", handleTouchEndZoom);
      el.removeEventListener("wheel", handleWheel);
    };
  }, [handleTouchStartZoom, handleTouchMoveZoom, handleTouchEndZoom, handleWheel]);

  const registerNode = useCallback((id: string, node: Konva.Group | null) => {
    if (node) nodeRegistry.current.set(id, node);
    else nodeRegistry.current.delete(id);
  }, []);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    const canTransform =
      (editorMode === "select" || editorMode === "hand") &&
      !cropPhotoId &&
      !interactionLockId &&
      transformableSelectedIds.length > 0;
    const nodes = canTransform
      ? transformableSelectedIds
          .map((id) => nodeRegistry.current.get(id))
          .filter((node): node is Konva.Group => node != null)
      : [];

    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [transformableSelectedIds, editorMode, cropPhotoId, interactionLockId]);

  const visibleObjects = useMemo(() => {
    const sorted = [...document.objects].sort((a, b) => a.zIndex - b.zIndex);
    if (isAnyWallNodeDragging()) return sorted;

    const viewport = {
      x: 0,
      y: 0,
      width: wallBounds.width,
      height: wallBounds.height,
    };
    return cullObjectsForViewport(sorted, viewport);
  }, [document.objects, wallBounds.height, wallBounds.width]);

  const broadcastSelection = useCallback(
    (objectIds?: string[] | null) => {
      const ids =
        objectIds === null
          ? []
          : (objectIds ?? useWallSceneStore.getState().selectedIds);
      onPresenceSelection?.(ids.length > 0 ? ids : null);
    },
    [onPresenceSelection],
  );

  const handleObjectSelect = useCallback(
    (objectId: string, additive: boolean) => {
      selectObject(objectId, additive);
      broadcastSelection();
    },
    [broadcastSelection, selectObject],
  );

  const renderSceneObject = useCallback(
    (object: WallSceneObject) => {
      const select = (additive = false) => {
        if (peerLockedIds.has(object.id)) return;
        handleObjectSelect(object.id, additive);
      };

      const isSelected = selectedIds.includes(object.id);
      const objectReadOnly =
        readOnly ||
        isStrokeMode(editorMode) ||
        editorMode === "hand" ||
        editorMode === "text" ||
        peerLockedIds.has(object.id) ||
        object.id === cropPhotoId;

      if (object.type === "photo") {
        if (object.id === cropPhotoId) return null;

        return (
          <WallPhotoNode
            key={object.id}
            object={object}
            readOnly={objectReadOnly}
            resolvePhotoSrc={resolvePhotoSrc}
            onSelect={select}
            onInteractionStart={() => broadcastSelection()}
            onObjectPatch={onObjectPatch}
            onManipulationChange={setManipulating}
            onCropRequest={(id) => {
              onRequestSelectMode?.();
              onStartPhotoCrop?.(id);
            }}
            registerNode={registerNode}
          />
        );
      }

      if (object.type === "sticker") {
        return (
          <WallStickerNode
            key={object.id}
            object={object}
            readOnly={objectReadOnly}
            onSelect={select}
            onInteractionStart={() => broadcastSelection()}
            onManipulationChange={setManipulating}
            registerNode={registerNode}
          />
        );
      }

      if (object.type === "emoji") {
        return (
          <WallEmojiNode
            key={object.id}
            object={object}
            readOnly={objectReadOnly}
            onSelect={select}
            onInteractionStart={() => broadcastSelection()}
            onManipulationChange={setManipulating}
            registerNode={registerNode}
          />
        );
      }

      if (object.type === "text") {
        return (
          <WallTextNode
            key={object.id}
            object={object}
            readOnly={objectReadOnly}
            onSelect={select}
            onInteractionStart={() => broadcastSelection()}
            onManipulationChange={setManipulating}
            onEditRequest={(id) => {
              onRequestSelectMode?.();
              onEditText?.(id);
            }}
            registerNode={registerNode}
          />
        );
      }

      if (object.type === "tape") {
        return (
          <WallTapeNode
            key={object.id}
            object={object}
            readOnly={objectReadOnly}
            selected={isSelected}
            onSelect={select}
            onInteractionStart={() => broadcastSelection()}
            onManipulationChange={setManipulating}
            registerNode={registerNode}
          />
        );
      }

      if (object.type === "path") {
        return (
          <WallPathNode
            key={object.id}
            object={object}
            readOnly={objectReadOnly}
            selected={isSelected}
            onSelect={select}
            onInteractionStart={() => broadcastSelection()}
            onManipulationChange={setManipulating}
            registerNode={registerNode}
          />
        );
      }

      return null;
    },
    [
      readOnly,
      editorMode,
      selectedIds,
      peerLockedIds,
      cropPhotoId,
      resolvePhotoSrc,
      onObjectPatch,
      setManipulating,
      registerNode,
      onRequestSelectMode,
      onEditText,
      onStartPhotoCrop,
      handleObjectSelect,
      broadcastSelection,
    ],
  );

  const commitTransformSelection = useCallback(() => {
    useWallSceneStore.getState().setSnapGuides([]);
    const store = useWallSceneStore.getState();
    applyOmniWallExpandAfterDrag(transformableSelectedIds);

    for (const id of transformableSelectedIds) {
      const node = nodeRegistry.current.get(id);
      if (!node) continue;

      const object = store.document.objects.find((item) => item.id === id);
      const wall = getEffectiveWallBounds();
      let patch: WallObjectPatch = {
        x: node.x(),
        y: node.y(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
        rotation: node.rotation(),
      };
      if (object?.type === "text") {
        const baked = bakeTextTransformScale(
          object,
          node.scaleX(),
          node.scaleY(),
          "axes",
        );
        patch = { ...patch, ...baked };
        node.scaleX(baked.scaleX);
        node.scaleY(baked.scaleY);
        const candidate = { ...object, ...patch } as WallSceneObject;
        const clamped = hardClampObjectPositionToWall(candidate, wall);
        if (clamped) {
          patch = { ...patch, ...clamped };
          node.position(clamped);
        }
      } else if (object) {
        const baseW =
          "width" in object && typeof object.width === "number"
            ? object.width
            : "fontSize" in object && typeof object.fontSize === "number"
              ? object.fontSize
              : 40;
        const baseH =
          "height" in object && typeof object.height === "number"
            ? object.height
            : baseW;
        const scales = clampObjectScalePair(
          node.scaleX(),
          node.scaleY(),
          baseW,
          baseH,
        );
        patch = { ...patch, ...scales };
        node.scaleX(scales.scaleX);
        node.scaleY(scales.scaleY);
        const candidate = { ...object, ...patch } as WallSceneObject;
        const clamped = hardClampObjectPositionToWall(candidate, wall);
        if (clamped) {
          patch = { ...patch, ...clamped };
          node.position(clamped);
        }
      }
      patchObject(id, patch);
      broadcastWallPatch(id, patch);
    }
    if (transformableSelectedIds.length > 0) {
      useWallSceneStore.getState().recordHistory();
      useWallSceneStore.getState().reconcileWallBoundsFromObjects();
    }
  }, [patchObject, transformableSelectedIds]);

  const syncTransform = useMemo(() => {
    const broadcast = createLivePatchBroadcaster();
    return () => {
      const { selectedIds: ids, document: doc } = useWallSceneStore.getState();
      for (const id of ids) {
        const object = doc.objects.find((item) => item.id === id);
        if (!object || !isTransformableObject(object)) continue;

        const node = nodeRegistry.current.get(id);
        if (!node) continue;
        broadcast(id, {
          x: node.x(),
          y: node.y(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
          rotation: node.rotation(),
        });
      }
    };
  }, []);

  const reportPointer = useCallback(
    (stage: Konva.Stage | null) => {
      if (!stage || !onPointerMove) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      onPointerMove(pos.x + wallBounds.x, pos.y + wallBounds.y);
    },
    [onPointerMove, wallBounds.x, wallBounds.y],
  );

  const reportPointerFromClient = useCallback(
    (clientX: number, clientY: number) => {
      if (!onPointerMove) return;

      const stageEl = wallStageRef?.current;
      if (!stageEl) return;

      const rect = stageEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      onPointerMove(
        ((clientX - rect.left) / rect.width) * wallBounds.width + wallBounds.x,
        ((clientY - rect.top) / rect.height) * wallBounds.height + wallBounds.y,
      );
    },
    [onPointerMove, wallBounds.height, wallBounds.width, wallBounds.x, wallBounds.y, wallStageRef],
  );

  useEffect(() => {
    if (!onPointerMove) return;

    const handlePointerMove = (event: PointerEvent) => {
      reportPointerFromClient(event.clientX, event.clientY);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [onPointerMove, reportPointerFromClient]);

  const getWallPointer = useCallback((stage: Konva.Stage | null) => {
    if (!stage) return null;
    return stage.getPointerPosition();
  }, []);

  const updateDraftLine = useCallback((stage: Konva.Stage | null) => {
    const mode = editorModeRef.current;

    if (mode === "pen") {
      const draft = freehandRef.current;
      if (!stage || !draft) return;
      const pos = getWallPointer(stage);
      if (!pos) return;
      const lastX = draft[draft.length - 2];
      const lastY = draft[draft.length - 1];
      if (Math.hypot(pos.x - lastX, pos.y - lastY) < PEN_SAMPLE_DISTANCE) return;
      draft.push(pos.x, pos.y);
      setDraftPoints([...draft]);
      return;
    }

    const draft = drawingRef.current;
    if (!stage || !draft) return;

    const pos = getWallPointer(stage);
    if (!pos) return;

    drawingRef.current = { x1: draft.x1, y1: draft.y1, x2: pos.x, y2: pos.y };

    // Tape length follows the finger — no fixed max preset.
    setDraftPoints(endpointsToPoints(drawingRef.current));
  }, [getWallPointer]);

  const finishDrawing = useCallback(() => {
    const mode = editorModeRef.current;

    if (mode === "pen") {
      const draft = freehandRef.current;
      freehandRef.current = null;
      setDraftPoints(null);
      if (!draft) return;
      commitPenStroke(
        draft,
        drawColorRef.current,
        penStyleIdRef.current,
        penStrokeWidthRef.current,
      );
      return;
    }

    const draft = drawingRef.current;
    drawingRef.current = null;
    setDraftPoints(null);

    if (!draft) return;

    const finalized = finalizeTapeEndpoints(draft.x1, draft.y1, draft.x2, draft.y2);
    if (!finalized) return;

    commitTapeStroke(finalized, drawColorRef.current, {
      strokeWidth: tapeStrokeWidthRef.current,
      opacity: tapeOpacityRef.current,
      tapeEndStyle: tapeEndStyleRef.current,
      tapePattern: tapePatternRef.current,
      tapePatternAccent: tapePatternAccentRef.current,
    });
  }, []);

  const startDrawing = useCallback(
    (stage: Konva.Stage | null) => {
      if (readOnly || !isStrokeMode(editorModeRef.current)) return;

      const pos = getWallPointer(stage);
      if (!pos) return;

      clearSelection();
      broadcastSelection(null);

      if (editorModeRef.current === "pen") {
        freehandRef.current = [pos.x, pos.y];
        drawingRef.current = null;
        setDraftPoints([pos.x, pos.y, pos.x, pos.y]);
        return;
      }

      freehandRef.current = null;
      const next: LineEndpoints = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
      drawingRef.current = next;
      setDraftPoints(endpointsToPoints(next));
    },
    [clearSelection, getWallPointer, broadcastSelection, readOnly],
  );

  const placeTextAtPointer = useCallback(
    (stage: Konva.Stage | null) => {
      if (readOnly || editorModeRef.current !== "text") return;
      const pos = getWallPointer(stage);
      if (!pos) return;
      if (onGuardQuotaAdd && !onGuardQuotaAdd(1)) {
        onQuotaBlocked?.();
        return;
      }
      const added = addTextToWallScene({ x: pos.x, y: pos.y });
      broadcastSelection();
      onRequestSelectMode?.();
      onEditText?.(added.id);
    },
    [
      broadcastSelection,
      getWallPointer,
      onEditText,
      onGuardQuotaAdd,
      onQuotaBlocked,
      onRequestSelectMode,
      readOnly,
    ],
  );

  const finishMarquee = useCallback(
    (stage: Konva.Stage | null) => {
      const start = marqueeStartRef.current;
      if (!start || !stage) return;

      marqueeStartRef.current = null;
      const pos = getWallPointer(stage);
      if (!pos) {
        setMarqueeRect(null);
        return;
      }

      const minX = Math.min(start.x1, pos.x);
      const minY = Math.min(start.y1, pos.y);
      const maxX = Math.max(start.x1, pos.x);
      const maxY = Math.max(start.y1, pos.y);
      const width = maxX - minX;
      const height = maxY - minY;

      setMarqueeRect(null);

      if (width < 4 && height < 4) {
        if (!start.shiftKey) {
          clearSelection();
          broadcastSelection(null);
        }
        return;
      }

      const hitIds = objectsInMarquee(document.objects, { minX, minY, maxX, maxY });
      if (start.shiftKey) {
        const merged = [...new Set([...selectedIds, ...hitIds])];
        setSelectedIds(merged);
        broadcastSelection(merged);
      } else {
        setSelectedIds(hitIds);
        broadcastSelection(hitIds);
      }
    },
    [
      clearSelection,
      document.objects,
      broadcastSelection,
      getWallPointer,
      selectedIds,
      setSelectedIds,
    ],
  );

  const handleStagePointerDown = useCallback(
    (
      stage: Konva.Stage | null,
      isStageTarget: boolean,
      shiftKey: boolean,
      nativeEvt: MouseEvent | TouchEvent,
    ) => {
      reportPointer(stage);

      if (readOnly || !isStageTarget || !stage) return;
      if (instagramExportActiveRef.current) return;
      if (isHandMode(editorModeRef.current)) return;
      if (editorModeRef.current !== "select") return;

      const pos = getWallPointer(stage);
      if (!pos) return;

      marqueeStartRef.current = { x1: pos.x, y1: pos.y, shiftKey };
      setMarqueeRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    },
    [getWallPointer, readOnly, reportPointer],
  );

  const handleStagePointerMove = useCallback(
    (stage: Konva.Stage | null, _nativeEvt?: MouseEvent | TouchEvent) => {
      reportPointer(stage);

      const start = marqueeStartRef.current;
      if (!stage || !start) return;

      const pos = getWallPointer(stage);
      if (!pos) return;

      const x = Math.min(start.x1, pos.x);
      const y = Math.min(start.y1, pos.y);
      const width = Math.abs(pos.x - start.x1);
      const height = Math.abs(pos.y - start.y1);
      setMarqueeRect({ x, y, width, height });
    },
    [getWallPointer, reportPointer],
  );

  const handleStagePointerUp = useCallback(
    (stage: Konva.Stage | null) => {
      if (drawingRef.current || freehandRef.current) {
        finishDrawing();
        return;
      }

      if (marqueeStartRef.current) {
        finishMarquee(stage);
      }
    },
    [finishDrawing, finishMarquee],
  );

  useEffect(() => {
    if (!isStrokeMode(editorMode)) {
      drawingRef.current = null;
      freehandRef.current = null;
      setDraftPoints(null);
    }
  }, [editorMode]);

  const workspaceCursor = isHandMode(editorMode) || isPanning
    ? isPanning
      ? "cursor-grabbing"
      : "cursor-grab"
    : editorMode === "pen" || editorMode === "tape" || editorMode === "text"
      ? "cursor-crosshair"
      : "cursor-default";

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full touch-none overflow-hidden overscroll-none bg-neutral-200 ${workspaceCursor}`}
    >
      <div
        ref={wallStageRef}
        className={`absolute left-1/2 top-1/2 origin-center shadow-lg ring-1 ring-black/10 ${
          showGrid ? "workspace-grid" : ""
        }`}
        style={{
          width: wallBounds.width,
          height: wallBounds.height,
          transform: `translate(calc(-50% + ${displayPanX}px), calc(-50% + ${displayPanY}px)) scale(${viewportScale})`,
          background: showGrid ? undefined : theme.background,
          backgroundSize: showGrid
            ? `${gridSize}px ${gridSize}px`
            : theme.backgroundSize,
          backgroundPosition: showGrid
            ? undefined
            : `${wallpaperTile.x}px ${wallpaperTile.y}px`,
          backgroundRepeat: showGrid ? undefined : theme.backgroundRepeat,
        }}
      >
        <WallContextMenuProvider
          value={
            !readOnly && editorMode === "select" ? (onContextMenuRequest ?? null) : null
          }
        >
          <Stage
            ref={attachStageRef}
            width={wallBounds.width}
            height={wallBounds.height}
            onMouseDown={(e) => {
              const stage = e.target.getStage();
              handleStagePointerDown(stage, e.target === stage, e.evt.shiftKey, e.evt);
            }}
            onTouchStart={(e) => {
              const stage = e.target.getStage();
              handleStagePointerDown(stage, e.target === stage, false, e.evt);
            }}
            onMouseMove={(e) => handleStagePointerMove(e.target.getStage(), e.evt)}
            onTouchMove={(e) => handleStagePointerMove(e.target.getStage(), e.evt)}
            onMouseUp={(e) => handleStagePointerUp(e.target.getStage())}
            onTouchEnd={(e) => handleStagePointerUp(e.target.getStage())}
            onMouseLeave={(e) => handleStagePointerUp(e.target.getStage())}
            onContextMenu={(e) => {
              if (readOnly || editorMode !== "select" || !onContextMenuRequest) return;
              const stage = e.target.getStage();
              if (!stage || e.target !== stage) return;
              e.evt.preventDefault();
              if (useWallSceneStore.getState().selectedIds.length > 0) {
                onContextMenuRequest(e.evt.clientX, e.evt.clientY);
              }
            }}
          >
          <Layer listening={!readOnly && editorMode === "select"}>
            <Group x={-wallBounds.x} y={-wallBounds.y}>
            {visibleObjects.map((object) => renderSceneObject(object))}
            {cropPhoto && onCropDraftChange && onCropNaturalSize && (
              <PhotoCropLayer
                photo={cropPhoto}
                aspectPreset={cropAspectPreset}
                resolvePhotoSrc={resolvePhotoSrc}
                onDraftChange={onCropDraftChange}
                onNaturalSize={onCropNaturalSize}
              />
            )}
            {marqueeRect && (
              <Rect
                x={marqueeRect.x}
                y={marqueeRect.y}
                width={marqueeRect.width}
                height={marqueeRect.height}
                fill="rgba(59, 130, 246, 0.12)"
                stroke="#3b82f6"
                strokeWidth={1}
                dash={[4, 4]}
                listening={false}
              />
            )}
            <SnapGuideLines />
            {!readOnly &&
              (editorMode === "select" || editorMode === "hand") &&
              !cropPhotoId &&
              !interactionLockId && (
              <Transformer
                ref={transformerRef}
                rotateEnabled={editorMode === "select"}
                resizeEnabled={editorMode === "select"}
                borderStroke="#3b82f6"
                borderStrokeWidth={selectionStrokeWallPx(viewportScale)}
                anchorSize={Math.max(8, 12 / Math.max(viewportScale, 0.05))}
                enabledAnchors={
                  editorMode === "select" ? transformerAnchors : []
                }
                listening={editorMode === "select"}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 24 || newBox.height < 24) return oldBox;
                  if (newBox.width > OBJECT_MAX_VISUAL_EDGE || newBox.height > OBJECT_MAX_VISUAL_EDGE) {
                    const scale = Math.min(
                      OBJECT_MAX_VISUAL_EDGE / Math.max(1, newBox.width),
                      OBJECT_MAX_VISUAL_EDGE / Math.max(1, newBox.height),
                    );
                    return {
                      ...newBox,
                      width: newBox.width * scale,
                      height: newBox.height * scale,
                    };
                  }
                  return newBox;
                }}
                onTransformStart={() => {
                  for (const id of transformableSelectedIds) {
                    locallyDraggingIds.current.add(id);
                    setWallNodeDragging(id, true);
                  }
                  if (primaryId) {
                    setManipulating(true, primaryId);
                    broadcastSelection();
                  }
                }}
                onTransform={() => {
                  syncTransform();
                }}
                onTransformEnd={() => {
                  commitTransformSelection();
                  for (const id of transformableSelectedIds) {
                    locallyDraggingIds.current.delete(id);
                    setWallNodeDragging(id, false);
                  }
                  if (primaryId) {
                    setManipulating(false, primaryId);
                  }
                }}
              />
            )}
            </Group>
          </Layer>
          <PeerHighlightsLayer currentSessionId={currentSessionId} />
          {!readOnly && isStrokeMode(editorMode) && (
            <Layer>
              {editorMode === "tape" && draftPoints && draftPoints.length === 4 && (
                <WallTapeShape
                  points={draftPoints}
                  fill={drawColor}
                  opacity={tapeOpacity ?? HIGHLIGHTER_OPACITY}
                  height={tapeStrokeWidth}
                  endStyle={tapeEndStyle}
                  pattern={tapePattern}
                  patternAccent={tapePatternAccent}
                />
              )}
              {editorMode === "pen" && draftPoints && draftPoints.length >= 4 && (() => {
                const style = getPenStyle(penStyleId);
                const width = penStrokeWidth ?? style.strokeWidth;
                const shadowBlur = resolvePenShadowBlur(style, width);
                return (
                  <Line
                    points={draftPoints}
                    stroke={drawColor}
                    strokeWidth={width}
                    opacity={style.opacity}
                    tension={style.tension}
                    lineCap={style.lineCap}
                    lineJoin={style.lineJoin}
                    shadowEnabled={shadowBlur > 0}
                    shadowColor={drawColor}
                    shadowBlur={shadowBlur}
                    shadowOpacity={style.shadowOpacity ?? 0}
                    shadowForStrokeEnabled={shadowBlur > 0}
                    listening={false}
                  />
                );
              })()}
              <Rect
                width={wallBounds.width}
                height={wallBounds.height}
                fill="rgba(0,0,0,0)"
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  startDrawing(e.target.getStage());
                }}
                onTouchStart={(e) => {
                  e.cancelBubble = true;
                  startDrawing(e.target.getStage());
                }}
                onMouseMove={(e) => updateDraftLine(e.target.getStage())}
                onTouchMove={(e) => updateDraftLine(e.target.getStage())}
                onMouseUp={(e) => handleStagePointerUp(e.target.getStage())}
                onTouchEnd={(e) => handleStagePointerUp(e.target.getStage())}
              />
            </Layer>
          )}
          {!readOnly && editorMode === "text" && (
            <Layer>
              <Rect
                width={wallBounds.width}
                height={wallBounds.height}
                fill="rgba(0,0,0,0)"
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  placeTextAtPointer(e.target.getStage());
                }}
                onTouchStart={(e) => {
                  e.cancelBubble = true;
                  placeTextAtPointer(e.target.getStage());
                }}
              />
            </Layer>
          )}
          </Stage>
        </WallContextMenuProvider>
      </div>

      {stageOverlay}

      {wallId && currentSessionId && (
        <WallPresenceOverlay
          currentSessionId={currentSessionId}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />
      )}
    </div>
  );
}

export default memo(KonvaWallStage);
