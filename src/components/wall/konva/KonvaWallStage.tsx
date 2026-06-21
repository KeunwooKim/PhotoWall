"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Layer, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import type { WallThemeId } from "@/types/wall";
import { getWallTheme } from "@/lib/wall-themes";
import { computeFitScale } from "@/lib/wall-bounds";
import { parseWallScene, serializeWallScene } from "@/lib/wall-scene/fabric-import";
import { fingerprintPersistableScene } from "@/lib/wall-scene/scene-fingerprint";
import { cullObjectsForViewport } from "@/lib/wall-scene/viewport-culling";
import { peerSelectionsByObjectId } from "@/lib/wall-scene/presence-utils";
import { setWallNodeDragging } from "@/lib/wall-scene/realtime/wall-node-sync";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import { throttle } from "@/lib/throttle";
import type { WallPresenceState, WallScenePhoto } from "@/types/wall-scene-v2";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import WallPhotoNode from "./WallPhotoNode";
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
}: KonvaWallStageProps) {
  const theme = getWallTheme(themeId);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRegistry = useRef(new Map<string, Konva.Group>());
  const locallyDraggingIds = useRef(new Set<string>());

  const document = useWallSceneStore((s) => s.document);
  const selectedId = useWallSceneStore((s) => s.selectedId);
  const loadDocument = useWallSceneStore((s) => s.loadDocument);
  const setSelectedId = useWallSceneStore((s) => s.setSelectedId);
  const setViewportScale = useWallSceneStore((s) => s.setViewportScale);
  const viewportScale = useWallSceneStore((s) => s.viewportScale);
  const patchObject = useWallSceneStore((s) => s.patchObject);

  const [containerSize, setContainerSize] = useState({ width: 390, height: 600 });

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
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      setContainerSize({ width, height });

      const bounds = useWallSceneStore.getState().document.meta.wallBounds;
      const fit = computeFitScale(width, height, bounds.width, bounds.height);
      setViewportScale(fit);
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
    const node = selectedId ? nodeRegistry.current.get(selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId]);

  const wallBounds = document.meta.wallBounds;

  const visiblePhotos = useMemo(() => {
    const photos = document.objects.filter((o): o is WallScenePhoto => o.type === "photo");
    return cullObjectsForViewport(photos, {
      x: 0,
      y: 0,
      width: wallBounds.width,
      height: wallBounds.height,
    }) as WallScenePhoto[];
  }, [document.objects, wallBounds.height, wallBounds.width]);

  const peerHighlightsByObjectId = useMemo(
    () => peerSelectionsByObjectId(peers, currentUserId),
    [peers, currentUserId],
  );

  const notifyPresenceSelection = useCallback(
    (objectId: string | null) => {
      onPresenceSelection?.(objectId);
    },
    [onPresenceSelection],
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

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-neutral-200">
      <div
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
            if (e.target === e.target.getStage()) {
              setSelectedId(null);
              notifyPresenceSelection(null);
            }
            reportPointer(e.target.getStage());
          }}
          onTouchStart={(e) => {
            if (e.target === e.target.getStage()) {
              setSelectedId(null);
              notifyPresenceSelection(null);
            }
            reportPointer(e.target.getStage());
          }}
          onMouseMove={(e) => reportPointer(e.target.getStage())}
          onTouchMove={(e) => reportPointer(e.target.getStage())}
        >
          <Layer listening={!readOnly}>
            {visiblePhotos.map((photo) => (
              <WallPhotoNode
                key={photo.id}
                object={photo}
                readOnly={readOnly}
                resolvePhotoSrc={resolvePhotoSrc}
                onSelect={() => {
                  setSelectedId(photo.id);
                  notifyPresenceSelection(photo.id);
                }}
                onInteractionStart={() => notifyPresenceSelection(photo.id)}
                onObjectPatch={onObjectPatch}
                onManipulationChange={setManipulating}
                registerNode={registerNode}
              />
            ))}
            {!readOnly && (
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
