"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Layer, Rect, Stage, Transformer } from "react-konva";
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
import { commitHighlighterLine } from "@/lib/wall-scene/add-path";
import { cullObjectsForViewport } from "@/lib/wall-scene/viewport-culling";
import { peerSelectionsByObjectId } from "@/lib/wall-scene/presence-utils";
import { setWallNodeDragging } from "@/lib/wall-scene/realtime/wall-node-sync";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import { throttle } from "@/lib/throttle";
import {
  WallPresenceState,
  WallSceneObject,
  WallScenePhoto,
} from "@/types/wall-scene-v2";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import WallPhotoNode from "./WallPhotoNode";
import WallStickerNode from "./WallStickerNode";
import WallEmojiNode from "./WallEmojiNode";
import WallTapeNode from "./WallTapeNode";
import WallPathNode from "./WallPathNode";
import WallHighlighterRect from "./WallHighlighterRect";
import WallPresenceOverlay from "./WallPresenceOverlay";
import PeerObjectHighlight from "./PeerObjectHighlight";

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
  onPresenceSelection?: (objectId: string | null) => void;
  onPresenceManipulating?: (active: boolean) => void;
  onObjectPatch?: (id: string, patch: WallObjectPatch) => void;
  onReady?: () => void;
  wallStageRef?: RefObject<HTMLDivElement | null>;
  editorMode?: EditorMode;
  drawColor?: string;
  highlighterMaxLength?: number;
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
  editorMode = "select",
  drawColor = "#fff59d",
  highlighterMaxLength = 160,
}: KonvaWallStageProps) {
  const theme = getWallTheme(themeId);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRegistry = useRef(new Map<string, Konva.Group>());
  const locallyDraggingIds = useRef(new Set<string>());
  const drawingRef = useRef<LineEndpoints | null>(null);
  const editorModeRef = useRef(editorMode);
  const drawColorRef = useRef(drawColor);
  const highlighterMaxLengthRef = useRef(highlighterMaxLength);

  editorModeRef.current = editorMode;
  drawColorRef.current = drawColor;
  highlighterMaxLengthRef.current = highlighterMaxLength;

  const [draftPoints, setDraftPoints] = useState<number[] | null>(null);

  const document = useWallSceneStore((s) => s.document);
  const selectedId = useWallSceneStore((s) => s.selectedId);
  const loadDocument = useWallSceneStore((s) => s.loadDocument);
  const setSelectedId = useWallSceneStore((s) => s.setSelectedId);
  const setViewportScale = useWallSceneStore((s) => s.setViewportScale);
  const viewportScale = useWallSceneStore((s) => s.viewportScale);
  const patchObject = useWallSceneStore((s) => s.patchObject);

  const [containerSize, setContainerSize] = useState({ width: 390, height: 600 });
  const wallBounds = document.meta.wallBounds;

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

  useEffect(() => {
    const fit = computeFitScale(
      containerSize.width,
      containerSize.height,
      wallBounds.width,
      wallBounds.height,
    );
    setViewportScale(fit);
  }, [
    containerSize.width,
    containerSize.height,
    wallBounds.width,
    wallBounds.height,
    setViewportScale,
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

  const registerNode = useCallback((id: string, node: Konva.Group | null) => {
    if (node) nodeRegistry.current.set(id, node);
    else nodeRegistry.current.delete(id);
  }, []);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    const selectedObject = selectedId
      ? document.objects.find((object) => object.id === selectedId)
      : null;
    const canTransform =
      editorMode === "select" &&
      selectedObject != null &&
      selectedObject.type !== "path";
    const node = canTransform && selectedId ? nodeRegistry.current.get(selectedId) : null;

    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, document.objects, editorMode]);

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

  const visiblePhotos = useMemo(
    () => visibleObjects.filter((object): object is WallScenePhoto => object.type === "photo"),
    [visibleObjects],
  );

  const notifyPresenceSelection = useCallback(
    (objectId: string | null) => {
      onPresenceSelection?.(objectId);
    },
    [onPresenceSelection],
  );

  const renderSceneObject = useCallback(
    (object: WallSceneObject) => {
      const select = () => {
        setSelectedId(object.id);
        notifyPresenceSelection(object.id);
      };

      if (object.type === "photo") {
        return (
          <WallPhotoNode
            key={object.id}
            object={object}
            readOnly={readOnly || editorMode === "draw"}
            resolvePhotoSrc={resolvePhotoSrc}
            onSelect={select}
            onInteractionStart={() => notifyPresenceSelection(object.id)}
            onObjectPatch={onObjectPatch}
            onManipulationChange={setManipulating}
            registerNode={registerNode}
          />
        );
      }

      if (object.type === "sticker") {
        return (
          <WallStickerNode
            key={object.id}
            object={object}
            readOnly={readOnly || editorMode === "draw"}
            onSelect={select}
            onInteractionStart={() => notifyPresenceSelection(object.id)}
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
            readOnly={readOnly || editorMode === "draw"}
            onSelect={select}
            onInteractionStart={() => notifyPresenceSelection(object.id)}
            onManipulationChange={setManipulating}
            registerNode={registerNode}
          />
        );
      }

      if (object.type === "tape") {
        return (
          <WallTapeNode
            key={object.id}
            object={object}
            readOnly={readOnly || editorMode === "draw"}
            onSelect={select}
            onInteractionStart={() => notifyPresenceSelection(object.id)}
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
            readOnly={readOnly || editorMode === "draw"}
            selected={selectedId === object.id}
            onSelect={select}
            registerNode={registerNode}
          />
        );
      }

      return null;
    },
    [
      readOnly,
      editorMode,
      selectedId,
      resolvePhotoSrc,
      onObjectPatch,
      setManipulating,
      registerNode,
      setSelectedId,
      notifyPresenceSelection,
    ],
  );

  const peerHighlightsByObjectId = useMemo(
    () => peerSelectionsByObjectId(peers, currentUserId),
    [peers, currentUserId],
  );

  const handleTransformEnd = useCallback(
    (id: string) => {
      const node = nodeRegistry.current.get(id);
      if (!node) return;

      const patch = {
        x: node.x(),
        y: node.y(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
        rotation: node.rotation(),
      };
      patchObject(id, patch);
      useWallSceneStore.getState().recordHistory();
      broadcastWallPatch(id, patch);
    },
    [patchObject],
  );

  const syncTransform = useMemo(
    () =>
      throttle((id: string) => {
        const node = nodeRegistry.current.get(id);
        if (!node) return;
        const patch = {
          x: node.x(),
          y: node.y(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
          rotation: node.rotation(),
        };
        patchObject(id, patch);
        broadcastWallPatch(id, patch);
      }, 50),
    [patchObject],
  );

  const reportPointer = useCallback(
    (stage: Konva.Stage | null) => {
      if (!stage || !onPointerMove) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      onPointerMove(pos.x, pos.y);
    },
    [onPointerMove],
  );

  const getWallPointer = useCallback((stage: Konva.Stage | null) => {
    if (!stage) return null;
    return stage.getPointerPosition();
  }, []);

  const updateDraftLine = useCallback((stage: Konva.Stage | null) => {
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

    commitHighlighterLine(clamped, drawColorRef.current);
  }, []);

  const startDrawing = useCallback(
    (stage: Konva.Stage | null) => {
      if (readOnly || editorModeRef.current !== "draw") return;

      const pos = getWallPointer(stage);
      if (!pos) return;

      setSelectedId(null);
      notifyPresenceSelection(null);

      const next: LineEndpoints = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
      drawingRef.current = next;
      setDraftPoints(endpointsToPoints(next));
    },
    [getWallPointer, notifyPresenceSelection, readOnly, setSelectedId],
  );

  const handleStagePointerDown = useCallback(
    (stage: Konva.Stage | null, isStageTarget: boolean) => {
      reportPointer(stage);

      if (editorModeRef.current !== "draw" && isStageTarget) {
        setSelectedId(null);
        notifyPresenceSelection(null);
      }
    },
    [notifyPresenceSelection, reportPointer, setSelectedId],
  );

  const handleStagePointerMove = useCallback(
    (stage: Konva.Stage | null) => {
      reportPointer(stage);
    },
    [reportPointer],
  );

  const handleStagePointerUp = useCallback(() => {
    if (drawingRef.current) finishDrawing();
  }, [finishDrawing]);

  useEffect(() => {
    if (editorMode !== "draw") {
      drawingRef.current = null;
      setDraftPoints(null);
    }
  }, [editorMode]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-neutral-200">
      <div
        ref={wallStageRef}
        className="absolute left-1/2 top-1/2 origin-center shadow-lg ring-1 ring-black/10"
        style={{
          width: wallBounds.width,
          height: wallBounds.height,
          transform: `translate(-50%, -50%) scale(${viewportScale})`,
          background: theme.background,
        }}
      >
        <Stage
          width={wallBounds.width}
          height={wallBounds.height}
          onMouseDown={(e) => {
            handleStagePointerDown(e.target.getStage(), e.target === e.target.getStage());
          }}
          onTouchStart={(e) => {
            handleStagePointerDown(e.target.getStage(), e.target === e.target.getStage());
          }}
          onMouseMove={(e) => handleStagePointerMove(e.target.getStage())}
          onTouchMove={(e) => handleStagePointerMove(e.target.getStage())}
          onMouseUp={handleStagePointerUp}
          onTouchEnd={handleStagePointerUp}
          onMouseLeave={handleStagePointerUp}
        >
          <Layer listening={!readOnly && editorMode !== "draw"}>
            {visibleObjects.map((object) => renderSceneObject(object))}
            {!readOnly && editorMode === "select" && (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 24 || newBox.height < 24) return oldBox;
                  return newBox;
                }}
                onTransformStart={() => {
                  if (selectedId) {
                    locallyDraggingIds.current.add(selectedId);
                    setManipulating(true, selectedId);
                    notifyPresenceSelection(selectedId);
                  }
                }}
                onTransform={() => {
                  if (selectedId) syncTransform(selectedId);
                }}
                onTransformEnd={() => {
                  if (selectedId) {
                    handleTransformEnd(selectedId);
                    locallyDraggingIds.current.delete(selectedId);
                    setManipulating(false, selectedId);
                  }
                }}
              />
            )}
          </Layer>
          <Layer listening={false}>
            {visiblePhotos.map((photo) => {
              const highlights = peerHighlightsByObjectId.get(photo.id);
              if (!highlights?.length) return null;

              return (
                <Group
                  key={`peer-highlight-${photo.id}`}
                  x={photo.x}
                  y={photo.y}
                  rotation={photo.rotation}
                  scaleX={photo.scaleX}
                  scaleY={photo.scaleY}
                >
                  <PeerObjectHighlight
                    peers={highlights}
                    width={photo.width}
                    height={photo.height}
                  />
                </Group>
              );
            })}
          </Layer>
          {!readOnly && editorMode === "draw" && (
            <Layer>
              {draftPoints && draftPoints.length === 4 && (
                <WallHighlighterRect
                  points={draftPoints}
                  fill={drawColor}
                  opacity={HIGHLIGHTER_OPACITY}
                />
              )}
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
                onMouseUp={handleStagePointerUp}
                onTouchEnd={handleStagePointerUp}
              />
            </Layer>
          )}
        </Stage>
      </div>

      {wallId && currentSessionId && peers.length > 0 && (
        <WallPresenceOverlay
          peers={peers}
          currentSessionId={currentSessionId}
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
