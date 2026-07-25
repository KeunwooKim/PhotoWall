"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KonvaWallStageClient from "@/components/wall/konva";
import Toolbar from "@/components/wall/Toolbar";
import LayerPanel from "@/components/wall/LayerPanel";
import EditorToolDock, { HomeIcon, MenuIcon } from "@/components/wall/EditorToolDock";
import type { WallThemeId } from "@/types/wall";
import { DEFAULT_WALL_THEME_ID, resolveWallThemeId } from "@/lib/wall-themes";
import AuthButton from "@/components/auth/AuthButton";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useWallRealtime } from "@/hooks/useWallRealtime";
import { fetchSharedWallForEdit, saveSharedWallToCloud } from "@/lib/auth/shared-wall";
import {
  prefetchWallScenePhotoUrls,
  resolveWallPhotoSrc,
} from "@/lib/storage/resolve-wall-photos";
import { addPhotoToWallScene } from "@/lib/wall-scene/add-photo";
import { addStickerToWallScene } from "@/lib/wall-scene/add-sticker";
import {
  countSelectedQuotaObjects,
  getClipboardQuotaObjectCount,
} from "@/lib/wall-scene/clipboard-objects";
import { serializeWallScene } from "@/lib/wall-scene/fabric-import";
import { fingerprintPersistableScene } from "@/lib/wall-scene/scene-fingerprint";
import { debounce } from "@/lib/debounce";
import { useWallPreviewFlush } from "@/hooks/useWallPreviewFlush";
import { createWallInvite } from "@/lib/wall-invite";
import { shareWallImage } from "@/lib/wall-export";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { EditorMode } from "@/components/wall/editor-types";
import type Konva from "konva";
import {
  bringObjectForward,
  bringObjectsToFront,
  sendObjectBackward,
  sendObjectsToBack,
} from "@/lib/wall-scene/layer-order";
import { primarySelectedId } from "@/lib/wall-scene/selection-utils";
import { canGroupSelection, selectionHasGroup } from "@/lib/wall-scene/group-objects";
import { useWallTransformActions } from "@/hooks/useWallTransformActions";
import { useWallEditorContextMenu } from "@/hooks/useWallEditorContextMenu";
import type { WallContextMenuActions } from "@/lib/wall-scene/build-context-menu-sections";
import WallContextMenu from "@/components/wall/WallContextMenu";
import TextStyleBar from "@/components/wall/TextStyleBar";
import WallQuotaHint from "@/components/wall/WallQuotaHint";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { useClientWallPlan, useGuardWallObjectAdd } from "@/hooks/useWallSceneUsage";
import { HIGHLIGHTER_LENGTH_PRESETS } from "@/lib/wall-scene/highlighter";
import {
  DEFAULT_PEN_STYLE_ID,
  PEN_COLORS,
  clampPenStrokeWidth,
  createDefaultPenWidthByStyle,
  type PenStyleId,
  type PenWidthByStyle,
} from "@/lib/wall-scene/pen";
import { TAPE_COLORS } from "@/lib/wall-scene/tape-colors";
import { wallTextFontVariables } from "@/lib/fonts/wall-text-fonts";

const PEN_DRAW_COLORS = [...PEN_COLORS];
const TAPE_DRAW_COLORS = TAPE_COLORS.map((t) => t.color);

interface SharedWallKonvaEditorProps {
  sharedId: string;
}

export default function SharedWallKonvaEditor({ sharedId }: SharedWallKonvaEditorProps) {
  const { user } = useAuth();
  const [themeId, setThemeId] = useState<WallThemeId>(DEFAULT_WALL_THEME_ID);
  const [sharedWallTitle, setSharedWallTitle] = useState<string | null>(null);
  const [loadedCanvasJson, setLoadedCanvasJson] = useState<object | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "denied" | "not_found">("loading");
  const [isReady, setIsReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [mode, setMode] = useState<EditorMode>("select");
  const [penColor, setPenColor] = useState<string>(PEN_DRAW_COLORS[0]);
  const [tapeColor, setTapeColor] = useState<string>(TAPE_DRAW_COLORS[0]);
  const [penStyleId, setPenStyleId] = useState<PenStyleId>(DEFAULT_PEN_STYLE_ID);
  const [penWidthByStyle, setPenWidthByStyle] = useState<PenWidthByStyle>(createDefaultPenWidthByStyle);
  const [highlighterMaxLength, setHighlighterMaxLength] = useState<number>(
    HIGHLIGHTER_LENGTH_PRESETS[1],
  );
  const penStrokeWidth = penWidthByStyle[penStyleId];
  const setPenStrokeWidth = (width: number) => {
    setPenWidthByStyle((prev) => ({
      ...prev,
      [penStyleId]: clampPenStrokeWidth(penStyleId, width),
    }));
  };

  const wallStageRef = useRef<HTMLDivElement>(null);
  const konvaStageRef = useRef<Konva.Stage | null>(null);

  const themeIdRef = useRef(themeId);
  themeIdRef.current = themeId;
  const lastSavedFingerprintRef = useRef<string | null>(null);
  const persistEnabledRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const isManipulatingRef = useRef(false);

  const selectedIds = useWallSceneStore((s) => s.selectedIds);
  const sceneObjects = useWallSceneStore((s) => s.document.objects);
  const showGrid = useWallSceneStore((s) => s.showGrid);
  const snapToGrid = useWallSceneStore((s) => s.snapToGrid);
  const toggleShowGrid = useWallSceneStore((s) => s.toggleShowGrid);
  const toggleSnapToGrid = useWallSceneStore((s) => s.toggleSnapToGrid);
  const primaryId = primarySelectedId(selectedIds);
  const selectedTextObject = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const obj = sceneObjects.find((o) => o.id === selectedIds[0]);
    return obj?.type === "text" ? obj : null;
  }, [selectedIds, sceneObjects]);
  const wallBounds = useWallSceneStore((s) => s.document.meta.wallBounds);
  const canUndo = useWallSceneStore((s) => s.historyPast.length > 0);
  const canRedo = useWallSceneStore((s) => s.historyFuture.length > 0);
  const undo = useWallSceneStore((s) => s.undo);
  const redo = useWallSceneStore((s) => s.redo);

  const displayName =
    user?.user_metadata?.full_name?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "친구";

  const { peers, isConnected, connectError, sessionId, updatePresence, broadcastObjectPatch, broadcastClear } =
    useWallRealtime({
    wallId: sharedId,
    userId: user?.id ?? "",
    displayName,
    enabled: !!user && isReady && loadedCanvasJson !== null,
  });

  const showToast = useCallback((message: string) => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(null), 2000);
  }, []);

  const wallPlan = useClientWallPlan();
  const { usage: sceneUsage, guardAdd, limitMessage } = useGuardWallObjectAdd(wallPlan);

  const userRef = useRef(user);
  userRef.current = user;

  const { markPreviewDirty, flushPreview } = useWallPreviewFlush({
    getWallId: () => sharedId,
    getThemeId: () => themeIdRef.current,
    wallStageRef,
    konvaStageRef,
    isEnabled: () => !!userRef.current,
  });

  const autoSave = useMemo(
    () =>
      debounce((json: object, fingerprint: string) => {
        if (!user || !persistEnabledRef.current) return;
        void saveSharedWallToCloud(sharedId, themeIdRef.current, json).then(() => {
          lastSavedFingerprintRef.current = fingerprint;
          setAutoSaved(true);
          setTimeout(() => setAutoSaved(false), 1500);
          markPreviewDirty();
        });
      }, 800),
    [sharedId, user, markPreviewDirty],
  );

  const broadcastPresence = useCallback(
    (objectIds?: string[] | null, immediate = true) => {
      const { x, y } = lastPointerRef.current;
      const ids =
        objectIds === null
          ? []
          : (objectIds ?? useWallSceneStore.getState().selectedIds);
      updatePresence(x, y, ids, isManipulatingRef.current, immediate);
    },
    [updatePresence],
  );

  const handleManipulationChange = useCallback(
    (active: boolean) => {
      isManipulatingRef.current = active;
      const { x, y } = lastPointerRef.current;
      const ids = useWallSceneStore.getState().selectedIds;
      updatePresence(x, y, ids, active, true);
    },
    [updatePresence],
  );

  const handleReady = useCallback(() => {
    lastSavedFingerprintRef.current = fingerprintPersistableScene(
      useWallSceneStore.getState().document,
    );
    persistEnabledRef.current = true;
    setIsReady(true);
  }, []);

  const handlePointerMove = useCallback(
    (x: number, y: number) => {
      lastPointerRef.current = { x, y };
      const ids = useWallSceneStore.getState().selectedIds;
      updatePresence(x, y, ids, isManipulatingRef.current);
    },
    [updatePresence],
  );

  useEffect(() => {
    if (!isReady) return;
    broadcastPresence(selectedIds);
  }, [selectedIds, isReady, broadcastPresence]);

  const resolvePhotoSrc = useCallback(
    (src: string) => resolveWallPhotoSrc(src, sharedId),
    [sharedId],
  );

  useEffect(() => {
    return () => {
      useWallSceneStore.getState().reset();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoadedCanvasJson(null);
    setLoadState("loading");
    setIsReady(false);
    persistEnabledRef.current = false;
    lastSavedFingerprintRef.current = null;

    void (async () => {
      const result = await fetchSharedWallForEdit(sharedId);
      if (!result.ok) {
        if (result.reason === "viewer_only") {
          window.location.href = `/wall/${sharedId}`;
          return;
        }
        setLoadState(result.reason === "not_member" ? "denied" : "not_found");
        return;
      }

      const wall = result.wall;
      setSharedWallTitle(wall.title);
      setThemeId(resolveWallThemeId(wall.themeId));

      const { parseWallScene } = await import("@/lib/wall-scene/fabric-import");
      const doc = parseWallScene(wall.canvasJson);
      await prefetchWallScenePhotoUrls(doc, sharedId);

      setLoadedCanvasJson(wall.canvasJson);
      setLoadState("ready");
    })();
  }, [sharedId, user]);

  const handleDocumentChange = useCallback(
    (json: object) => {
      const fingerprint = fingerprintPersistableScene(useWallSceneStore.getState().document);
      if (!persistEnabledRef.current || fingerprint === lastSavedFingerprintRef.current) return;
      autoSave(json, fingerprint);
    },
    [autoSave],
  );

  useEffect(() => {
    const flush = () => {
      autoSave.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [autoSave]);

  const handlePhotoUpload = useCallback(
    async (file: File) => {
      if (!user) return;
      if (!guardAdd(1)) {
        showToast(limitMessage);
        return;
      }
      try {
        await addPhotoToWallScene(file, {
          userId: user.id,
          wallId: sharedId,
          wallWidth: wallBounds.width,
          wallHeight: wallBounds.height,
          plan: wallPlan,
        });
      } catch (err) {
        showToast(err instanceof Error ? err.message : "사진을 붙이지 못했어요");
      }
    },
    [user, sharedId, wallBounds.width, wallBounds.height, showToast, guardAdd, limitMessage, wallPlan],
  );

  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    useWallSceneStore.getState().removeSelectedObjects();
    useWallSceneStore.getState().bumpRevision();
  }, [selectedIds.length]);

  const handleModeChange = useCallback((next: EditorMode) => {
    setMode(next);
    if (next === "pen" || next === "tape" || next === "text") {
      useWallSceneStore.getState().clearSelection();
    }
  }, []);

  const handleSelectAll = useCallback(() => {
    useWallSceneStore.getState().selectAll();
    const ids = useWallSceneStore.getState().selectedIds;
    broadcastPresence(ids);
  }, [broadcastPresence]);

  const handleBringForward = useCallback(() => {
    if (!primaryId) return;
    if (!bringObjectForward(primaryId)) {
      showToast("더 앞으로 보낼 수 없어요");
    }
  }, [primaryId, showToast]);

  const handleSendBackward = useCallback(() => {
    if (!primaryId) return;
    if (!sendObjectBackward(primaryId)) {
      showToast("더 뒤로 보낼 수 없어요");
    }
  }, [primaryId, showToast]);

  const handleBringToFront = useCallback(() => {
    if (selectedIds.length === 0) return;
    if (!bringObjectsToFront(selectedIds)) {
      showToast("이미 맨 앞이에요");
    }
  }, [selectedIds, showToast]);

  const handleSendToBack = useCallback(() => {
    if (selectedIds.length === 0) return;
    if (!sendObjectsToBack(selectedIds)) {
      showToast("이미 맨 뒤예요");
    }
  }, [selectedIds, showToast]);

  const {
    handleAlignLeft,
    handleAlignCenterH,
    handleAlignRight,
    handleAlignTop,
    handleAlignMiddle,
    handleAlignBottom,
    handleDistributeHorizontal: distributeHorizontal,
    handleDistributeVertical: distributeVertical,
    handleFlipHorizontal: flipHorizontal,
    handleFlipVertical: flipVertical,
    centerOnWall,
    nudgeSelection,
    duplicateSelection,
    copySelection,
    cutSelection,
    pasteSelection,
    groupSelection,
    ungroupSelection,
  } = useWallTransformActions({
    broadcastPatch: broadcastObjectPatch,
    onDuplicate: (newIds) => broadcastPresence(newIds),
    onPaste: (newIds) => broadcastPresence(newIds),
  });

  const handleCenterOnWall = useCallback(() => {
    if (!centerOnWall()) {
      showToast("이동할 수 없어요");
    }
  }, [centerOnWall, showToast]);

  const onDistributeHorizontal = useCallback(() => {
    if (!distributeHorizontal()) {
      showToast("3개 이상 선택해야 균등 배치할 수 있어요");
    }
  }, [distributeHorizontal, showToast]);

  const onDistributeVertical = useCallback(() => {
    if (!distributeVertical()) {
      showToast("3개 이상 선택해야 균등 배치할 수 있어요");
    }
  }, [distributeVertical, showToast]);

  const onFlipHorizontal = useCallback(() => {
    if (!flipHorizontal()) {
      showToast("뒤집을 항목이 없어요");
    }
  }, [flipHorizontal, showToast]);

  const onFlipVertical = useCallback(() => {
    if (!flipVertical()) {
      showToast("뒤집을 항목이 없어요");
    }
  }, [flipVertical, showToast]);

  const handleDuplicate = useCallback(() => {
    const n = countSelectedQuotaObjects();
    if (n > 0 && !guardAdd(n)) {
      showToast(limitMessage);
      return;
    }
    if (!duplicateSelection()) {
      showToast("복제할 항목이 없어요");
    }
  }, [duplicateSelection, showToast, guardAdd, limitMessage]);

  const handleCopy = useCallback(() => {
    if (!copySelection()) {
      showToast("복사할 항목이 없어요");
    }
  }, [copySelection, showToast]);

  const handleCut = useCallback(() => {
    if (!cutSelection()) {
      showToast("잘라낼 항목이 없어요");
    }
  }, [cutSelection, showToast]);

  const handlePaste = useCallback(() => {
    const n = getClipboardQuotaObjectCount();
    if (n > 0 && !guardAdd(n)) {
      showToast(limitMessage);
      return;
    }
    if (!pasteSelection()) {
      showToast("붙여넣을 항목이 없어요");
    }
  }, [pasteSelection, showToast, guardAdd, limitMessage]);

  const handleGroup = useCallback(() => {
    if (!groupSelection()) {
      showToast("2개 이상 선택해야 그룹할 수 있어요");
    }
  }, [groupSelection, showToast]);

  const handleUngroup = useCallback(() => {
    if (!ungroupSelection()) {
      showToast("그룹이 없어요");
    }
  }, [ungroupSelection, showToast]);

  const contextMenuActions = useMemo<WallContextMenuActions>(
    () => ({
      onCopy: handleCopy,
      onCut: handleCut,
      onPaste: handlePaste,
      onDuplicate: handleDuplicate,
      onDelete: handleDelete,
      onAlignLeft: handleAlignLeft,
      onAlignCenterH: handleAlignCenterH,
      onAlignRight: handleAlignRight,
      onAlignTop: handleAlignTop,
      onAlignMiddle: handleAlignMiddle,
      onAlignBottom: handleAlignBottom,
      onCenterOnWall: handleCenterOnWall,
      onDistributeHorizontal: onDistributeHorizontal,
      onDistributeVertical: onDistributeVertical,
      onFlipHorizontal: onFlipHorizontal,
      onFlipVertical: onFlipVertical,
      onGroup: handleGroup,
      onUngroup: handleUngroup,
      onBringToFront: handleBringToFront,
      onBringForward: handleBringForward,
      onSendBackward: handleSendBackward,
      onSendToBack: handleSendToBack,
    }),
    [
      handleAlignBottom,
      handleAlignCenterH,
      handleAlignLeft,
      handleAlignMiddle,
      handleAlignRight,
      handleAlignTop,
      handleBringForward,
      handleBringToFront,
      handleCenterOnWall,
      handleCopy,
      handleCut,
      handleDelete,
      handleDuplicate,
      handleGroup,
      handlePaste,
      handleSendBackward,
      handleSendToBack,
      handleUngroup,
      onDistributeHorizontal,
      onDistributeVertical,
      onFlipHorizontal,
      onFlipVertical,
    ],
  );

  const {
    isOpen: isContextMenuOpen,
    position: contextMenuPosition,
    sections: contextMenuSections,
    close: closeContextMenu,
    handleContextMenuRequest,
  } = useWallEditorContextMenu({
    mode,
    actions: contextMenuActions,
  });

  const handleAddSticker = useCallback(
    (stickerId: string) => {
      if (!guardAdd(1)) {
        showToast(limitMessage);
        return;
      }
      const added = addStickerToWallScene(stickerId, {
        wallWidth: wallBounds.width,
        wallHeight: wallBounds.height,
      });
      if (!added) showToast("스티커를 붙이지 못했어요");
    },
    [wallBounds.width, wallBounds.height, showToast, guardAdd, limitMessage],
  );

  const handleThemeChange = useCallback(
    (next: WallThemeId) => {
      setThemeId(next);
      themeIdRef.current = next;
      const doc = useWallSceneStore.getState().document;
      markPreviewDirty();
      void saveSharedWallToCloud(sharedId, next, serializeWallScene(doc));
    },
    [sharedId, markPreviewDirty],
  );

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      await flushPreview({ force: true });
      const url = `${window.location.origin}/wall/${sharedId}`;
      await navigator.clipboard.writeText(url);
      showToast("멤버 전용 링크가 복사됐어요 · 로그인한 멤버만 볼 수 있어요");
    } finally {
      setIsSharing(false);
    }
  }, [sharedId, showToast, flushPreview]);

  const handleExport = useCallback(async () => {
    const stage = wallStageRef.current;
    if (!stage || isExporting) return;

    setIsExporting(true);
    try {
      await shareWallImage(stage);
      showToast("이미지를 저장했어요");
    } catch {
      showToast("이미지 저장에 실패했어요");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, showToast]);

  const handleClear = useCallback(() => {
    if (!confirm("공동 벽의 모든 꾸미기를 지울까요?")) return;

    useWallSceneStore.getState().recordHistory();
    useWallSceneStore.getState().reset();
    broadcastClear();
    const json = serializeWallScene(useWallSceneStore.getState().document);
    markPreviewDirty();
    void saveSharedWallToCloud(sharedId, themeIdRef.current, json);
    setLoadedCanvasJson(json);
    showToast("벽을 비웠어요");
  }, [sharedId, broadcastClear, showToast, markPreviewDirty]);

  const handleInvite = useCallback(async () => {
    setIsInviting(true);
    try {
      await flushPreview({ force: true });
      const { url } = await createWallInvite(sharedId);
      await navigator.clipboard.writeText(url);
      showToast("공동 벽 초대 링크가 복사됐어요");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "초대 링크 생성에 실패했어요");
    } finally {
      setIsInviting(false);
    }
  }, [sharedId, showToast, flushPreview]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (isMod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if (isMod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handleSelectAll();
        return;
      }
      if (e.key === "Escape") {
        useWallSceneStore.getState().clearSelection();
        broadcastPresence(null);
        return;
      }
      if (isMod && e.key.toLowerCase() === "d") {
        if (selectedIds.length > 0 && mode === "select") {
          e.preventDefault();
          handleDuplicate();
        }
        return;
      }
      if (isMod && e.key.toLowerCase() === "c") {
        if (selectedIds.length > 0 && mode === "select") {
          e.preventDefault();
          handleCopy();
        }
        return;
      }
      if (isMod && e.key.toLowerCase() === "x") {
        if (selectedIds.length > 0 && mode === "select") {
          e.preventDefault();
          handleCut();
        }
        return;
      }
      if (isMod && e.key.toLowerCase() === "v") {
        if (mode === "select") {
          e.preventDefault();
          handlePaste();
        }
        return;
      }
      if (isMod && e.shiftKey && e.key.toLowerCase() === "g") {
        if (mode === "select") {
          e.preventDefault();
          handleUngroup();
        }
        return;
      }
      if (isMod && e.key.toLowerCase() === "g") {
        if (selectedIds.length > 0 && mode === "select") {
          e.preventDefault();
          handleGroup();
        }
        return;
      }
      if (mode === "select" && selectedIds.length > 0) {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          nudgeSelection(-step, 0);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          nudgeSelection(step, 0);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          nudgeSelection(0, -step);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          nudgeSelection(0, step);
          return;
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDelete();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [broadcastPresence, handleCopy, handleCut, handleDelete, handleDuplicate, handleGroup, handlePaste, handleSelectAll, handleUngroup, mode, nudgeSelection, redo, selectedIds.length, undo]);

  if (!user) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 px-6">
        <p className="text-center text-sm text-muted">공동 벽을 꾸미려면 로그인이 필요해요</p>
        <AuthButton />
      </div>
    );
  }

  if (loadState === "denied") {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-medium text-foreground">이 공동 벽의 멤버가 아니에요</p>
        <p className="text-sm text-muted">벽 주인에게 멤버 초대를 요청해 보세요.</p>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/walls";
          }}
          className="mt-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background"
        >
          벽 목록으로
        </button>
      </div>
    );
  }

  if (loadState === "not_found") {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-medium text-foreground">공동 벽을 찾을 수 없어요</p>
        <p className="text-sm text-muted">삭제되었거나 링크가 잘못됐을 수 있어요.</p>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/walls";
          }}
          className="mt-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background"
        >
          벽 목록으로
        </button>
      </div>
    );
  }

  if (loadState === "loading" || !loadedCanvasJson) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-muted">공동 벽 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className={`relative h-[100dvh] w-screen overflow-hidden bg-white ${wallTextFontVariables}`}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-50 px-3"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <div className="pointer-events-auto mx-auto max-w-lg">
          <AnnouncementBanner target="editor" compact />
        </div>
      </div>

      <KonvaWallStageClient
        themeId={themeId}
        initialJson={loadedCanvasJson}
        wallId={sharedId}
        resolvePhotoSrc={resolvePhotoSrc}
        peers={peers}
        currentUserId={user.id}
        currentSessionId={sessionId}
        onDocumentChange={handleDocumentChange}
        onPointerMove={handlePointerMove}
        onPresenceSelection={broadcastPresence}
        onPresenceManipulating={handleManipulationChange}
        onObjectPatch={broadcastObjectPatch}
        onReady={handleReady}
        wallStageRef={wallStageRef}
        konvaStageRef={konvaStageRef}
        editorMode={mode}
        drawColor={mode === "pen" ? penColor : tapeColor}
        highlighterMaxLength={highlighterMaxLength}
        penStyleId={penStyleId}
        penStrokeWidth={penStrokeWidth}
        onGuardQuotaAdd={guardAdd}
        onQuotaBlocked={() => showToast(limitMessage)}
        onRequestSelectMode={() => setMode("select")}
        onContextMenuRequest={handleContextMenuRequest}
      />

      <WallContextMenu
        isOpen={isContextMenuOpen}
        position={contextMenuPosition}
        sections={contextMenuSections}
        onClose={closeContextMenu}
      />

      <button
        type="button"
        onClick={() => setIsMenuOpen(true)}
        className="absolute left-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-sm ring-1 ring-black/8 sm:left-5"
        style={{ top: "max(1.25rem, env(safe-area-inset-top))" }}
        aria-label="꾸미기 메뉴 열기"
      >
        <MenuIcon />
      </button>

      <Link
        href="/walls"
        className="absolute left-[4.5rem] z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-neutral-500 shadow-sm ring-1 ring-black/8 sm:left-[5.5rem]"
        style={{ top: "max(1.25rem, env(safe-area-inset-top))" }}
        aria-label="벽 목록으로"
      >
        <HomeIcon />
      </Link>

      <div
        className="absolute left-1/2 z-30 max-w-[40vw] -translate-x-1/2 truncate rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-sm ring-1 ring-black/8"
        style={{ top: "max(1.35rem, env(safe-area-inset-top))" }}
      >
        {sharedWallTitle ?? "공동 벽"}
        {isConnected ? (
          <span className="ml-1.5 font-normal text-emerald-600">실시간</span>
        ) : connectError ? (
          <span className="ml-1.5 font-normal text-red-600" title={connectError}>
            연결 실패
          </span>
        ) : isReady ? (
          <span className="ml-1.5 font-normal text-muted">연결 중…</span>
        ) : null}
      </div>

      <div
        className="absolute right-4 z-30 flex items-center gap-2 sm:right-5"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      >
        <WallQuotaHint usage={sceneUsage} plan={wallPlan} />
        {autoSaved && !saveMessage && (
          <div className="pointer-events-none hidden rounded-full bg-white/90 px-3 py-1.5 text-xs text-muted shadow-sm sm:block">
            공동 벽 자동 저장됨
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsLayerPanelOpen(true)}
          className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-neutral-900 shadow-sm ring-1 ring-black/8"
        >
          레이어
        </button>
        <AuthButton compact />
      </div>

      {selectedTextObject && mode === "select" && (
        <TextStyleBar object={selectedTextObject} />
      )}

      <EditorToolDock
        mode={mode}
        onModeChange={handleModeChange}
        onPhotoUpload={handlePhotoUpload}
        onOpenDecorate={() => setIsMenuOpen(true)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        penColor={penColor}
        penStyleId={penStyleId}
        penStrokeWidth={penStrokeWidth}
        tapeColor={tapeColor}
        tapeMaxLength={highlighterMaxLength}
        onPenColorChange={setPenColor}
        onPenStyleIdChange={setPenStyleId}
        onPenStrokeWidthChange={setPenStrokeWidth}
        onTapeColorChange={setTapeColor}
        onTapeMaxLengthChange={setHighlighterMaxLength}
      />

      {saveMessage && (
        <div
          className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg"
          style={{ bottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))" }}
        >
          {saveMessage}
        </div>
      )}

      {!isReady && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/70 text-sm text-muted">
          캔버스 준비 중...
        </div>
      )}

      <Toolbar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        themeId={themeId}
        mode={mode}
        drawColor={mode === "pen" ? penColor : tapeColor}
        drawColors={mode === "pen" ? PEN_DRAW_COLORS : TAPE_DRAW_COLORS}
        highlighterMaxLength={highlighterMaxLength}
        highlighterLengthPresets={HIGHLIGHTER_LENGTH_PRESETS}
        penStyleId={penStyleId}
        penStrokeWidth={penStrokeWidth}
        hasSelection={selectedIds.length > 0}
        selectionCount={selectedIds.length}
        canUndo={canUndo}
        canRedo={canRedo}
        onThemeChange={handleThemeChange}
        onPhotoUpload={handlePhotoUpload}
        onAddSticker={handleAddSticker}
        onShare={handleShare}
        onExport={handleExport}
        onInvite={handleInvite}
        isSharing={isSharing}
        isExporting={isExporting}
        isInviting={isInviting}
        onModeChange={handleModeChange}
        onDrawColorChange={(color) => {
          if (mode === "pen") setPenColor(color);
          else setTapeColor(color);
        }}
        onHighlighterMaxLengthChange={setHighlighterMaxLength}
        onPenStyleIdChange={setPenStyleId}
        onPenStrokeWidthChange={setPenStrokeWidth}
        onUndo={undo}
        onRedo={redo}
        onSelectAll={handleSelectAll}
        onBringForward={handleBringForward}
        onSendBackward={handleSendBackward}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        onAlignLeft={handleAlignLeft}
        onAlignCenterH={handleAlignCenterH}
        onAlignRight={handleAlignRight}
        onAlignTop={handleAlignTop}
        onAlignMiddle={handleAlignMiddle}
        onAlignBottom={handleAlignBottom}
        onCenterOnWall={handleCenterOnWall}
        onDistributeHorizontal={onDistributeHorizontal}
        onDistributeVertical={onDistributeVertical}
        onFlipHorizontal={onFlipHorizontal}
        onFlipVertical={onFlipVertical}
        onDuplicate={handleDuplicate}
        onGroup={handleGroup}
        onUngroup={handleUngroup}
        onToggleGrid={toggleShowGrid}
        onToggleSnapToGrid={toggleSnapToGrid}
        canGroupSelection={canGroupSelection(selectedIds)}
        canUngroupSelection={selectionHasGroup(selectedIds, sceneObjects)}
        showGrid={showGrid}
        snapToGrid={snapToGrid}
        canAlignSelection={selectedIds.length >= 2}
        canDistributeSelection={selectedIds.length >= 3}
        onDelete={handleDelete}
        onSave={() => showToast("자동 저장 중이에요")}
        onClear={handleClear}
        autoSaveOnly
      />

      <LayerPanel isOpen={isLayerPanelOpen} onClose={() => setIsLayerPanelOpen(false)} />
    </div>
  );
}
