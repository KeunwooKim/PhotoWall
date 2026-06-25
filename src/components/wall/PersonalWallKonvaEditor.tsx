"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import KonvaWallStageClient from "@/components/wall/konva";
import Toolbar from "@/components/wall/Toolbar";
import LayerPanel from "@/components/wall/LayerPanel";
import AuthButton from "@/components/auth/AuthButton";
import FriendsPanel from "@/components/social/FriendsPanel";
import SharedWallsPanel from "@/components/social/SharedWallsPanel";
import { DEFAULT_WALL_THEME_ID, resolveWallThemeId } from "@/lib/wall-themes";
import type { WallThemeId } from "@/types/wall";
import { useAuth } from "@/hooks/useAuth";
import { fetchCloudWall, saveWallToCloud } from "@/lib/auth/migrate-wall";
import { clearWall, getOrCreateWallId, loadWall, saveWall } from "@/lib/wall-storage";
import { publishWall } from "@/lib/wall-share";
import { shareWallImage } from "@/lib/wall-export";
import { createWallInvite } from "@/lib/wall-invite";
import { consumePendingImports } from "@/lib/booth-import/import-session";
import {
  prefetchWallScenePhotoUrls,
  resolveWallPhotoSrc,
} from "@/lib/storage/resolve-wall-photos";
import { addPhotoDataUrlToWallScene } from "@/lib/wall-scene/add-photo-data-url";
import { addPhotoToWallScene } from "@/lib/wall-scene/add-photo";
import { addStickerToWallScene } from "@/lib/wall-scene/add-sticker";
import { addTapeToWallScene } from "@/lib/wall-scene/add-tape";
import { parseWallScene, serializeWallScene } from "@/lib/wall-scene/fabric-import";
import { fingerprintPersistableScene } from "@/lib/wall-scene/scene-fingerprint";
import { debounce } from "@/lib/debounce";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { EditorMode } from "@/components/wall/editor-types";
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
import AnnouncementBanner from "@/components/AnnouncementBanner";
import {
  HIGHLIGHTER_COLORS,
  HIGHLIGHTER_LENGTH_PRESETS,
} from "@/lib/wall-scene/highlighter";

const DRAW_COLORS = [...HIGHLIGHTER_COLORS];

export default function PersonalWallKonvaEditor() {
  const { user } = useAuth();
  const wallId = getOrCreateWallId();
  const wallStageRef = useRef<HTMLDivElement>(null);

  const [themeId, setThemeId] = useState<WallThemeId>(DEFAULT_WALL_THEME_ID);
  const [loadedCanvasJson, setLoadedCanvasJson] = useState<object | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isSharedOpen, setIsSharedOpen] = useState(false);
  const [mode, setMode] = useState<EditorMode>("select");
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0]);
  const [highlighterMaxLength, setHighlighterMaxLength] = useState<number>(
    HIGHLIGHTER_LENGTH_PRESETS[1],
  );

  const themeIdRef = useRef(themeId);
  const userRef = useRef(user);
  const syncedUserRef = useRef<string | null>(null);
  const importedRef = useRef(false);
  const persistEnabledRef = useRef(false);
  const lastSavedFingerprintRef = useRef<string | null>(null);

  themeIdRef.current = themeId;
  userRef.current = user;

  const selectedIds = useWallSceneStore((s) => s.selectedIds);
  const sceneObjects = useWallSceneStore((s) => s.document.objects);
  const showGrid = useWallSceneStore((s) => s.showGrid);
  const snapToGrid = useWallSceneStore((s) => s.snapToGrid);
  const toggleShowGrid = useWallSceneStore((s) => s.toggleShowGrid);
  const toggleSnapToGrid = useWallSceneStore((s) => s.toggleSnapToGrid);
  const primaryId = primarySelectedId(selectedIds);
  const wallBounds = useWallSceneStore((s) => s.document.meta.wallBounds);
  const canUndo = useWallSceneStore((s) => s.historyPast.length > 0);
  const canRedo = useWallSceneStore((s) => s.historyFuture.length > 0);
  const undo = useWallSceneStore((s) => s.undo);
  const redo = useWallSceneStore((s) => s.redo);

  const showToast = useCallback((message: string) => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(null), 2000);
  }, []);

  const persistLocal = useCallback((json: object) => {
    saveWall(themeIdRef.current, json);
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 1500);
  }, []);

  const autoSave = useMemo(
    () =>
      debounce((json: object, fingerprint: string) => {
        if (!persistEnabledRef.current) return;
        persistLocal(json);
        lastSavedFingerprintRef.current = fingerprint;

        if (userRef.current) {
          void saveWallToCloud(themeIdRef.current, json, wallId);
        }
      }, 1500),
    [persistLocal, wallId],
  );

  const handleDocumentChange = useCallback(
    (json: object) => {
      const fingerprint = fingerprintPersistableScene(useWallSceneStore.getState().document);
      if (!persistEnabledRef.current || fingerprint === lastSavedFingerprintRef.current) return;
      autoSave(json, fingerprint);
    },
    [autoSave],
  );

  const handleReady = useCallback(() => {
    lastSavedFingerprintRef.current = fingerprintPersistableScene(
      useWallSceneStore.getState().document,
    );
    persistEnabledRef.current = true;
    setIsReady(true);
  }, []);

  const resolvePhotoSrc = useCallback(
    (src: string) => resolveWallPhotoSrc(src, wallId),
    [wallId],
  );

  useEffect(() => {
    return () => {
      useWallSceneStore.getState().reset();
    };
  }, []);

  useEffect(() => {
    setLoadedCanvasJson(null);
    setIsReady(false);
    persistEnabledRef.current = false;
    lastSavedFingerprintRef.current = null;

    void (async () => {
      const saved = loadWall();
      if (saved) {
        setThemeId(resolveWallThemeId(saved.themeId));
        const doc = parseWallScene(saved.canvasJson);
        await prefetchWallScenePhotoUrls(doc, wallId);
        setLoadedCanvasJson(saved.canvasJson);
        return;
      }

      setLoadedCanvasJson(serializeWallScene(useWallSceneStore.getState().document));
    })();
  }, [wallId]);

  const syncCloudWall = useCallback(async () => {
    if (!user) return;

    const local = loadWall();
    if (local) {
      const json = serializeWallScene(parseWallScene(local.canvasJson));
      const saved = await saveWallToCloud(local.themeId, json, local.id);
      if (saved) {
        saveWall(saved.themeId, saved.canvasJson);
        setThemeId(resolveWallThemeId(saved.themeId));
        setLoadedCanvasJson(saved.canvasJson);
        showToast("내 벽을 클라우드에 연결했어요");
        return;
      }
    }

    const cloud = await fetchCloudWall();
    if (!cloud) return;

    setThemeId(resolveWallThemeId(cloud.themeId));
    setLoadedCanvasJson(cloud.canvasJson);
    saveWall(cloud.themeId, cloud.canvasJson);
    showToast("클라우드 벽을 불러왔어요");
  }, [user, showToast]);

  useEffect(() => {
    if (!user || !isReady || syncedUserRef.current === user.id) return;
    syncedUserRef.current = user.id;
    void syncCloudWall();
  }, [user, isReady, syncCloudWall]);

  useEffect(() => {
    if (!isReady || importedRef.current) return;

    const pending = consumePendingImports();
    if (pending.length === 0) return;

    importedRef.current = true;
    void (async () => {
      const bounds = useWallSceneStore.getState().document.meta.wallBounds;
      for (const dataUrl of pending) {
        await addPhotoDataUrlToWallScene(dataUrl, {
          wallWidth: bounds.width,
          wallHeight: bounds.height,
        });
      }
      showToast("QR 네컷 사진을 붙였어요");
    })();
  }, [isReady, showToast]);

  const handlePhotoUpload = useCallback(
    async (file: File) => {
      try {
        await addPhotoToWallScene(file, {
          userId: user?.id,
          wallId,
          wallWidth: wallBounds.width,
          wallHeight: wallBounds.height,
        });
      } catch {
        showToast("사진을 붙이지 못했어요");
      }
    },
    [user?.id, wallId, wallBounds.width, wallBounds.height, showToast],
  );

  const handleAddSticker = useCallback(
    (stickerId: string) => {
      const added = addStickerToWallScene(stickerId, {
        wallWidth: wallBounds.width,
        wallHeight: wallBounds.height,
      });
      if (!added) showToast("스티커를 붙이지 못했어요");
    },
    [wallBounds.width, wallBounds.height, showToast],
  );

  const handleAddTape = useCallback(
    (color: string) => {
      addTapeToWallScene(color, {
        wallWidth: wallBounds.width,
        wallHeight: wallBounds.height,
      });
    },
    [wallBounds.width, wallBounds.height],
  );

  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    useWallSceneStore.getState().removeSelectedObjects();
    useWallSceneStore.getState().bumpRevision();
  }, [selectedIds.length]);

  const handleModeChange = useCallback((next: EditorMode) => {
    setMode(next);
    if (next === "draw") {
      useWallSceneStore.getState().clearSelection();
    }
  }, []);

  const handleSelectAll = useCallback(() => {
    useWallSceneStore.getState().selectAll();
  }, []);

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
  } = useWallTransformActions();

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
    if (!duplicateSelection()) {
      showToast("복제할 항목이 없어요");
    }
  }, [duplicateSelection, showToast]);

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
    if (!pasteSelection()) {
      showToast("붙여넣을 항목이 없어요");
    }
  }, [pasteSelection, showToast]);

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

  const handleThemeChange = useCallback(
    (next: WallThemeId) => {
      setThemeId(next);
      themeIdRef.current = next;
      const json = serializeWallScene(useWallSceneStore.getState().document);
      persistLocal(json);
      if (userRef.current) {
        void saveWallToCloud(next, json, wallId);
      }
    },
    [persistLocal, wallId],
  );

  const handleSave = useCallback(async () => {
    const json = serializeWallScene(useWallSceneStore.getState().document);
    persistLocal(json);

    if (user) {
      const cloud = await saveWallToCloud(themeId, json, wallId);
      showToast(cloud ? "클라우드에 저장됐어요" : "저장됐어요");
      return;
    }

    showToast("저장됐어요");
  }, [persistLocal, themeId, user, wallId, showToast]);

  const handleClear = useCallback(() => {
    if (!confirm("벽의 모든 꾸미기를 지울까요?")) return;
    useWallSceneStore.getState().recordHistory();
    useWallSceneStore.getState().reset();
    clearWall();
    setLoadedCanvasJson(serializeWallScene(useWallSceneStore.getState().document));
    showToast("벽을 비웠어요");
  }, [showToast]);

  const handleShare = useCallback(async () => {
    const json = serializeWallScene(useWallSceneStore.getState().document);
    setIsSharing(true);
    try {
      const data = saveWall(themeId, json);
      const { url } = await publishWall(data);
      await navigator.clipboard.writeText(url);
      showToast("링크가 복사됐어요");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "공유에 실패했어요");
    } finally {
      setIsSharing(false);
    }
  }, [themeId, showToast]);

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

  const handleInvite = useCallback(async () => {
    const json = serializeWallScene(useWallSceneStore.getState().document);
    setIsInviting(true);
    try {
      const data = saveWall(themeId, json);
      const { id } = await publishWall(data);

      if (id === "share") {
        showToast("친구 초대는 Supabase 설정 후 이용할 수 있어요");
        return;
      }

      const { url } = await createWallInvite(id);
      await navigator.clipboard.writeText(url);
      showToast("초대 링크가 복사됐어요");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "초대 링크 생성에 실패했어요");
    } finally {
      setIsInviting(false);
    }
  }, [themeId, showToast]);

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
  }, [handleCopy, handleCut, handleDelete, handleDuplicate, handleGroup, handlePaste, handleSelectAll, handleUngroup, mode, nudgeSelection, redo, selectedIds.length, undo]);

  if (!loadedCanvasJson) {
    return (
      <div className="flex h-[100dvh] items-center justify-center text-sm text-muted">
        저장된 벽 불러오는 중...
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-white">
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
        wallId={wallId}
        resolvePhotoSrc={resolvePhotoSrc}
        onDocumentChange={handleDocumentChange}
        onReady={handleReady}
        wallStageRef={wallStageRef}
        editorMode={mode}
        drawColor={drawColor}
        highlighterMaxLength={highlighterMaxLength}
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
        className="absolute left-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white text-neutral-900 shadow-md ring-1 ring-black/8 sm:left-5"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
        aria-label="메뉴 열기"
      >
        <MenuIcon />
      </button>

      <Link
        href="/"
        className="absolute left-[4.5rem] z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-neutral-500 shadow-sm ring-1 ring-black/8 sm:left-[5.5rem]"
        style={{ top: "max(1.25rem, env(safe-area-inset-top))" }}
        aria-label="홈으로"
      >
        <HomeIcon />
      </Link>

      <div
        className="absolute right-4 z-30 flex flex-col items-end gap-2 sm:right-5"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      >
        <AuthButton />
        <button
          type="button"
          onClick={() => setIsLayerPanelOpen(true)}
          className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-neutral-900 shadow-sm ring-1 ring-black/8"
        >
          레이어
        </button>
        {user && (
          <>
            <button
              type="button"
              onClick={() => setIsSharedOpen(true)}
              className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-neutral-900 shadow-sm ring-1 ring-black/8"
            >
              공동
            </button>
            <button
              type="button"
              onClick={() => setIsFriendsOpen(true)}
              className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-neutral-900 shadow-sm ring-1 ring-black/8"
            >
              친구
            </button>
          </>
        )}
        {autoSaved && !saveMessage && (
          <div className="pointer-events-none rounded-full bg-white/90 px-3 py-1.5 text-xs text-muted shadow-sm">
            {user ? "클라우드 자동 저장됨" : "자동 저장됨"}
          </div>
        )}
      </div>

      {saveMessage && (
        <div
          className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg"
          style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
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
        drawColor={drawColor}
        drawColors={DRAW_COLORS}
        highlighterMaxLength={highlighterMaxLength}
        highlighterLengthPresets={HIGHLIGHTER_LENGTH_PRESETS}
        hasSelection={selectedIds.length > 0}
        selectionCount={selectedIds.length}
        canUndo={canUndo}
        canRedo={canRedo}
        onThemeChange={handleThemeChange}
        onPhotoUpload={handlePhotoUpload}
        onAddTape={handleAddTape}
        onAddSticker={handleAddSticker}
        onShare={handleShare}
        onExport={handleExport}
        onInvite={handleInvite}
        isSharing={isSharing}
        isExporting={isExporting}
        isInviting={isInviting}
        onModeChange={handleModeChange}
        onDrawColorChange={setDrawColor}
        onHighlighterMaxLengthChange={setHighlighterMaxLength}
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
        onSave={handleSave}
        onClear={handleClear}
      />

      <FriendsPanel isOpen={isFriendsOpen} onClose={() => setIsFriendsOpen(false)} />
      <SharedWallsPanel isOpen={isSharedOpen} onClose={() => setIsSharedOpen(false)} />
      <LayerPanel isOpen={isLayerPanelOpen} onClose={() => setIsLayerPanelOpen(false)} />
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M3 5h12M3 9h12M3 13h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
