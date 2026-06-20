"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  useState,
} from "react";
import type { WallThemeId } from "@/types/wall";
import { getWallTheme } from "@/lib/wall-themes";
import { CanvasHistory } from "@/lib/canvas-history";
import { debounce } from "@/lib/debounce";
import { setupWorkspacePinchZoom, type WorkspaceViewport } from "@/lib/canvas-viewport";
import {
  DEFAULT_WALL_BOUNDS,
  computeFitScale,
  getObjectsBounds,
  reconcileWallBounds,
  type WallBounds,
} from "@/lib/wall-bounds";
import { stripBrokenImagesFromFabricJson } from "@/lib/canvas-image-sanitize";
import { normalizeFabricJsonForStorage } from "@/lib/storage/wall-photos";
import { packCanvasJson, unpackCanvasJson } from "@/lib/wall-canvas-json";

export type EditorMode = "select" | "draw";

export interface WallCanvasHandle {
  addPhoto: (file: File, position?: { x: number; y: number }) => Promise<void>;
  addPhotoFromDataUrl: (dataUrl: string, position?: { x: number; y: number }) => Promise<void>;
  addTape: (color: string) => void;
  addSticker: (emoji: string) => void;
  addSvgSticker: (src: string) => Promise<void>;
  setMode: (mode: EditorMode) => void;
  setDrawColor: (color: string) => void;
  setDrawWidth: (width: number) => void;
  bringForward: () => void;
  sendBackward: () => void;
  deleteSelected: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  toJSON: () => object;
  loadFromJSON: (json: object) => Promise<void>;
  clear: () => void;
  getWallStageElement: () => HTMLElement | null;
}

interface WallCanvasProps {
  themeId: WallThemeId;
  drawColor: string;
  drawWidth: number;
  readOnly?: boolean;
  enablePinchZoom?: boolean;
  resolvePhotoUrl?: (file: File) => Promise<string>;
  resolveStoragePhotos?: (packedJson: object) => Promise<object>;
  resolvePhotoSrc?: (src: string) => Promise<string>;
  onSelectionChange: (hasSelection: boolean) => void;
  onCanvasChange?: () => void;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  onReady?: () => void;
}

type FabricModule = typeof import("fabric");
type FabricCanvas = InstanceType<FabricModule["Canvas"]>;

const OBJECT_DEFAULTS = {
  cornerStyle: "circle" as const,
  cornerColor: "#c4c4c4",
  borderColor: "#c4c4c4",
  transparentCorners: false,
  touchCornerSize: 24,
  cornerSize: 12,
};

function clientToCanvasCoords(
  clientX: number,
  clientY: number,
  stageEl: HTMLElement,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  const rect = stageEl.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * canvasWidth,
    y: ((clientY - rect.top) / rect.height) * canvasHeight,
  };
}

const WallCanvas = forwardRef<WallCanvasHandle, WallCanvasProps>(
  function WallCanvas(
    {
      themeId,
      drawColor,
      drawWidth,
      readOnly = false,
      enablePinchZoom = true,
      resolvePhotoUrl,
      resolveStoragePhotos,
      resolvePhotoSrc,
      onSelectionChange,
      onCanvasChange,
      onHistoryChange,
      onReady,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const workspaceRef = useRef<HTMLDivElement>(null);
    const wallStageRef = useRef<HTMLDivElement>(null);
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<FabricCanvas | null>(null);
    const fabricModuleRef = useRef<FabricModule | null>(null);
    const historyRef = useRef(new CanvasHistory());
    const drawColorRef = useRef(drawColor);
    const drawWidthRef = useRef(drawWidth);
    const [isCanvasReady, setIsCanvasReady] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const zoomHintRef = useRef<HTMLDivElement>(null);
    const zoomResetRef = useRef<HTMLButtonElement>(null);
    const pinchCleanupRef = useRef<(() => void) | null>(null);
    const viewportRef = useRef<WorkspaceViewport | null>(null);
    const [wallBounds, setWallBounds] = useState<WallBounds>(DEFAULT_WALL_BOUNDS);
    const wallBoundsRef = useRef<WallBounds>(DEFAULT_WALL_BOUNDS);
    const theme = getWallTheme(themeId);

    const readOnlyRef = useRef(readOnly);
    const enablePinchZoomRef = useRef(enablePinchZoom);
    enablePinchZoomRef.current = enablePinchZoom;

    const updateZoomUi = useCallback((zoom: number) => {
      const visible = Math.abs(zoom - 1) > 0.01;
      const hint = zoomHintRef.current;
      const reset = zoomResetRef.current;
      if (hint) {
        hint.style.display = visible ? "block" : "none";
        hint.textContent = `${Math.round(zoom * 100)}% · 두 번 탭하면 원래 크기`;
      }
      if (reset) {
        reset.style.display = visible ? "block" : "none";
      }
    }, []);

    const updateZoomUiRef = useRef(updateZoomUi);
    updateZoomUiRef.current = updateZoomUi;

    readOnlyRef.current = readOnly;
    const resolvePhotoUrlRef = useRef(resolvePhotoUrl);
    resolvePhotoUrlRef.current = resolvePhotoUrl;
    const resolveStoragePhotosRef = useRef(resolveStoragePhotos);
    resolveStoragePhotosRef.current = resolveStoragePhotos;
    const resolvePhotoSrcRef = useRef(resolvePhotoSrc);
    resolvePhotoSrcRef.current = resolvePhotoSrc;

    const applyReadOnly = useCallback((canvas: FabricCanvas) => {
      if (!readOnlyRef.current) return;
      canvas.selection = false;
      canvas.isDrawingMode = false;
      canvas.skipTargetFind = true;
      canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
      canvas.requestRenderAll();
    }, []);

    drawColorRef.current = drawColor;
    drawWidthRef.current = drawWidth;
    const onCanvasChangeRef = useRef(onCanvasChange);
    const onHistoryChangeRef = useRef(onHistoryChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onReadyRef = useRef(onReady);
    onCanvasChangeRef.current = onCanvasChange;
    onHistoryChangeRef.current = onHistoryChange;
    onSelectionChangeRef.current = onSelectionChange;
    onReadyRef.current = onReady;

    const getCanvas = useCallback(() => fabricRef.current, []);

    const packCurrentCanvas = useCallback(() => {
      const canvas = getCanvas();
      if (!canvas) return null;
      return packCanvasJson(
        normalizeFabricJsonForStorage(canvas.toJSON()),
        wallBoundsRef.current,
      );
    }, [getCanvas]);

    const applyWallDimensions = useCallback(
      (canvas: FabricCanvas, bounds: WallBounds) => {
        canvas.setDimensions({ width: bounds.width, height: bounds.height });
        canvas.requestRenderAll();
      },
      [],
    );

    const reconcileWallSize = useCallback(() => {
      const canvas = getCanvas();
      if (!canvas || readOnlyRef.current) return;

      const objBounds = getObjectsBounds(canvas);
      const next = reconcileWallBounds(wallBoundsRef.current, objBounds);
      if (!next) return;

      wallBoundsRef.current = next;
      setWallBounds(next);
      applyWallDimensions(canvas, next);
      onCanvasChangeRef.current?.();
    }, [getCanvas, applyWallDimensions]);

    const debouncedBoundsCheckRef = useRef(debounce(() => reconcileWallSize(), 100));
    debouncedBoundsCheckRef.current = debounce(() => reconcileWallSize(), 100);

    const handleResetZoom = useCallback(() => {
      viewportRef.current?.reset();
    }, []);

    const notifyHistory = useCallback(() => {
      onHistoryChangeRef.current?.({
        canUndo: historyRef.current.canUndo,
        canRedo: historyRef.current.canRedo,
      });
    }, []);

    const saveHistory = useCallback(() => {
      const packed = packCurrentCanvas();
      if (!packed) return;
      historyRef.current.push(packed);
      notifyHistory();
      onCanvasChangeRef.current?.();
    }, [packCurrentCanvas, notifyHistory]);

    const debouncedSaveHistoryRef = useRef(debounce(() => saveHistory(), 300));
    debouncedSaveHistoryRef.current = debounce(() => saveHistory(), 300);

    const applyBrush = useCallback(
      (canvas: FabricCanvas, fabric: FabricModule) => {
        const brush = new fabric.PencilBrush(canvas);
        brush.color = drawColorRef.current;
        brush.width = drawWidthRef.current;
        canvas.freeDrawingBrush = brush;
      },
      [],
    );

    const fitWallToWorkspace = useCallback(() => {
      const workspace = workspaceRef.current;
      const viewport = viewportRef.current;
      if (!workspace || !viewport) return;

      const fit = computeFitScale(
        workspace.clientWidth,
        workspace.clientHeight,
        wallBoundsRef.current.width,
        wallBoundsRef.current.height,
      );
      if (fit < 1) viewport.setScale(fit);
    }, []);

    useEffect(() => {
      if (!canvasElRef.current || fabricRef.current) return;

      let disposed = false;
      const bounds = wallBoundsRef.current;

      import("fabric").then((fabric) => {
        if (disposed || !canvasElRef.current || fabricRef.current) return;

        fabricModuleRef.current = fabric;

        const canvas = new fabric.Canvas(canvasElRef.current, {
          width: bounds.width,
          height: bounds.height,
          selection: true,
          preserveObjectStacking: true,
          allowTouchScrolling: false,
          targetFindTolerance: 14,
        });

        fabricRef.current = canvas;
        historyRef.current.reset(packCanvasJson(normalizeFabricJsonForStorage(canvas.toJSON()), bounds));
        notifyHistory();
        applyReadOnly(canvas);
        setIsCanvasReady(true);
        onReadyRef.current?.();

        const handleSelection = () => {
          onSelectionChangeRef.current(!!canvas.getActiveObject());
        };

        canvas.on("selection:created", handleSelection);
        canvas.on("selection:updated", handleSelection);
        canvas.on("selection:cleared", () => onSelectionChangeRef.current(false));
        canvas.on("object:added", () => {
          debouncedSaveHistoryRef.current();
          debouncedBoundsCheckRef.current();
        });
        canvas.on("object:modified", () => {
          debouncedSaveHistoryRef.current();
          debouncedBoundsCheckRef.current();
        });
        canvas.on("object:removed", () => {
          saveHistory();
          debouncedBoundsCheckRef.current();
        });
        canvas.on("path:created", () => {
          saveHistory();
          debouncedBoundsCheckRef.current();
        });

        pinchCleanupRef.current?.();
        viewportRef.current = null;

        if (enablePinchZoomRef.current && workspaceRef.current && wallStageRef.current) {
          const viewport = setupWorkspacePinchZoom(
            workspaceRef.current,
            wallStageRef.current,
            (zoom) => updateZoomUiRef.current(zoom),
          );
          viewportRef.current = viewport;
          pinchCleanupRef.current = viewport.cleanup;
          fitWallToWorkspace();
        }
      });

      return () => {
        disposed = true;
        pinchCleanupRef.current?.();
        pinchCleanupRef.current = null;
        viewportRef.current = null;
        fabricRef.current?.dispose();
        fabricRef.current = null;
        fabricModuleRef.current = null;
        setIsCanvasReady(false);
      };
    }, [saveHistory, notifyHistory, applyReadOnly, fitWallToWorkspace]);

    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      applyWallDimensions(canvas, wallBounds);
    }, [wallBounds, applyWallDimensions]);

    useEffect(() => {
      const workspace = workspaceRef.current;
      if (!workspace) return;

      const observer = new ResizeObserver(() => {
        if (!viewportRef.current || viewportRef.current.getScale() > 1.01) return;
        fitWallToWorkspace();
      });
      observer.observe(workspace);
      return () => observer.disconnect();
    }, [fitWallToWorkspace]);

    useEffect(() => {
      const canvas = fabricRef.current;
      const fabric = fabricModuleRef.current;
      if (!canvas || !fabric || !canvas.isDrawingMode) return;
      applyBrush(canvas, fabric);
    }, [drawColor, drawWidth, applyBrush]);

    const placePhotoOnCanvas = useCallback(
      async (url: string, position?: { x: number; y: number }) => {
        const canvas = getCanvas();
        const fabric = fabricModuleRef.current;
        if (!canvas || !fabric || readOnlyRef.current) return;

        let loadUrl = url;
        if (resolvePhotoSrcRef.current) {
          loadUrl = await resolvePhotoSrcRef.current(url);
        }

        let img;
        try {
          img = await fabric.FabricImage.fromURL(loadUrl, getImageLoadOptions(loadUrl));
        } catch {
          return;
        }

        const maxWidth = Math.min(220, canvas.width * 0.35);
        const scale = Math.min(1, maxWidth / (img.width || maxWidth));
        const left = position?.x ?? canvas.width * 0.2 + Math.random() * (canvas.width * 0.2);
        const top = position?.y ?? canvas.height * 0.15 + Math.random() * (canvas.height * 0.2);

        img.set({
          left,
          top,
          angle: position ? 0 : -8 + Math.random() * 16,
          scaleX: scale,
          scaleY: scale,
          originX: "center",
          originY: "center",
          ...OBJECT_DEFAULTS,
        });

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
      },
      [getCanvas],
    );

    const addPhotoToCanvas = useCallback(
      async (file: File, position?: { x: number; y: number }) => {
        const url = resolvePhotoUrlRef.current
          ? await resolvePhotoUrlRef.current(file)
          : await readFileAsDataUrl(file);
        await placePhotoOnCanvas(url, position);
      },
      [placePhotoOnCanvas],
    );

    const addPhotoFromDataUrl = useCallback(
      async (dataUrl: string, position?: { x: number; y: number }) => {
        await placePhotoOnCanvas(dataUrl, position);
      },
      [placePhotoOnCanvas],
    );

    const handleDrop = useCallback(
      async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const canvas = getCanvas();
        const stage = wallStageRef.current;
        if (!canvas || !stage) return;

        const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return;

        const { x, y } = clientToCanvasCoords(
          e.clientX,
          e.clientY,
          stage,
          canvas.width ?? wallBoundsRef.current.width,
          canvas.height ?? wallBoundsRef.current.height,
        );

        for (const file of files) {
          await addPhotoToCanvas(file, { x, y });
        }
      },
      [getCanvas, addPhotoToCanvas],
    );

    const restoreFromPackedJson = useCallback(
      async (json: object) => {
        const canvas = getCanvas();
        if (!canvas) return;

        let packed = json;
        if (resolveStoragePhotosRef.current) {
          packed = await resolveStoragePhotosRef.current(json);
        }

        const { fabricJson, wallBounds: savedBounds } = unpackCanvasJson(packed);
        const { json: loadableJson, removedUrls } =
          await stripBrokenImagesFromFabricJson(fabricJson);

        try {
          await canvas.loadFromJSON(loadableJson);
        } catch {
          await canvas.loadFromJSON({ ...loadableJson, objects: [] });
        }

        if (removedUrls.length > 0) {
          onCanvasChangeRef.current?.();
        }

        const objBounds = getObjectsBounds(canvas);
        const bounds = reconcileWallBounds(savedBounds, objBounds) ?? savedBounds;
        wallBoundsRef.current = bounds;
        setWallBounds(bounds);

        applyWallDimensions(canvas, bounds);
        applyReadOnly(canvas);
        canvas.requestRenderAll();
      },
      [getCanvas, applyWallDimensions, applyReadOnly],
    );

    useImperativeHandle(
      ref,
      () => ({
        addPhoto: addPhotoToCanvas,
        addPhotoFromDataUrl,

        addTape: (color: string) => {
          const canvas = getCanvas();
          const fabric = fabricModuleRef.current;
          if (!canvas || !fabric) return;

          const tape = new fabric.Rect({
            left: canvas.width * 0.2 + Math.random() * (canvas.width * 0.3),
            top: canvas.height * 0.2 + Math.random() * (canvas.height * 0.3),
            width: 140,
            height: 28,
            fill: color,
            opacity: 0.75,
            angle: -4 + Math.random() * 8,
            rx: 2,
            ry: 2,
            ...OBJECT_DEFAULTS,
          });

          canvas.add(tape);
          canvas.setActiveObject(tape);
          canvas.requestRenderAll();
        },

        addSticker: (emoji: string) => {
          const canvas = getCanvas();
          const fabric = fabricModuleRef.current;
          if (!canvas || !fabric || readOnlyRef.current) return;

          const sticker = new fabric.FabricText(emoji, {
            left: canvas.width * 0.25 + Math.random() * (canvas.width * 0.25),
            top: canvas.height * 0.2 + Math.random() * (canvas.height * 0.3),
            fontSize: 48,
            angle: -12 + Math.random() * 24,
            ...OBJECT_DEFAULTS,
          });

          canvas.add(sticker);
          canvas.setActiveObject(sticker);
          canvas.requestRenderAll();
        },

        addSvgSticker: async (svg: string) => {
          const canvas = getCanvas();
          const fabric = fabricModuleRef.current;
          if (!canvas || !fabric || readOnlyRef.current) return;

          const { objects, options } = await fabric.loadSVGFromString(svg);
          const elements = objects.filter((obj) => obj != null);
          if (!elements.length) return;

          const sticker = fabric.util.groupSVGElements(elements, options);
          const size = 64;
          const bounds = sticker.getBoundingRect();
          const scale = size / Math.max(bounds.width || size, bounds.height || size, 1);

          sticker.set({
            left: canvas.width * 0.25 + Math.random() * (canvas.width * 0.25),
            top: canvas.height * 0.2 + Math.random() * (canvas.height * 0.3),
            scaleX: scale,
            scaleY: scale,
            angle: -12 + Math.random() * 24,
            ...OBJECT_DEFAULTS,
          });

          canvas.add(sticker);
          canvas.setActiveObject(sticker);
          canvas.requestRenderAll();
        },

        setMode: (mode: EditorMode) => {
          const canvas = getCanvas();
          const fabric = fabricModuleRef.current;
          if (!canvas || !fabric) return;

          if (mode === "draw") {
            applyBrush(canvas, fabric);
            canvas.isDrawingMode = true;
            canvas.discardActiveObject();
            canvas.requestRenderAll();
          } else {
            canvas.isDrawingMode = false;
          }
        },

        setDrawColor: (color: string) => {
          const canvas = getCanvas();
          if (!canvas?.freeDrawingBrush) return;
          canvas.freeDrawingBrush.color = color;
        },

        setDrawWidth: (width: number) => {
          const canvas = getCanvas();
          if (!canvas?.freeDrawingBrush) return;
          canvas.freeDrawingBrush.width = width;
        },

        bringForward: () => {
          const canvas = getCanvas();
          const obj = canvas?.getActiveObject();
          if (canvas && obj) {
            canvas.bringObjectForward(obj);
            canvas.requestRenderAll();
            saveHistory();
          }
        },

        sendBackward: () => {
          const canvas = getCanvas();
          const obj = canvas?.getActiveObject();
          if (canvas && obj) {
            canvas.sendObjectBackwards(obj);
            canvas.requestRenderAll();
            saveHistory();
          }
        },

        deleteSelected: () => {
          const canvas = getCanvas();
          const obj = canvas?.getActiveObject();
          if (canvas && obj) {
            canvas.remove(obj);
            canvas.discardActiveObject();
            canvas.requestRenderAll();
            onSelectionChangeRef.current(false);
          }
        },

        undo: async () => {
          const canvas = getCanvas();
          if (!canvas) return;
          const state = historyRef.current.undo();
          if (!state) return;
          await historyRef.current.runRestore(async () => {
            await restoreFromPackedJson(state);
            onSelectionChangeRef.current(!!canvas.getActiveObject());
          });
          notifyHistory();
          onCanvasChangeRef.current?.();
        },

        redo: async () => {
          const canvas = getCanvas();
          if (!canvas) return;
          const state = historyRef.current.redo();
          if (!state) return;
          await historyRef.current.runRestore(async () => {
            await restoreFromPackedJson(state);
            onSelectionChangeRef.current(!!canvas.getActiveObject());
          });
          notifyHistory();
          onCanvasChangeRef.current?.();
        },

        toJSON: () => packCurrentCanvas() ?? {},

        loadFromJSON: async (json: object) => {
          const canvas = getCanvas();
          if (!canvas) return;
          await historyRef.current.runRestore(async () => {
            await restoreFromPackedJson(json);
          });
          const packed = packCurrentCanvas();
          if (packed) {
            historyRef.current.reset(packed);
          }
          notifyHistory();
        },

        clear: () => {
          const canvas = getCanvas();
          if (!canvas) return;
          canvas.clear();
          wallBoundsRef.current = DEFAULT_WALL_BOUNDS;
          setWallBounds(DEFAULT_WALL_BOUNDS);
          applyWallDimensions(canvas, DEFAULT_WALL_BOUNDS);
          historyRef.current.reset(packCurrentCanvas() ?? packCanvasJson({}, DEFAULT_WALL_BOUNDS));
          notifyHistory();
          onCanvasChangeRef.current?.();
        },

        getWallStageElement: () => wallStageRef.current,
      }),
      [
        getCanvas,
        addPhotoToCanvas,
        addPhotoFromDataUrl,
        applyBrush,
        saveHistory,
        notifyHistory,
        applyWallDimensions,
        restoreFromPackedJson,
        packCurrentCanvas,
      ],
    );

    return (
      <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-neutral-200">
        <div
          ref={workspaceRef}
          className="workspace-grid absolute inset-0 touch-none overflow-hidden"
          onDragOver={(e) => {
            if (readOnly) return;
            e.preventDefault();
            if ([...e.dataTransfer.types].includes("Files")) setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            if (readOnly) return;
            if (!workspaceRef.current?.contains(e.relatedTarget as Node)) {
              setIsDragOver(false);
            }
          }}
          onDrop={(e) => {
            if (readOnly) return;
            handleDrop(e);
          }}
        >
          <div
            ref={wallStageRef}
            className="absolute left-1/2 top-1/2 shadow-lg ring-1 ring-black/10"
            style={{
              width: wallBounds.width,
              height: wallBounds.height,
              background: theme.background,
            }}
          >
            <canvas ref={canvasElRef} className="block" />
          </div>
        </div>

        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="rounded-2xl border-2 border-dashed border-foreground/30 bg-white/90 px-8 py-6 text-center backdrop-blur-sm">
              <p className="text-sm font-medium text-foreground">사진을 벽 위에 놓으세요</p>
              <p className="mt-1 text-xs text-muted">네컷사진을 끌어다 붙일 수 있어요</p>
            </div>
          </div>
        )}

        {!isCanvasReady && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-200 text-sm text-muted">
            캔버스 준비 중...
          </div>
        )}

        {enablePinchZoom && (
          <>
            <div
              ref={zoomHintRef}
              style={{ display: "none" }}
              className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-foreground/75 px-3 py-1 text-xs font-medium text-background backdrop-blur-sm"
            />
            <button
              ref={zoomResetRef}
              type="button"
              aria-label="줌 초기화"
              style={{ display: "none" }}
              className="absolute bottom-3 right-3 z-20 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-sm ring-1 ring-foreground/10"
              onClick={handleResetZoom}
            >
              100%
            </button>
          </>
        )}
      </div>
    );
  },
);

function getImageLoadOptions(url: string): { crossOrigin?: "anonymous" } {
  if (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("wall-photo://")
  ) {
    return {};
  }
  return { crossOrigin: "anonymous" };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default WallCanvas;
