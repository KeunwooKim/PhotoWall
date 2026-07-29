"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Layer, Line, Rect, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import type { WallThemeId } from "@/types/wall";
import type { EditorMode } from "@/components/wall/editor-types";
import { getWallTheme } from "@/lib/wall-themes";
import { computeFitScale } from "@/lib/wall-bounds";
import { debounce } from "@/lib/debounce";
import { parseWallScene, serializeWallScene } from "@/lib/wall-scene/fabric-import";
import { fingerprintPersistableScene, fingerprintSceneObjects } from "@/lib/wall-scene/scene-fingerprint";
import {
  clampLineEndpoints,
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
import { containerCenter } from "@/lib/wall-scene/viewport-zoom";
import { peerHighlightLayout, peerLockedObjectIds, peerSelectionsByObjectId } from "@/lib/wall-scene/presence-utils";
import { setWallNodeDragging } from "@/lib/wall-scene/realtime/wall-node-sync";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import { createLivePatchBroadcaster } from "@/lib/wall-scene/realtime/live-object-patch";
import { isTransformableObject } from "@/lib/wall-scene/selectable-objects";
import { objectsInMarquee, primarySelectedId } from "@/lib/wall-scene/selection-utils";
import {
  WallPresenceState,
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
import WallHighlighterRect from "./WallHighlighterRect";
import WallPresenceOverlay from "./WallPresenceOverlay";
import PeerObjectHighlight from "./PeerObjectHighlight";
import SnapGuideLines from "./SnapGuideLines";
import {
  WallContextMenuProvider,
  type WallContextMenuRequestFn,
} from "./wall-context-menu-context";

function isStrokeMode(mode: EditorMode) {
  return mode === "pen" || mode === "tape";
}

function clientPointFromEvent(evt: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ("touches" in evt && evt.touches.length > 0) {
    return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
  }
  if ("clientX" in evt) {
    return { x: evt.clientX, y: evt.clientY };
  }
  return null;
}

export interface KonvaWallStageProps {
  themeId: WallThemeId;
  initialJson?: object;
  readOnly?: boolean;
  wallId?: string;
  resolvePhotoSrc?: (src: string) => Promise<string>;
  peers?: WallPresenceState[];
  currentUserId?: string;
  currentSessionId?: string;
  onDocumentChange?: (json: object) => void;
  onPointerMove?: (x: number, y: number) => void;
  onPresenceSelection?: (objectIds: string[] | null) => void;
  onPresenceManipulating?: (active: boolean) => void;
  onObjectPatch?: (id: string, patch: WallObjectPatch) => void;
  onReady?: () => void;
  wallStageRef?: RefObject<HTMLDivElement | null>;
  konvaStageRef?: RefObject<Konva.Stage | null>;
  editorMode?: EditorMode;
  drawColor?: string;
  highlighterMaxLength?: number;
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
  cropAspectPreset?: CropAspectPresetId;
  onCropDraftChange?: (
    crop: PhotoCropRect,
    display: { x: number; y: number; width: number; height: number },
  ) => void;
  onCropNaturalSize?: (width: number, height: number) => void;
}

export default function KonvaWallStage({
  themeId,
  initialJson,
  readOnly = false,
  wallId,
  resolvePhotoSrc,
  peers = [],
  currentUserId,
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
  highlighterMaxLength = 160,
  penStyleId = "ink",
  penStrokeWidth,
  onGuardQuotaAdd,
  onQuotaBlocked,
  onRequestSelectMode,
  onEditText,
  onStartPhotoCrop,
  onContextMenuRequest,
  cropPhotoId = null,
  cropAspectPreset = "free",
  onCropDraftChange,
  onCropNaturalSize,
}: KonvaWallStageProps) {
  const theme = getWallTheme(themeId);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRegistry = useRef(new Map<string, Konva.Group>());
  const locallyDraggingIds = useRef(new Set<string>());
  const drawingRef = useRef<LineEndpoints | null>(null);
  const freehandRef = useRef<number[] | null>(null);
  const editorModeRef = useRef(editorMode);
  const drawColorRef = useRef(drawColor);
  const highlighterMaxLengthRef = useRef(highlighterMaxLength);
  const penStyleIdRef = useRef(penStyleId);
  const penStrokeWidthRef = useRef(penStrokeWidth);

  editorModeRef.current = editorMode;
  drawColorRef.current = drawColor;
  highlighterMaxLengthRef.current = highlighterMaxLength;
  penStyleIdRef.current = penStyleId;
  penStrokeWidthRef.current = penStrokeWidth;

  const [draftPoints, setDraftPoints] = useState<number[] | null>(null);

  const document = useWallSceneStore((s) => s.document);
  const selectedIds = useWallSceneStore((s) => s.selectedIds);
  const snapGuides = useWallSceneStore((s) => s.snapGuides);
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
  const panX = useWallSceneStore((s) => s.panX);
  const panY = useWallSceneStore((s) => s.panY);
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
  const wallBounds = document.meta.wallBounds;

  const primaryId = primarySelectedId(selectedIds);

  const peerLockedIds = useMemo(
    () => peerLockedObjectIds(peers, currentUserId),
    [peers, currentUserId],
  );

  const peerHighlightsByObjectId = useMemo(
    () => peerSelectionsByObjectId(peers, currentUserId),
    [peers, currentUserId],
  );

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
          isTransformableObject(object) &&
          !peerLockedIds.has(object.id),
      )
      .map((object) => object.id);
  }, [cropPhotoId, document.objects, selectedIds, peerLockedIds]);

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
        onDocumentChangeRef.current?.(
          serializeWallScene(useWallSceneStore.getState().document),
        );
      },
    );
    return unsub;
  }, []);

  useEffect(() => {
    const reconcile = debounce(() => {
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

  useEffect(() => {
    setViewportScale(fitScale * userZoom);
  }, [fitScale, userZoom, setViewportScale]);

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
  const stagePanRef = useRef<{ x: number; y: number } | null>(null);

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
      if (e.touches.length !== 2 || pinchDistRef.current === null) return;
      if (isStrokeMode(editorModeRef.current)) return;
      e.preventDefault();

      const midpoint = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };

      if (pinchMidpointRef.current) {
        const panDx = midpoint.x - pinchMidpointRef.current.x;
        const panDy = midpoint.y - pinchMidpointRef.current.y;
        if (panDx !== 0 || panDy !== 0) {
          const zoom = useWallSceneStore.getState().userZoom;
          if (Math.abs(zoom - 1) > 0.01) {
            addPan(panDx, panDy);
          }
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
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      spaceHeldRef.current = false;
      containerPanRef.current = null;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || readOnly) return;

    const onMouseDown = (e: MouseEvent) => {
      if (!spaceHeldRef.current || isStrokeMode(editorModeRef.current)) return;
      if (e.button !== 0) return;
      containerPanRef.current = { x: e.clientX, y: e.clientY };
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
      editorMode === "select" && !cropPhotoId && transformableSelectedIds.length > 0;
    const nodes = canTransform
      ? transformableSelectedIds
          .map((id) => nodeRegistry.current.get(id))
          .filter((node): node is Konva.Group => node != null)
      : [];

    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [transformableSelectedIds, editorMode, cropPhotoId]);

  const visibleObjects = useMemo(() => {
    const viewport = {
      x: 0,
      y: 0,
      width: wallBounds.width,
      height: wallBounds.height,
    };
    return cullObjectsForViewport(
      [...document.objects].sort((a, b) => a.zIndex - b.zIndex),
      viewport,
    );
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
    for (const id of transformableSelectedIds) {
      const node = nodeRegistry.current.get(id);
      if (!node) continue;

      const patch = {
        x: node.x(),
        y: node.y(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
        rotation: node.rotation(),
      };
      patchObject(id, patch);
      broadcastWallPatch(id, patch);
    }
    if (transformableSelectedIds.length > 0) {
      useWallSceneStore.getState().recordHistory();
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
      onPointerMove(pos.x, pos.y);
    },
    [onPointerMove],
  );

  const reportPointerFromClient = useCallback(
    (clientX: number, clientY: number) => {
      if (!onPointerMove) return;

      const stageEl = wallStageRef?.current;
      if (!stageEl) return;

      const rect = stageEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      onPointerMove(
        ((clientX - rect.left) / rect.width) * wallBounds.width,
        ((clientY - rect.top) / rect.height) * wallBounds.height,
      );
    },
    [onPointerMove, wallBounds.height, wallBounds.width, wallStageRef],
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

    const preview =
      clampLineEndpoints(draft.x1, draft.y1, pos.x, pos.y, highlighterMaxLengthRef.current) ??
      { x1: draft.x1, y1: draft.y1, x2: pos.x, y2: pos.y };

    setDraftPoints(endpointsToPoints(preview));
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

    const clamped = clampLineEndpoints(
      draft.x1,
      draft.y1,
      draft.x2,
      draft.y2,
      highlighterMaxLengthRef.current,
    );
    if (!clamped) return;

    commitTapeStroke(clamped, drawColorRef.current);
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
      const pos = stage.getPointerPosition();
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

      if (readOnly || editorModeRef.current !== "select" || !isStageTarget || !stage) return;

      const zoom = useWallSceneStore.getState().userZoom;
      const pt = clientPointFromEvent(nativeEvt);
      if (!shiftKey && Math.abs(zoom - 1) > 0.01 && pt) {
        stagePanRef.current = pt;
        return;
      }

      const pos = stage.getPointerPosition();
      if (!pos) return;

      marqueeStartRef.current = { x1: pos.x, y1: pos.y, shiftKey };
      setMarqueeRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    },
    [readOnly, reportPointer],
  );

  const handleStagePointerMove = useCallback(
    (stage: Konva.Stage | null, nativeEvt?: MouseEvent | TouchEvent) => {
      reportPointer(stage);

      if (stagePanRef.current && nativeEvt) {
        const pt = clientPointFromEvent(nativeEvt);
        if (pt) {
          const dx = pt.x - stagePanRef.current.x;
          const dy = pt.y - stagePanRef.current.y;
          if (dx !== 0 || dy !== 0) addPan(dx, dy);
          stagePanRef.current = pt;
          return;
        }
      }

      const start = marqueeStartRef.current;
      if (!stage || !start) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      const x = Math.min(start.x1, pos.x);
      const y = Math.min(start.y1, pos.y);
      const width = Math.abs(pos.x - start.x1);
      const height = Math.abs(pos.y - start.y1);
      setMarqueeRect({ x, y, width, height });
    },
    [addPan, reportPointer],
  );

  const handleStagePointerUp = useCallback(
    (stage: Konva.Stage | null) => {
      stagePanRef.current = null;

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

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-neutral-200">
      <div
        ref={wallStageRef}
        className={`absolute left-1/2 top-1/2 origin-center shadow-lg ring-1 ring-black/10 ${
          showGrid ? "workspace-grid" : ""
        }`}
        style={{
          width: wallBounds.width,
          height: wallBounds.height,
          transform: `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${viewportScale})`,
          background: showGrid ? undefined : theme.background,
          backgroundSize: showGrid
            ? `${gridSize}px ${gridSize}px`
            : theme.backgroundSize,
          backgroundPosition: showGrid ? undefined : theme.backgroundPosition,
        }}
      >
        <WallContextMenuProvider
          value={
            !readOnly && editorMode === "select" ? (onContextMenuRequest ?? null) : null
          }
        >
          <Stage
            ref={konvaStageRef}
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
            <SnapGuideLines
              guides={snapGuides}
              wallWidth={wallBounds.width}
              wallHeight={wallBounds.height}
            />
            {!readOnly && editorMode === "select" && !cropPhotoId && (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 24 || newBox.height < 24) return oldBox;
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
          </Layer>
          <Layer listening={false}>
            {visibleObjects.map((object) => {
              const layout = peerHighlightLayout(object);
              if (!layout) return null;

              const highlights = peerHighlightsByObjectId.get(object.id);
              if (!highlights?.length) return null;

              return (
                <Group
                  key={`peer-highlight-${object.id}`}
                  x={layout.x}
                  y={layout.y}
                  rotation={layout.rotation}
                  scaleX={layout.scaleX}
                  scaleY={layout.scaleY}
                  offsetY={layout.offsetY ?? 0}
                >
                  <PeerObjectHighlight
                    peers={highlights}
                    width={layout.width}
                    height={layout.height}
                    scaleX={layout.scaleX}
                    scaleY={layout.scaleY}
                  />
                </Group>
              );
            })}
          </Layer>
          {!readOnly && isStrokeMode(editorMode) && (
            <Layer>
              {editorMode === "tape" && draftPoints && draftPoints.length === 4 && (
                <WallHighlighterRect
                  points={draftPoints}
                  fill={drawColor}
                  opacity={HIGHLIGHTER_OPACITY}
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

      {wallId && currentSessionId && peers.length > 0 && (
        <WallPresenceOverlay
          peers={peers}
          currentSessionId={currentSessionId}
          currentUserId={currentUserId}
          wallWidth={wallBounds.width}
          wallHeight={wallBounds.height}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          wallScale={viewportScale}
        />
      )}
    </div>
  );
}
