"use client";

import { useEffect, useMemo, useState } from "react";
import { Group, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import { loadHtmlImage } from "@/lib/storage/load-html-image";
import { throttle } from "@/lib/throttle";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import type { WallScenePhoto } from "@/types/wall-scene-v2";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import { useResolvedImageSrc } from "./useResolvedImageSrc";

interface WallPhotoNodeProps {
  object: WallScenePhoto;
  readOnly?: boolean;
  resolvePhotoSrc?: (src: string) => Promise<string>;
  onSelect: () => void;
  onInteractionStart?: () => void;
  onObjectPatch?: (id: string, patch: WallObjectPatch) => void;
  onManipulationChange?: (active: boolean) => void;
  registerNode: (id: string, node: Konva.Group | null) => void;
}

export default function WallPhotoNode({
  object,
  readOnly = false,
  resolvePhotoSrc,
  onSelect,
  onInteractionStart,
  onObjectPatch,
  onManipulationChange,
  registerNode,
}: WallPhotoNodeProps) {
  const displaySrc = useResolvedImageSrc(object.src, resolvePhotoSrc);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const applyPosition = useMemo(
    () =>
      throttle((id: string, x: number, y: number) => {
        const patch = { x, y };
        if (onObjectPatch) {
          onObjectPatch(id, patch);
        } else {
          useWallSceneStore.getState().patchObject(id, patch);
        }
      }, 16),
    [onObjectPatch],
  );

  const commitDragPosition = (node: Konva.Node) => {
    const patch = { x: node.x(), y: node.y() };
    if (onObjectPatch) {
      onObjectPatch(object.id, patch);
    } else {
      useWallSceneStore.getState().patchObject(object.id, patch);
    }
  };

  const beginInteraction = () => {
    onSelect();
    onInteractionStart?.();
  };

  const interactionHandlers = {
    onClick: beginInteraction,
    onTap: beginInteraction,
    onDragStart: () => {
      beginInteraction();
      onManipulationChange?.(true);
    },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      applyPosition(object.id, node.x(), node.y());
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      commitDragPosition(e.target);
      onManipulationChange?.(false);
    },
  };

  useEffect(() => {
    if (!displaySrc) {
      setImage(null);
      setLoadFailed(false);
      return;
    }

    let cancelled = false;
    setLoadFailed(false);

    void loadHtmlImage(displaySrc)
      .then((img) => {
        if (!cancelled) setImage(img);
      })
      .catch(() => {
        if (!cancelled) {
          setImage(null);
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [displaySrc]);

  const groupProps = {
    ref: (node: Konva.Group | null) => registerNode(object.id, node),
    id: object.id,
    x: object.x,
    y: object.y,
    rotation: object.rotation,
    scaleX: object.scaleX,
    scaleY: object.scaleY,
    opacity: object.opacity ?? 1,
    draggable: !readOnly,
    ...interactionHandlers,
  };

  if (!image) {
    if (!loadFailed && displaySrc) return null;
    return <Group {...groupProps} />;
  }

  return (
    <Group {...groupProps}>
      <KonvaImage
        image={image}
        width={object.width}
        height={object.height}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
    </Group>
  );
}
