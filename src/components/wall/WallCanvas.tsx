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
}

interface WallCanvasProps {
  themeId: WallThemeId;
  drawColor: string;
  drawWidth: number;
  readOnly?: boolean;
  enablePinchZoom?: boolean;
  resolvePhotoUrl?: (file: File) => Promise<string>;
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

const WallCanvas = forwardRef<WallCanvasHandle, WallCanvasProps>(
  function WallCanvas(
    {
      themeId,
      drawColor,
      drawWidth,
      readOnly = false,
      enablePinchZoom = true,
      resolvePhotoUrl,
      onSelectionChange,
      onCanvasChange,
      onHistoryChange,
      onReady,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<FabricCanvas | null>(null);
    const fabricModuleRef = useRef<FabricModule | null>(null);
    const historyRef = useRef(new CanvasHistory());
    const drawColorRef = useRef(drawColor);
    const drawWidthRef = useRef(drawWidth);
    const [isCanvasReady, setIsCanvasReady] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [viewportZoom, setViewportZoom] = useState(1);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const theme = getWallTheme(themeId);

    const readOnlyRef = useRef(readOnly);
    readOnlyRef.current = readOnly;
    const resolvePhotoUrlRef = useRef(resolvePhotoUrl);
    resolvePhotoUrlRef.current = resolvePhotoUrl;

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

    const notifyHistory = useCallback(() => {
      onHistoryChangeRef.current?.({
        canUndo: historyRef.current.canUndo,
        canRedo: historyRef.current.canRedo,
      });
    }, []);

    const saveHistory = useCallback(() => {
      const canvas = getCanvas();
      if (!canvas) return;
      historyRef.current.push(canvas.toJSON());
      notifyHistory();
      onCanvasChangeRef.current?.();
    }, [getCanvas, notifyHistory]);

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

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const updateSize = () => {
        setSize({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      };

      updateSize();
      const observer = new ResizeObserver(updateSize);
      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (!canvasElRef.current || size.width === 0 || size.height === 0) return;
      if (fabricRef.current) return;

      let disposed = false;

      import("fabric").then((fabric) => {
        if (disposed || !canvasElRef.current || fabricRef.current) return;

        fabricModuleRef.current = fabric;

        const canvas = new fabric.Canvas(canvasElRef.current, {
          width: size.width,
          height: size.height,
          selection: true,
          preserveObjectStacking: true,
          allowTouchScrolling: false,
          targetFindTolerance: 14,
        });

        fabricRef.current = canvas;
        historyRef.current.reset(canvas.toJSON());
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
        canvas.on("object:added", () => debouncedSaveHistoryRef.current());
        canvas.on("object:modified", () => debouncedSaveHistoryRef.current());
        canvas.on("object:removed", saveHistory);
        canvas.on("path:created", saveHistory);
      });

      return () => {
        disposed = true;
        fabricRef.current?.dispose();
        fabricRef.current = null;
        fabricModuleRef.current = null;
        setIsCanvasReady(false);
      };
    }, [size.width, size.height, saveHistory, notifyHistory]);

    useEffect(() => {
      if (!enablePinchZoom || !isCanvasReady) return;
      const container = containerRef.current;
      if (!container) return;

      let cleanup: (() => void) | undefined;
      void import("@/lib/canvas-viewport").then(({ setupCanvasPinchZoom }) => {
        cleanup = setupCanvasPinchZoom(container, getCanvas, setViewportZoom);
      });

      return () => cleanup?.();
    }, [enablePinchZoom, isCanvasReady, getCanvas]);

    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas || size.width === 0 || size.height === 0) return;
      canvas.setDimensions({ width: size.width, height: size.height });
      canvas.requestRenderAll();
    }, [size]);

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

        const img = await fabric.FabricImage.fromURL(url, getImageLoadOptions(url));

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
        if (!canvas) return;

        const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return;

        const rect = containerRef.current?.getBoundingClientRect();
        const x = rect ? e.clientX - rect.left : undefined;
        const y = rect ? e.clientY - rect.top : undefined;

        for (const file of files) {
          await addPhotoToCanvas(file, x !== undefined && y !== undefined ? { x, y } : undefined);
        }
      },
      [getCanvas, addPhotoToCanvas],
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
            await canvas.loadFromJSON(state);
            canvas.requestRenderAll();
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
            await canvas.loadFromJSON(state);
            canvas.requestRenderAll();
            onSelectionChangeRef.current(!!canvas.getActiveObject());
          });
          notifyHistory();
          onCanvasChangeRef.current?.();
        },

        toJSON: () => {
          const canvas = getCanvas();
          return canvas?.toJSON() ?? {};
        },

        loadFromJSON: async (json: object) => {
          const canvas = getCanvas();
          if (!canvas) return;
          await historyRef.current.runRestore(async () => {
            await canvas.loadFromJSON(json);
            applyReadOnly(canvas);
            canvas.requestRenderAll();
          });
          historyRef.current.reset(canvas.toJSON());
          notifyHistory();
        },

        clear: () => {
          const canvas = getCanvas();
          if (!canvas) return;
          canvas.clear();
          canvas.requestRenderAll();
          historyRef.current.reset(canvas.toJSON());
          notifyHistory();
          onCanvasChangeRef.current?.();
        },
      }),
      [getCanvas, addPhotoToCanvas, addPhotoFromDataUrl, applyBrush, saveHistory, notifyHistory, applyReadOnly],
    );

    return (
      <div
        ref={containerRef}
        className="relative h-full w-full touch-none bg-white"
        onDragOver={(e) => {
          if (readOnly) return;
          e.preventDefault();
          if ([...e.dataTransfer.types].includes("Files")) setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          if (readOnly) return;
          if (!containerRef.current?.contains(e.relatedTarget as Node)) {
            setIsDragOver(false);
          }
        }}
        onDrop={(e) => {
          if (readOnly) return;
          handleDrop(e);
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: theme.background }}
        />
        {isDragOver && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="rounded-2xl border-2 border-dashed border-foreground/30 px-8 py-6 text-center">
              <p className="text-sm font-medium text-foreground">사진을 여기에 놓으세요</p>
              <p className="mt-1 text-xs text-muted">네컷사진을 끌어다 붙일 수 있어요</p>
            </div>
          </div>
        )}
        {!isCanvasReady && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white text-sm text-muted">
            캔버스 준비 중...
          </div>
        )}
        {enablePinchZoom && viewportZoom !== 1 && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-foreground/75 px-3 py-1 text-xs font-medium text-background backdrop-blur-sm">
            {Math.round(viewportZoom * 100)}% · 두 번 탭하면 원래 크기
          </div>
        )}
        {enablePinchZoom && viewportZoom !== 1 && (
          <button
            type="button"
            aria-label="줌 초기화"
            className="absolute bottom-3 right-3 z-20 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-sm ring-1 ring-foreground/10"
            onClick={() => {
              const canvas = getCanvas();
              if (!canvas) return;
              void import("@/lib/canvas-viewport").then(({ resetCanvasViewport }) => {
                resetCanvasViewport(canvas);
                setViewportZoom(1);
              });
            }}
          >
            100%
          </button>
        )}
        <canvas ref={canvasElRef} className="relative z-10" />
      </div>
    );
  },
);

function getImageLoadOptions(url: string): { crossOrigin?: "anonymous" } {
  if (url.startsWith("data:") || url.startsWith("blob:")) {
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
