"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KonvaWallStageClient from "@/components/wall/konva";
import Toolbar from "@/components/wall/Toolbar";
import type { WallThemeId } from "@/types/wall";
import AuthButton from "@/components/auth/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { useWallRealtime } from "@/hooks/useWallRealtime";
import { fetchSharedWallForEdit, saveSharedWallToCloud } from "@/lib/auth/shared-wall";
import {
  prefetchWallScenePhotoUrls,
  resolveWallPhotoSrc,
} from "@/lib/storage/resolve-wall-photos";
import { addPhotoToWallScene } from "@/lib/wall-scene/add-photo";
import { addStickerToWallScene } from "@/lib/wall-scene/add-sticker";
import { addTapeToWallScene } from "@/lib/wall-scene/add-tape";
import { serializeWallScene } from "@/lib/wall-scene/fabric-import";
import { fingerprintPersistableScene } from "@/lib/wall-scene/scene-fingerprint";
import { debounce } from "@/lib/debounce";
import { createWallInvite } from "@/lib/wall-invite";
import { shareWallImage } from "@/lib/wall-export";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { EditorMode } from "@/components/wall/editor-types";
import { bringObjectForward, sendObjectBackward } from "@/lib/wall-scene/layer-order";
import {
  HIGHLIGHTER_COLORS,
  HIGHLIGHTER_LENGTH_PRESETS,
} from "@/lib/wall-scene/highlighter";

const DRAW_COLORS = [...HIGHLIGHTER_COLORS];

interface SharedWallKonvaEditorProps {
  sharedId: string;
}

export default function SharedWallKonvaEditor({ sharedId }: SharedWallKonvaEditorProps) {
  const { user } = useAuth();
  const [themeId, setThemeId] = useState<WallThemeId>("white");
  const [sharedWallTitle, setSharedWallTitle] = useState<string | null>(null);
  const [loadedCanvasJson, setLoadedCanvasJson] = useState<object | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [mode, setMode] = useState<EditorMode>("select");
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0]);
  const [highlighterMaxLength, setHighlighterMaxLength] = useState<number>(
    HIGHLIGHTER_LENGTH_PRESETS[1],
  );

  const wallStageRef = useRef<HTMLDivElement>(null);

  const themeIdRef = useRef(themeId);
  themeIdRef.current = themeId;
  const lastSavedFingerprintRef = useRef<string | null>(null);
  const persistEnabledRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const isManipulatingRef = useRef(false);

  const selectedId = useWallSceneStore((s) => s.selectedId);
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

  const autoSave = useMemo(
    () =>
      debounce((json: object, fingerprint: string) => {
        if (!user || !persistEnabledRef.current) return;
        void saveSharedWallToCloud(sharedId, themeIdRef.current, json).then(() => {
          lastSavedFingerprintRef.current = fingerprint;
          setAutoSaved(true);
          setTimeout(() => setAutoSaved(false), 1500);
        });
      }, 800),
    [sharedId, user],
  );

  const broadcastPresence = useCallback(
    (objectId?: string | null, immediate = true) => {
      const { x, y } = lastPointerRef.current;
      updatePresence(
        x,
        y,
        objectId ?? undefined,
        isManipulatingRef.current,
        immediate,
      );
    },
    [updatePresence],
  );

  const handleManipulationChange = useCallback(
    (active: boolean) => {
      isManipulatingRef.current = active;
      const { x, y } = lastPointerRef.current;
      const selectedId = useWallSceneStore.getState().selectedId;
      updatePresence(x, y, selectedId ?? undefined, active, true);
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
      const selectedId = useWallSceneStore.getState().selectedId;
      updatePresence(x, y, selectedId ?? undefined, isManipulatingRef.current);
    },
    [updatePresence],
  );

  useEffect(() => {
    if (!isReady) return;
    broadcastPresence(selectedId);
  }, [selectedId, isReady, broadcastPresence]);

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
    setIsReady(false);
    persistEnabledRef.current = false;
    lastSavedFingerprintRef.current = null;

    void (async () => {
      const wall = await fetchSharedWallForEdit(sharedId);
      if (!wall) {
        showToast("공동 벽을 불러올 수 없어요");
        return;
      }

      setSharedWallTitle(wall.title);
      setThemeId(wall.themeId);

      const { parseWallScene } = await import("@/lib/wall-scene/fabric-import");
      const doc = parseWallScene(wall.canvasJson);
      await prefetchWallScenePhotoUrls(doc, sharedId);

      setLoadedCanvasJson(wall.canvasJson);
    })();
  }, [sharedId, user, showToast]);

  const handleDocumentChange = useCallback(
    (json: object) => {
      const fingerprint = fingerprintPersistableScene(useWallSceneStore.getState().document);
      if (!persistEnabledRef.current || fingerprint === lastSavedFingerprintRef.current) return;
      autoSave(json, fingerprint);
    },
    [autoSave],
  );

  const handlePhotoUpload = useCallback(
    async (file: File) => {
      if (!user) return;
      try {
        await addPhotoToWallScene(file, {
          userId: user.id,
          wallId: sharedId,
          wallWidth: wallBounds.width,
          wallHeight: wallBounds.height,
        });
      } catch {
        showToast("사진을 붙이지 못했어요");
      }
    },
    [user, sharedId, wallBounds.width, wallBounds.height, showToast],
  );

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    useWallSceneStore.getState().removeObject(selectedId);
    useWallSceneStore.getState().bumpRevision();
  }, [selectedId]);

  const handleModeChange = useCallback((next: EditorMode) => {
    setMode(next);
    if (next === "draw") {
      useWallSceneStore.getState().setSelectedId(null);
    }
  }, []);

  const handleBringForward = useCallback(() => {
    if (!selectedId) return;
    if (!bringObjectForward(selectedId)) {
      showToast("더 앞으로 보낼 수 없어요");
    }
  }, [selectedId, showToast]);

  const handleSendBackward = useCallback(() => {
    if (!selectedId) return;
    if (!sendObjectBackward(selectedId)) {
      showToast("더 뒤로 보낼 수 없어요");
    }
  }, [selectedId, showToast]);

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

  const handleThemeChange = useCallback(
    (next: WallThemeId) => {
      setThemeId(next);
      themeIdRef.current = next;
      const doc = useWallSceneStore.getState().document;
      void saveSharedWallToCloud(sharedId, next, serializeWallScene(doc));
    },
    [sharedId],
  );

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const url = `${window.location.origin}/wall/${sharedId}`;
      await navigator.clipboard.writeText(url);
      showToast("공동 벽 링크가 복사됐어요");
    } finally {
      setIsSharing(false);
    }
  }, [sharedId, showToast]);

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
    void saveSharedWallToCloud(sharedId, themeIdRef.current, json);
    setLoadedCanvasJson(json);
    showToast("벽을 비웠어요");
  }, [sharedId, broadcastClear, showToast]);

  const handleInvite = useCallback(async () => {
    setIsInviting(true);
    try {
      const { url } = await createWallInvite(sharedId);
      await navigator.clipboard.writeText(url);
      showToast("공동 벽 초대 링크가 복사됐어요");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "초대 링크 생성에 실패했어요");
    } finally {
      setIsInviting(false);
    }
  }, [sharedId, showToast]);

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
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          handleDelete();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, handleDelete, undo, redo]);

  if (!user) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 px-6">
        <p className="text-center text-sm text-muted">공동 벽을 꾸미려면 로그인이 필요해요</p>
        <AuthButton />
      </div>
    );
  }

  if (!loadedCanvasJson) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-muted">공동 벽 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-white">
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
        editorMode={mode}
        drawColor={drawColor}
        highlighterMaxLength={highlighterMaxLength}
      />

      <header className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between gap-3 border-b border-rose-200 bg-rose-100 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-md">
        <button
          type="button"
          onClick={() => {
            window.location.href = "/wall/edit";
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm ring-1 ring-rose-200"
        >
          ← 내 벽으로
        </button>
        <p className="min-w-0 truncate text-sm font-semibold text-rose-800">
          {sharedWallTitle ?? "공동 벽"}
          {isConnected ? (
            <span className="ml-2 text-[10px] font-normal text-rose-600">실시간</span>
          ) : connectError ? (
            <span className="ml-2 text-[10px] font-normal text-red-600" title={connectError}>
              연결 실패
            </span>
          ) : isReady ? (
            <span className="ml-2 text-[10px] font-normal text-rose-500">연결 중…</span>
          ) : null}
        </p>
        <AuthButton />
      </header>

      <button
        type="button"
        onClick={() => setIsMenuOpen(true)}
        className="absolute left-4 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/8"
        aria-label="메뉴 열기"
      >
        ☰
      </button>

      {autoSaved && !saveMessage && (
        <div
          className="pointer-events-none absolute right-4 z-30 rounded-full bg-white/90 px-3 py-1.5 text-xs text-muted shadow-sm"
          style={{ top: "calc(max(0.75rem, env(safe-area-inset-top)) + 3.5rem)" }}
        >
          공동 벽 자동 저장됨
        </div>
      )}

      {saveMessage && (
        <div
          className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg"
          style={{ bottom: "max(5rem, env(safe-area-inset-bottom))" }}
        >
          {saveMessage}
        </div>
      )}

      {!isReady && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/70 text-sm text-muted">
          캔버스 준비 중...
        </div>
      )}

      <div
        className="fixed inset-x-0 bottom-0 z-[100] border-t border-rose-200 bg-rose-100/95 px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => {
            window.location.href = "/wall/edit";
          }}
          className="w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-neutral-900 shadow-sm ring-1 ring-rose-200"
        >
          ← 내 벽으로 돌아가기
        </button>
      </div>

      <Toolbar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        themeId={themeId}
        mode={mode}
        drawColor={drawColor}
        drawColors={DRAW_COLORS}
        highlighterMaxLength={highlighterMaxLength}
        highlighterLengthPresets={HIGHLIGHTER_LENGTH_PRESETS}
        hasSelection={!!selectedId}
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
        onBringForward={handleBringForward}
        onSendBackward={handleSendBackward}
        onDelete={handleDelete}
        onSave={() => showToast("자동 저장 중이에요")}
        onClear={handleClear}
      />
    </div>
  );
}
