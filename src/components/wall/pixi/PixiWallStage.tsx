"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import type { EditorMode } from "@/components/wall/editor-types";
import type { PenStyleId } from "@/lib/wall-scene/pen";
import { commitPenStroke, commitTapeStroke } from "@/lib/wall-scene/add-path";
import { addTextToWallScene } from "@/lib/wall-scene/add-text";
import {
  finalizeTapeEndpoints,
  HIGHLIGHTER_OPACITY,
  type LineEndpoints,
  endpointsToPoints,
} from "@/lib/wall-scene/highlighter";
import { PEN_SAMPLE_DISTANCE } from "@/lib/wall-scene/pen";
import {
  buildTapePatternDrawList,
  buildTapePolygon,
} from "@/lib/wall-scene/tape-geometry";
import {
  DEFAULT_TAPE_END_STYLE,
  DEFAULT_TAPE_PATTERN,
  type TapeEndStyle,
  type TapePatternId,
} from "@/lib/wall-scene/tape-style";
import { parseWallScene, serializeWallScene } from "@/lib/wall-scene/fabric-import";
import { fingerprintPersistableScene } from "@/lib/wall-scene/scene-fingerprint";
import { shouldSkipWallPersist } from "@/lib/wall-scene/realtime/wall-persist-gate";
import { debounce } from "@/lib/debounce";
import { getWallTheme } from "@/lib/wall-themes";
import type { WallThemeId } from "@/types/wall";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import { resolveWallpaperSrc } from "@/lib/storage/wall-preview";
import { loadOptimizedHtmlImage } from "@/lib/storage/load-html-image";
import {
  loadWallViewport,
  saveWallViewport,
} from "@/lib/wall-scene/wall-viewport-storage";
import { objectsInMarquee } from "@/lib/wall-scene/selection-utils";
import { ensureStickersForIds } from "@/lib/stickers";
import { wallpaperDisplayOffset } from "@/lib/wall-bounds";
import { setViewportWorldCenterGetter } from "@/lib/wall-scene/wall-home-placement";
import "./pixi-csp";
import { Texture, TilingSprite, Graphics } from "pixi.js";
import { PixiWallEngine, type PixiStageExport } from "./pixi-wall-engine";
import PixiPresenceOverlay from "./PixiPresenceOverlay";
import PixiPhotoCropOverlay from "./PixiPhotoCropOverlay";
import { usePixiSnapGuides } from "./usePixiSnapGuides";
import { usePixiPeerHighlights } from "./usePixiPeerHighlights";
import { usePixiWallGrid } from "./usePixiWallGrid";
import type { CropAspectPresetId } from "@/lib/wall-scene/photo-crop";
import { stashWallPreviewFromStage } from "@/hooks/useWallPreviewFlush";
import type { PhotoCropRect, WallScenePhoto } from "@/types/wall-scene-v2";
import type { WallContextMenuRequestFn } from "@/components/wall/konva/wall-context-menu-context";

export type WallStageExportHandle = PixiStageExport;

export interface PixiWallStageProps {
  themeId: WallThemeId;
  initialJson?: object;
  readOnly?: boolean;
  wallId?: string;
  resolvePhotoSrc?: (src: string) => Promise<string>;
  currentSessionId?: string;
  onDocumentChange?: (json: object) => void;
  onPointerMove?: (x: number, y: number) => void;
  onPresenceSelection?: (objectIds: string[] | null) => void;
  onPresenceManipulating?: (active: boolean) => void;
  onObjectPatch?: (id: string, patch: WallObjectPatch) => void;
  onReady?: () => void;
  wallStageRef?: RefObject<HTMLDivElement | null>;
  /** Export handle (Konva Stage or Pixi adapter). */
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
  penStrokeWidth?: number;
  onGuardQuotaAdd?: (count?: number) => boolean;
  onQuotaBlocked?: () => void;
  onRequestSelectMode?: () => void;
  onEditText?: (objectId: string) => void;
  onStartPhotoCrop?: (objectId: string) => void;
  onContextMenuRequest?: WallContextMenuRequestFn;
  cropPhotoId?: string | null;
  interactionLockId?: string | null;
  cropAspectPreset?: CropAspectPresetId;
  onCropDraftChange?: (
    crop: PhotoCropRect,
    display: { x: number; y: number; width: number; height: number },
  ) => void;
  onCropNaturalSize?: (width: number, height: number) => void;
  onEngineReady?: (engine: PixiWallEngine | null) => void;
  instagramExportActive?: boolean;
  /** Rendered inside the stage host (viewport-aligned overlays). */
  stageOverlay?: React.ReactNode;
}

function PixiWallStage({
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
  cropPhotoId = null,
  cropAspectPreset = "free",
  onCropDraftChange,
  onCropNaturalSize,
  onEngineReady,
  instagramExportActive = false,
  stageOverlay,
}: PixiWallStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PixiWallEngine | null>(null);
  const wallpaperRef = useRef<TilingSprite | null>(null);
  const draftGfxRef = useRef<Graphics | null>(null);
  const drawingRef = useRef<LineEndpoints | null>(null);
  const freehandRef = useRef<number[] | null>(null);
  const marqueeStartRef = useRef<{ x1: number; y1: number; shiftKey: boolean } | null>(
    null,
  );
  const editorModeRef = useRef(editorMode);
  const drawColorRef = useRef(drawColor);
  const tapeStrokeWidthRef = useRef(tapeStrokeWidth);
  const tapeEndStyleRef = useRef(tapeEndStyle);
  const tapePatternRef = useRef(tapePattern);
  const tapePatternAccentRef = useRef(tapePatternAccent);
  const tapeOpacityRef = useRef(tapeOpacity);
  const penStyleIdRef = useRef(penStyleId);
  const penStrokeWidthRef = useRef(penStrokeWidth);
  const cropPhotoIdRef = useRef(cropPhotoId);
  const instagramExportActiveRef = useRef(instagramExportActive);
  const selectedIdsRef = useRef(selectedIdsPlaceholder());
  const wallIdRef = useRef(wallId);
  const themeIdRef = useRef(themeId);
  const readOnlyRef = useRef(readOnly);

  editorModeRef.current = editorMode;
  drawColorRef.current = drawColor;
  tapeStrokeWidthRef.current = tapeStrokeWidth;
  tapeEndStyleRef.current = tapeEndStyle;
  tapePatternRef.current = tapePattern;
  tapePatternAccentRef.current = tapePatternAccent;
  tapeOpacityRef.current = tapeOpacity;
  penStyleIdRef.current = penStyleId;
  penStrokeWidthRef.current = penStrokeWidth;
  cropPhotoIdRef.current = cropPhotoId;
  instagramExportActiveRef.current = instagramExportActive;
  wallIdRef.current = wallId;
  themeIdRef.current = themeId;
  readOnlyRef.current = readOnly;

  const document = useWallSceneStore((s) => s.document);
  const documentRef = useRef(document);
  documentRef.current = document;
  const selectedIds = useWallSceneStore((s) => s.selectedIds);
  selectedIdsRef.current = selectedIds;
  const loadDocument = useWallSceneStore((s) => s.loadDocument);
  const setSelectedIds = useWallSceneStore((s) => s.setSelectedIds);
  const selectObject = useWallSceneStore((s) => s.selectObject);
  const clearSelection = useWallSceneStore((s) => s.clearSelection);

  const theme = getWallTheme(themeId);
  const wallBounds = document.meta.wallBounds;

  // Force re-render once engine boots so hooks below receive a non-null engine.
  const [engineTick, setEngineTick] = useState(0);
  const engine = engineRef.current;
  void engineTick;
  usePixiSnapGuides(engine);
  usePixiPeerHighlights(engine, currentSessionId);
  usePixiWallGrid(engine);

  useEffect(() => {
    setViewportWorldCenterGetter(() => {
      const live = engineRef.current;
      if (!live) return null;
      const center = live.viewport.center;
      return { x: center.x, y: center.y };
    });
    return () => setViewportWorldCenterGetter(null);
  }, [engineTick]);

  const attachWallStageRef = useCallback(
    (node: HTMLDivElement | null) => {
      (hostRef as MutableRefObject<HTMLDivElement | null>).current = node;
      if (wallStageRef) {
        (wallStageRef as MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [wallStageRef],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || engineRef.current) return;
    let cancelled = false;

    void (async () => {
      const engine = await PixiWallEngine.create({
        host,
        wallX: wallBounds.x,
        wallY: wallBounds.y,
        wallWidth: wallBounds.width,
        wallHeight: wallBounds.height,
        readOnly,
        resolvePhotoSrc,
        onSelect: (id, additive) => {
          const current = selectedIdsRef.current;
          if (additive) {
            const next = current.includes(id)
              ? current.filter((x) => x !== id)
              : [...current, id];
            setSelectedIds(next);
            onPresenceSelection?.(next);
          } else {
            selectObject(id);
            onPresenceSelection?.([id]);
          }
        },
        onClearSelection: () => {
          clearSelection();
          onPresenceSelection?.(null);
        },
        onBackgroundPointerDown: (x, y, shiftKey) => {
          if (cropPhotoIdRef.current || instagramExportActiveRef.current) return;
          if (editorModeRef.current !== "select") {
            clearSelection();
            onPresenceSelection?.(null);
            return;
          }
          marqueeStartRef.current = { x1: x, y1: y, shiftKey };
          const draft = draftGfxRef.current;
          draft?.clear();
        },
        onReady,
        onPointerMove,
        onManipulationChange: (active) => onPresenceManipulating?.(active),
        onEditText,
        onStartPhotoCrop,
        onObjectPatch,
      });
      if (cancelled) {
        engine.destroy();
        return;
      }
      engineRef.current = engine;
      setEngineTick((n) => n + 1);
      onEngineReady?.(engine);

      if (konvaStageRef) {
        (konvaStageRef as MutableRefObject<WallStageExportHandle | null>).current =
          engine.getExportAdapter();
      }

      const draft = new Graphics();
      engine.overlayLayer.addChild(draft);
      draftGfxRef.current = draft;

      const wallpaperSrc = resolveWallpaperSrc(theme.background);
      if (wallpaperSrc) {
        try {
          const img = await loadOptimizedHtmlImage(wallpaperSrc);
          if (!cancelled && engineRef.current) {
            const tex = Texture.from(img);
            const tile = new TilingSprite({
              texture: tex,
              width: wallBounds.width,
              height: wallBounds.height,
            });
            tile.position.set(wallBounds.x, wallBounds.y);
            const wp =
              useWallSceneStore.getState().document.meta.wallpaperOffset ?? {
                x: 0,
                y: 0,
              };
            const offset = wallpaperDisplayOffset(wallBounds, wp);
            tile.tilePosition.x = offset.x;
            tile.tilePosition.y = offset.y;
            tile.eventMode = "none";
            engine.world.addChildAt(tile, 0);
            wallpaperRef.current = tile;
            engine.wallpaperSprite = tile;
          }
        } catch {
          // ignore wallpaper load failure
        }
      }

      if (initialJson) {
        const parsed = parseWallScene(initialJson);
        if (parsed) loadDocument(parsed);
      }

      const id = wallIdRef.current;
      if (id) {
        const savedCamera = loadWallViewport(id);
        if (savedCamera) {
          useWallSceneStore.getState().setCamera(savedCamera);
          engine.applyStoreCamera(savedCamera);
        }
      }
    })();

    return () => {
      cancelled = true;
      onEngineReady?.(null);
      const engine = engineRef.current;
      if (engine && !readOnlyRef.current) {
        const id = wallIdRef.current;
        if (id) {
          const camera = engine.flushCameraToStore();
          saveWallViewport(id, camera);
        }
        stashWallPreviewFromStage({
          wallId: id,
          themeId: themeIdRef.current,
          stage: engine.getExportAdapter(),
        });
      }
      if (konvaStageRef) {
        (konvaStageRef as MutableRefObject<WallStageExportHandle | null>).current = null;
      }
      engine?.destroy();
      engineRef.current = null;
      wallpaperRef.current = null;
      draftGfxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once per mount
  }, []);

  useEffect(() => {
    engineRef.current?.setWallSize(
      wallBounds.width,
      wallBounds.height,
      wallBounds.x,
      wallBounds.y,
    );
    if (wallpaperRef.current) {
      wallpaperRef.current.position.set(wallBounds.x, wallBounds.y);
      wallpaperRef.current.width = wallBounds.width;
      wallpaperRef.current.height = wallBounds.height;
      const decorative =
        useWallSceneStore.getState().document.meta.wallpaperOffset ?? { x: 0, y: 0 };
      const tile = wallpaperDisplayOffset(wallBounds, decorative);
      wallpaperRef.current.tilePosition.x = tile.x;
      wallpaperRef.current.tilePosition.y = tile.y;
    }
  }, [wallBounds.x, wallBounds.y, wallBounds.width, wallBounds.height]);

  // Swap wallpaper when theme changes (boot effect only loads once).
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    let cancelled = false;
    const wallpaperSrc = resolveWallpaperSrc(theme.background);
    void (async () => {
      if (!wallpaperSrc) {
        if (wallpaperRef.current) {
          wallpaperRef.current.visible = false;
        }
        return;
      }
      try {
        const img = await loadOptimizedHtmlImage(wallpaperSrc);
        if (cancelled || !engineRef.current) return;
        const tex = Texture.from(img);
        const existing = wallpaperRef.current;
        if (existing) {
          existing.texture = tex;
          existing.position.set(wallBounds.x, wallBounds.y);
          existing.width = wallBounds.width;
          existing.height = wallBounds.height;
          const wp =
            useWallSceneStore.getState().document.meta.wallpaperOffset ?? {
              x: 0,
              y: 0,
            };
          const offset = wallpaperDisplayOffset(wallBounds, wp);
          existing.tilePosition.x = offset.x;
          existing.tilePosition.y = offset.y;
          existing.visible = true;
        } else {
          const tile = new TilingSprite({
            texture: tex,
            width: wallBounds.width,
            height: wallBounds.height,
          });
          tile.position.set(wallBounds.x, wallBounds.y);
          const wp =
            useWallSceneStore.getState().document.meta.wallpaperOffset ?? {
              x: 0,
              y: 0,
            };
          const offset = wallpaperDisplayOffset(wallBounds, wp);
          tile.tilePosition.x = offset.x;
          tile.tilePosition.y = offset.y;
          tile.eventMode = "none";
          engine.world.addChildAt(tile, 0);
          wallpaperRef.current = tile;
          engine.wallpaperSprite = tile;
        }
      } catch {
        // ignore wallpaper load failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [themeId, theme.background, engineTick, wallBounds.x, wallBounds.y, wallBounds.width, wallBounds.height]);

  useEffect(() => {
    void engineRef.current?.syncObjects(document.objects);
  }, [document.objects]);

  useEffect(() => {
    const stickerIds = document.objects
      .filter((o) => o.type === "sticker")
      .map((o) => o.stickerId);
    if (stickerIds.length === 0) return;
    void ensureStickersForIds(stickerIds).then(() => {
      void engineRef.current?.syncObjects(document.objects);
    });
  }, [document.objects]);

  useEffect(() => {
    engineRef.current?.setSelectedIds(selectedIds);
  }, [selectedIds]);

  // Zoom reset button only — do not mirror every store camera change back to Pixi
  // (that fights wheel/pinch and prevents zoom).
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    return useWallSceneStore.subscribe((state, prev) => {
      const resetToDefault =
        Math.abs(state.userZoom - 1) < 0.0001 &&
        Math.abs(state.panX) < 0.5 &&
        Math.abs(state.panY) < 0.5;
      const wasAdjusted =
        Math.abs(prev.userZoom - 1) >= 0.01 ||
        Math.abs(prev.panX) >= 1 ||
        Math.abs(prev.panY) >= 1;
      if (!resetToDefault || !wasAdjusted) return;
      engine.applyStoreCamera({
        userZoom: state.userZoom,
        panX: state.panX,
        panY: state.panY,
      });
    });
  }, [engineTick]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !wallId) return;
    const persist = debounce((camera: { userZoom: number; panX: number; panY: number }) => {
      saveWallViewport(wallId, camera);
    }, 300);
    engine.setCameraPersistHandler(persist);
    return () => {
      persist.cancel();
      engine.setCameraPersistHandler(null);
    };
  }, [engineTick, wallId]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setViewportChangeHandler(() => {
      void engine.syncObjects(documentRef.current.objects);
    });
    return () => engine.setViewportChangeHandler(null);
  }, [engineTick]);

  useEffect(() => {
    const hand = editorMode === "hand";
    const drawing = editorMode === "pen" || editorMode === "tape" || editorMode === "text";
    const cropping = !!cropPhotoId;
    engineRef.current?.setPanZoomEnabled((hand || readOnly) && !cropping);
    // Objects move only in select mode — hand/draw/crop must not drag them.
    engineRef.current?.setObjectsInteractive(
      !readOnly && editorMode === "select" && !cropping,
    );
    if (editorMode === "select" && !readOnly && !cropping) {
      engineRef.current?.setPanZoomEnabled(false);
      engineRef.current?.viewport.plugins.resume("wheel");
      engineRef.current?.viewport.plugins.resume("pinch");
    }
    if (hand || drawing) {
      clearSelection();
    }
    if (editorMode !== "select" || cropping) {
      marqueeStartRef.current = null;
      draftGfxRef.current?.clear();
    }
  }, [editorMode, readOnly, clearSelection, engineTick, cropPhotoId]);

  useEffect(() => {
    const flush = () => {
      const engine = engineRef.current;
      const id = wallIdRef.current;
      if (!engine || !id || readOnlyRef.current) return;
      const camera = engine.flushCameraToStore();
      saveWallViewport(id, camera);
    };
    const onHide = () => {
      if (globalThis.document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    globalThis.document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      globalThis.document.removeEventListener("visibilitychange", onHide);
    };
  }, [engineTick]);

  useEffect(() => {
    if (!onDocumentChange) return;
    const persist = debounce(() => {
      if (shouldSkipWallPersist()) return;
      const json = serializeWallScene(useWallSceneStore.getState().document);
      onDocumentChange(json);
    }, 400);
    const unsub = useWallSceneStore.subscribe((state, prev) => {
      if (
        fingerprintPersistableScene(state.document) !==
        fingerprintPersistableScene(prev.document)
      ) {
        persist();
      }
    });
    return () => {
      unsub();
      persist.cancel?.();
    };
  }, [onDocumentChange]);

  const [containerSize, setContainerSize] = useState({ width: 390, height: 600 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
      engineRef.current?.resize();
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || readOnly) return;

    const onDown = (e: PointerEvent) => {
      const mode = editorModeRef.current;
      if (mode !== "pen" && mode !== "tape" && mode !== "text") return;
      const canvas = engine.app.canvas;
      if (e.target !== canvas) return;

      const world = engine.viewport.toWorld({ x: e.offsetX, y: e.offsetY });

      if (mode === "text") {
        if (onGuardQuotaAdd && !onGuardQuotaAdd(1)) {
          onQuotaBlocked?.();
          return;
        }
        const created = addTextToWallScene({ x: world.x, y: world.y });
        selectObject(created.id);
        onEditText?.(created.id);
        onRequestSelectMode?.();
        return;
      }

      if (mode === "tape") {
        drawingRef.current = { x1: world.x, y1: world.y, x2: world.x, y2: world.y };
        return;
      }

      freehandRef.current = [world.x, world.y];
    };

    const paintMarquee = (x1: number, y1: number, x2: number, y2: number) => {
      const draft = draftGfxRef.current;
      if (!draft) return;
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const w = Math.abs(x2 - x1);
      const h = Math.abs(y2 - y1);
      const stroke = Math.max(1, 1.5 / Math.max(0.001, engine.viewport.scale.x));
      draft.clear();
      draft.rect(x, y, w, h);
      draft.fill({ color: 0x4a90d9, alpha: 0.14 });
      draft.stroke({ width: stroke, color: 0x4a90d9, alpha: 0.95 });
    };

    const finishMarquee = (worldX: number, worldY: number) => {
      const start = marqueeStartRef.current;
      if (!start) return;
      marqueeStartRef.current = null;
      draftGfxRef.current?.clear();

      const minX = Math.min(start.x1, worldX);
      const minY = Math.min(start.y1, worldY);
      const maxX = Math.max(start.x1, worldX);
      const maxY = Math.max(start.y1, worldY);
      const width = maxX - minX;
      const height = maxY - minY;

      if (width < 4 && height < 4) {
        if (!start.shiftKey) {
          clearSelection();
          onPresenceSelection?.(null);
        }
        return;
      }

      const hitIds = objectsInMarquee(useWallSceneStore.getState().document.objects, {
        minX,
        minY,
        maxX,
        maxY,
      });
      if (start.shiftKey) {
        const current = selectedIdsRef.current;
        const merged = [...new Set([...current, ...hitIds])];
        setSelectedIds(merged);
        onPresenceSelection?.(merged);
      } else {
        setSelectedIds(hitIds);
        onPresenceSelection?.(hitIds.length ? hitIds : null);
      }
    };

    const onMove = (e: PointerEvent) => {
      const mode = editorModeRef.current;
      const world = engine.viewport.toWorld({ x: e.offsetX, y: e.offsetY });
      onPointerMove?.(world.x, world.y);

      if (marqueeStartRef.current && mode === "select") {
        paintMarquee(
          marqueeStartRef.current.x1,
          marqueeStartRef.current.y1,
          world.x,
          world.y,
        );
        return;
      }

      const draft = draftGfxRef.current;
      if (!draft) return;

      if (mode === "tape" && drawingRef.current) {
        drawingRef.current = {
          ...drawingRef.current,
          x2: world.x,
          y2: world.y,
        };
        const line = drawingRef.current;
        draft.clear();
        const height = tapeStrokeWidthRef.current;
        const polygon = buildTapePolygon(
          line.x1,
          line.y1,
          line.x2,
          line.y2,
          height,
          tapeEndStyleRef.current,
        );
        const color =
          Number.parseInt(drawColorRef.current.replace("#", ""), 16) || 0xfff59d;
        const accent =
          Number.parseInt(tapePatternAccentRef.current.replace("#", ""), 16) ||
          0xffffff;
        if (polygon && polygon.length >= 6) {
          draft.poly(polygon);
          draft.fill({
            color,
            alpha: tapeOpacityRef.current ?? HIGHLIGHTER_OPACITY,
          });
          const decor = buildTapePatternDrawList(
            line.x1,
            line.y1,
            line.x2,
            line.y2,
            height,
            tapePatternRef.current,
          );
          for (const s of decor.strokes) {
            draft.moveTo(s.x1, s.y1);
            draft.lineTo(s.x2, s.y2);
            draft.stroke({
              width: s.width,
              color: accent,
              alpha: 0.5,
              cap: "round",
            });
          }
          for (const d of decor.dots) {
            draft.circle(d.x, d.y, d.r);
            draft.fill({ color: accent, alpha: 0.55 });
          }
        } else {
          const pts = endpointsToPoints(line);
          draft.moveTo(pts[0], pts[1]);
          draft.lineTo(pts[2], pts[3]);
          draft.stroke({
            width: height,
            color,
            alpha: 0.55,
            cap: "round",
          });
        }
        return;
      }

      if (mode === "pen" && freehandRef.current) {
        const pts = freehandRef.current;
        const lastX = pts[pts.length - 2];
        const lastY = pts[pts.length - 1];
        if (Math.hypot(world.x - lastX, world.y - lastY) >= PEN_SAMPLE_DISTANCE) {
          pts.push(world.x, world.y);
          draft.clear();
          draft.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) draft.lineTo(pts[i], pts[i + 1]);
          const color = Number.parseInt(drawColorRef.current.replace("#", ""), 16) || 0x222222;
          draft.stroke({
            width: penStrokeWidthRef.current ?? 4,
            color,
            alpha: 0.9,
            cap: "round",
            join: "round",
          });
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      if (marqueeStartRef.current) {
        const canvas = engine.app.canvas;
        const rect = canvas.getBoundingClientRect();
        const world = engine.viewport.toWorld({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        finishMarquee(world.x, world.y);
        return;
      }

      const draft = draftGfxRef.current;
      if (drawingRef.current) {
        const draftLine = drawingRef.current;
        drawingRef.current = null;
        draft?.clear();
        const finalized = finalizeTapeEndpoints(
          draftLine.x1,
          draftLine.y1,
          draftLine.x2,
          draftLine.y2,
        );
        if (finalized) {
          commitTapeStroke(finalized, drawColorRef.current, {
            strokeWidth: tapeStrokeWidthRef.current,
            opacity: tapeOpacityRef.current,
            tapeEndStyle: tapeEndStyleRef.current,
            tapePattern: tapePatternRef.current,
            tapePatternAccent: tapePatternAccentRef.current,
          });
        }
        onRequestSelectMode?.();
        return;
      }
      if (freehandRef.current && freehandRef.current.length >= 4) {
        commitPenStroke(
          freehandRef.current,
          drawColorRef.current,
          penStyleIdRef.current,
          penStrokeWidthRef.current,
        );
        freehandRef.current = null;
        draft?.clear();
      } else {
        freehandRef.current = null;
        draft?.clear();
      }
    };

    const canvas = engine.app.canvas;
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [
    readOnly,
    onGuardQuotaAdd,
    onQuotaBlocked,
    onRequestSelectMode,
    onEditText,
    onPointerMove,
    onPresenceSelection,
    selectObject,
    setSelectedIds,
    clearSelection,
    document.meta.revision,
    engineTick,
  ]);

  useEffect(() => {
    if (!cropPhotoId) return;
    selectObject(cropPhotoId);
  }, [cropPhotoId, selectObject]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !cropPhotoId) return;
    engine.setObjectHidden(cropPhotoId, true);
    engine.setObjectsInteractive(false);
    return () => {
      engine.setObjectHidden(cropPhotoId, false);
      if (!readOnly && editorMode === "select") {
        engine.setObjectsInteractive(true);
      }
    };
  }, [cropPhotoId, editorMode, readOnly, engineTick]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !instagramExportActive) return;
    engine.setObjectsInteractive(false);
    return () => {
      if (!readOnly && editorMode === "select" && !cropPhotoId) {
        engine.setObjectsInteractive(true);
      }
    };
  }, [cropPhotoId, editorMode, instagramExportActive, readOnly, engineTick]);

  const cropPhoto = useMemo((): WallScenePhoto | null => {
    if (!cropPhotoId) return null;
    const object = document.objects.find((item) => item.id === cropPhotoId);
    return object?.type === "photo" ? object : null;
  }, [cropPhotoId, document.objects]);

  return (
    <div className="relative h-full w-full touch-none overflow-hidden overscroll-none bg-neutral-200">
      <div
        ref={attachWallStageRef}
        className="absolute inset-0"
        data-wall-renderer="pixi"
        style={{ background: "#d4d4d4" }}
      />
      {engineRef.current && cropPhoto && onCropDraftChange && onCropNaturalSize ? (
        <PixiPhotoCropOverlay
          engine={engineRef.current}
          photo={cropPhoto}
          aspectPreset={cropAspectPreset}
          resolvePhotoSrc={resolvePhotoSrc}
          onDraftChange={onCropDraftChange}
          onNaturalSize={onCropNaturalSize}
        />
      ) : null}
      {stageOverlay}
      {currentSessionId ? (
        <PixiPresenceOverlay
          currentSessionId={currentSessionId}
          engine={engineRef.current}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />
      ) : null}
    </div>
  );
}

function selectedIdsPlaceholder(): string[] {
  return [];
}

export default memo(PixiWallStage);
