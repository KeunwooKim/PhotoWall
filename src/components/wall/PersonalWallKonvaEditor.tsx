"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import KonvaWallStageClient from "@/components/wall/konva";
import Toolbar from "@/components/wall/Toolbar";
import AuthButton from "@/components/auth/AuthButton";
import FriendsPanel from "@/components/social/FriendsPanel";
import SharedWallsPanel from "@/components/social/SharedWallsPanel";
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

const DRAW_COLORS = ["#e85d8f", "#1a1a1a", "#4a90d9", "#7bc67e", "#f5a623", "#9b59b6"];

export default function PersonalWallKonvaEditor() {
  const { user } = useAuth();
  const wallId = getOrCreateWallId();
  const wallStageRef = useRef<HTMLDivElement>(null);

  const [themeId, setThemeId] = useState<WallThemeId>("white");
  const [loadedCanvasJson, setLoadedCanvasJson] = useState<object | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isSharedOpen, setIsSharedOpen] = useState(false);

  const themeIdRef = useRef(themeId);
  const userRef = useRef(user);
  const syncedUserRef = useRef<string | null>(null);
  const importedRef = useRef(false);
  const persistEnabledRef = useRef(false);
  const lastSavedFingerprintRef = useRef<string | null>(null);

  themeIdRef.current = themeId;
  userRef.current = user;

  const selectedId = useWallSceneStore((s) => s.selectedId);
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
        setThemeId(saved.themeId);
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
        setThemeId(saved.themeId);
        setLoadedCanvasJson(saved.canvasJson);
        showToast("내 벽을 클라우드에 연결했어요");
        return;
      }
    }

    const cloud = await fetchCloudWall();
    if (!cloud) return;

    setThemeId(cloud.themeId);
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
    if (!selectedId) return;
    useWallSceneStore.getState().removeObject(selectedId);
    useWallSceneStore.getState().bumpRevision();
  }, [selectedId]);

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

  if (!loadedCanvasJson) {
    return (
      <div className="flex h-[100dvh] items-center justify-center text-sm text-muted">
        저장된 벽 불러오는 중...
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-white">
      <KonvaWallStageClient
        themeId={themeId}
        initialJson={loadedCanvasJson}
        wallId={wallId}
        resolvePhotoSrc={resolvePhotoSrc}
        onDocumentChange={handleDocumentChange}
        onReady={handleReady}
        wallStageRef={wallStageRef}
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
        mode="select"
        drawColor={DRAW_COLORS[0]}
        drawWidth={4}
        drawColors={DRAW_COLORS}
        drawWidths={[2, 4, 8]}
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
        onModeChange={() => showToast("펜은 다음 업데이트에 추가돼요")}
        onDrawColorChange={() => {}}
        onDrawWidthChange={() => {}}
        onUndo={undo}
        onRedo={redo}
        onBringForward={() => showToast("레이어 순서는 다음 업데이트에 추가돼요")}
        onSendBackward={() => {}}
        onDelete={handleDelete}
        onSave={handleSave}
        onClear={handleClear}
      />

      <FriendsPanel isOpen={isFriendsOpen} onClose={() => setIsFriendsOpen(false)} />
      <SharedWallsPanel isOpen={isSharedOpen} onClose={() => setIsSharedOpen(false)} />
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
