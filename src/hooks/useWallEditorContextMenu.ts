"use client";

import { useCallback, useMemo, useState } from "react";
import type { EditorMode } from "@/components/wall/editor-types";
import {
  buildWallContextMenuSections,
  type WallContextMenuActions,
} from "@/lib/wall-scene/build-context-menu-sections";
import { canGroupSelection, selectionHasGroup } from "@/lib/wall-scene/group-objects";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneObject } from "@/types/wall-scene-v2";
import { useWallContextMenu } from "./useWallContextMenu";

interface MenuSelectionSnapshot {
  selectedIds: string[];
  sceneObjects: WallSceneObject[];
}

interface UseWallEditorContextMenuOptions {
  mode: EditorMode;
  actions: WallContextMenuActions;
}

export function useWallEditorContextMenu({
  mode,
  actions,
}: UseWallEditorContextMenuOptions) {
  const { isOpen, position, openAt, close: closeMenu } = useWallContextMenu();
  const [menuSnapshot, setMenuSnapshot] = useState<MenuSelectionSnapshot | null>(null);

  const close = useCallback(() => {
    closeMenu();
    setMenuSnapshot(null);
  }, [closeMenu]);

  const handleContextMenuRequest = useCallback(
    (clientX: number, clientY: number, objectId?: string) => {
      if (mode !== "select") return;

      const store = useWallSceneStore.getState();

      if (objectId) {
        if (!store.selectedIds.includes(objectId)) {
          store.selectObject(objectId, false);
        }
      }

      const { selectedIds, document } = useWallSceneStore.getState();
      if (selectedIds.length === 0) return;

      setMenuSnapshot({
        selectedIds: [...selectedIds],
        sceneObjects: document.objects,
      });
      openAt(clientX, clientY);
    },
    [mode, openAt],
  );

  const sections = useMemo(() => {
    if (!isOpen || !menuSnapshot) return [];

    const { selectedIds, sceneObjects } = menuSnapshot;

    return buildWallContextMenuSections({
      selectionCount: selectedIds.length,
      canAlign: selectedIds.length >= 2,
      canDistribute: selectedIds.length >= 3,
      canGroup: canGroupSelection(selectedIds),
      canUngroup: selectionHasGroup(selectedIds, sceneObjects),
      actions,
      onClose: close,
    });
  }, [actions, close, isOpen, menuSnapshot]);

  return {
    isOpen,
    position,
    sections,
    close,
    handleContextMenuRequest,
  };
}
