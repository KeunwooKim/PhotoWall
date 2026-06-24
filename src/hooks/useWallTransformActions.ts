"use client";

import { useCallback } from "react";
import {
  computeDistributionPatches,
  computeNudgePatches,
  computeSelectionAlignmentPatches,
  computeWallCenterPatches,
  type HorizontalAlign,
  type VerticalAlign,
} from "@/lib/wall-scene/align-objects";
import {
  copySelectedObjects,
  cutSelectedObjects,
  pasteClipboardObjects,
} from "@/lib/wall-scene/clipboard-objects";
import {
  groupSelectedObjects,
  ungroupSelectedObjects,
} from "@/lib/wall-scene/group-objects";
import { duplicateSelectedObjects } from "@/lib/wall-scene/duplicate-objects";
import { computeFlipPatches } from "@/lib/wall-scene/flip-objects";
import {
  applyPositionPatches,
  applyTransformPatches,
} from "@/lib/wall-scene/object-transform";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import { useWallSceneStore } from "@/stores/wall-scene-store";

interface UseWallTransformActionsOptions {
  broadcastPatch?: (id: string, patch: WallObjectPatch) => void;
  onDuplicate?: (newIds: string[]) => void;
  onPaste?: (newIds: string[]) => void;
}

export function useWallTransformActions({
  broadcastPatch,
  onDuplicate,
  onPaste,
}: UseWallTransformActionsOptions = {}) {
  const applyAlign = useCallback(
    (horizontal?: HorizontalAlign, vertical?: VerticalAlign) => {
      const { document, selectedIds } = useWallSceneStore.getState();
      const patches = computeSelectionAlignmentPatches(
        document.objects,
        selectedIds,
        horizontal,
        vertical,
      );
      return applyPositionPatches(patches, broadcastPatch);
    },
    [broadcastPatch],
  );

  const applyDistribute = useCallback(
    (axis: "horizontal" | "vertical") => {
      const { document, selectedIds } = useWallSceneStore.getState();
      const patches = computeDistributionPatches(document.objects, selectedIds, axis);
      return applyPositionPatches(patches, broadcastPatch);
    },
    [broadcastPatch],
  );

  const applyFlip = useCallback(
    (axis: "horizontal" | "vertical") => {
      const { document, selectedIds } = useWallSceneStore.getState();
      const patches = computeFlipPatches(document.objects, selectedIds, axis);
      return applyTransformPatches(patches, broadcastPatch);
    },
    [broadcastPatch],
  );

  const centerOnWall = useCallback(() => {
    const { document, selectedIds } = useWallSceneStore.getState();
    const patches = computeWallCenterPatches(
      document.objects,
      selectedIds,
      document.meta.wallBounds,
    );
    return applyPositionPatches(patches, broadcastPatch);
  }, [broadcastPatch]);

  const nudgeSelection = useCallback(
    (deltaX: number, deltaY: number) => {
      const { document, selectedIds } = useWallSceneStore.getState();
      const patches = computeNudgePatches(document.objects, selectedIds, deltaX, deltaY);
      return applyPositionPatches(patches, broadcastPatch);
    },
    [broadcastPatch],
  );

  const duplicateSelection = useCallback(() => {
    const newIds = duplicateSelectedObjects();
    if (newIds.length > 0) onDuplicate?.(newIds);
    return newIds.length > 0;
  }, [onDuplicate]);

  const copySelection = useCallback(() => copySelectedObjects(), []);

  const cutSelection = useCallback(() => cutSelectedObjects(), []);

  const pasteSelection = useCallback(() => {
    const newIds = pasteClipboardObjects();
    if (newIds.length > 0) onPaste?.(newIds);
    return newIds.length > 0;
  }, [onPaste]);

  const groupSelection = useCallback(
    () => groupSelectedObjects(broadcastPatch),
    [broadcastPatch],
  );

  const ungroupSelection = useCallback(
    () => ungroupSelectedObjects(broadcastPatch),
    [broadcastPatch],
  );

  const handleAlignLeft = useCallback(() => applyAlign("left"), [applyAlign]);
  const handleAlignCenterH = useCallback(() => applyAlign("center"), [applyAlign]);
  const handleAlignRight = useCallback(() => applyAlign("right"), [applyAlign]);
  const handleAlignTop = useCallback(() => applyAlign(undefined, "top"), [applyAlign]);
  const handleAlignMiddle = useCallback(() => applyAlign(undefined, "middle"), [applyAlign]);
  const handleAlignBottom = useCallback(() => applyAlign(undefined, "bottom"), [applyAlign]);
  const handleDistributeHorizontal = useCallback(
    () => applyDistribute("horizontal"),
    [applyDistribute],
  );
  const handleDistributeVertical = useCallback(
    () => applyDistribute("vertical"),
    [applyDistribute],
  );
  const handleFlipHorizontal = useCallback(() => applyFlip("horizontal"), [applyFlip]);
  const handleFlipVertical = useCallback(() => applyFlip("vertical"), [applyFlip]);

  return {
    handleAlignLeft,
    handleAlignCenterH,
    handleAlignRight,
    handleAlignTop,
    handleAlignMiddle,
    handleAlignBottom,
    handleDistributeHorizontal,
    handleDistributeVertical,
    handleFlipHorizontal,
    handleFlipVertical,
    centerOnWall,
    nudgeSelection,
    duplicateSelection,
    copySelection,
    cutSelection,
    pasteSelection,
    groupSelection,
    ungroupSelection,
  };
}
