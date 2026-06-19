"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WallCanvas, { type WallCanvasHandle, type EditorMode } from "./WallCanvas";
import Toolbar from "./Toolbar";
import type { WallThemeId } from "@/types/wall";
import { loadWall, saveWall, clearWall } from "@/lib/wall-storage";
import { debounce } from "@/lib/debounce";
import { publishWall } from "@/lib/wall-share";
import { shareWallImage } from "@/lib/wall-export";
import { createWallInvite } from "@/lib/wall-invite";
import AuthButton from "@/components/auth/AuthButton";
import FriendsPanel from "@/components/social/FriendsPanel";
import SharedWallsPanel from "@/components/social/SharedWallsPanel";
import { useAuth } from "@/hooks/useAuth";
import { fetchCloudWall, saveWallToCloud } from "@/lib/auth/migrate-wall";
import { fetchSharedWallForEdit, saveSharedWallToCloud } from "@/lib/auth/shared-wall";
import { resolvePhotoUrl } from "@/lib/storage/upload-photo";
import { consumePendingImports } from "@/lib/booth-import/import-session";
import Link from "next/link";

const DRAW_COLORS = ["#e85d8f", "#1a1a1a", "#4a90d9", "#7bc67e", "#f5a623", "#9b59b6"];
const DRAW_WIDTHS = [2, 4, 8];

interface WallEditorProps {
  /** 공동 벽 편집 모드 (/shared/[id]) */
  sharedId?: string;
}

export default function WallEditor({ sharedId }: WallEditorProps = {}) {
  const activeSharedId = sharedId ?? null;
  const canvasRef = useRef<WallCanvasHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [themeId, setThemeId] = useState<WallThemeId>("white");
  const [mode, setMode] = useState<EditorMode>("select");
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [drawWidth, setDrawWidth] = useState(4);
  const [hasSelection, setHasSelection] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [autoSaved, setAutoSaved] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isSharedOpen, setIsSharedOpen] = useState(false);
  const [sharedWallTitle, setSharedWallTitle] = useState<string | null>(null);
  const pendingLoadRef = useRef<object | null>(null);
  const sharedWallIdRef = useRef<string | null>(null);
  const themeIdRef = useRef(themeId);
  const syncedUserRef = useRef<string | null>(null);
  const loadedSharedIdRef = useRef<string | null>(null);
  const importedRef = useRef(false);
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  themeIdRef.current = themeId;
  sharedWallIdRef.current = activeSharedId;

  // 예전 ?shared= 링크 호환
  useEffect(() => {
    if (activeSharedId) return;
    const legacyId = new URLSearchParams(window.location.search).get("shared");
    if (legacyId) {
      window.location.replace(`/shared/${legacyId}`);
    }
  }, [activeSharedId]);

  useEffect(() => {
    if (activeSharedId) return;

    loadedSharedIdRef.current = null;
    setSharedWallTitle(null);

    const saved = loadWall();
    if (saved) {
      setThemeId(saved.themeId);
      pendingLoadRef.current = saved.canvasJson;
      if (canvasRef.current && isReady) {
        canvasRef.current.loadFromJSON(saved.canvasJson);
      }
    }
  }, [activeSharedId, isReady]);

  const autoSave = useMemo(
    () =>
      debounce(() => {
        const json = canvasRef.current?.toJSON();
        if (!json) return;

        const activeSharedId = sharedWallIdRef.current;

        if (activeSharedId && userRef.current) {
          saveSharedWallToCloud(activeSharedId, themeIdRef.current, json);
          setAutoSaved(true);
          setTimeout(() => setAutoSaved(false), 1500);
          return;
        }

        const data = saveWall(themeIdRef.current, json);
        setAutoSaved(true);
        setTimeout(() => setAutoSaved(false), 1500);

        if (userRef.current) {
          saveWallToCloud(themeIdRef.current, json, data.id);
        }
      }, 1500),
    [],
  );

  const resolvePhoto = useCallback(
    (file: File) => resolvePhotoUrl(file, user?.id),
    [user?.id],
  );

  const handleCanvasChange = useCallback(() => {
    autoSave();
  }, [autoSave]);

  const showToast = useCallback((message: string) => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(null), 2000);
  }, []);

  const handleCanvasReady = useCallback(async () => {
    if (pendingLoadRef.current) {
      await canvasRef.current?.loadFromJSON(pendingLoadRef.current);
      pendingLoadRef.current = null;
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || importedRef.current) return;

    const pending = consumePendingImports();
    if (pending.length === 0) return;

    importedRef.current = true;

    void (async () => {
      for (const dataUrl of pending) {
        await canvasRef.current?.addPhotoFromDataUrl(dataUrl);
      }
      showToast("QR 네컷 사진을 붙였어요");
    })();
  }, [isReady, showToast]);

  const loadSharedWall = useCallback(async () => {
    if (!activeSharedId || !user) return;
    if (loadedSharedIdRef.current === activeSharedId) return;

    const wall = await fetchSharedWallForEdit(activeSharedId);
    if (!wall) {
      showToast("공동 벽을 불러올 수 없어요");
      return;
    }

    loadedSharedIdRef.current = activeSharedId;
    setSharedWallTitle(wall.title);
    setThemeId(wall.themeId);
    if (canvasRef.current) {
      await canvasRef.current.loadFromJSON(wall.canvasJson);
    } else {
      pendingLoadRef.current = wall.canvasJson;
    }
  }, [activeSharedId, user, showToast]);

  useEffect(() => {
    if (activeSharedId && user) {
      loadSharedWall();
    }
  }, [activeSharedId, user, loadSharedWall]);

  const syncCloudWall = useCallback(async () => {
    if (!user || sharedWallIdRef.current) return;

    const local = loadWall();

    if (local) {
      const saved = await saveWallToCloud(local.themeId, local.canvasJson, local.id);
      if (saved) {
        saveWall(saved.themeId, saved.canvasJson);
        setThemeId(saved.themeId);
        await canvasRef.current?.loadFromJSON(saved.canvasJson);
        showToast("내 벽을 클라우드에 연결했어요");
        return;
      }
    }

    const cloud = await fetchCloudWall();
    if (!cloud) return;

    setThemeId(cloud.themeId);
    await canvasRef.current?.loadFromJSON(cloud.canvasJson);
    saveWall(cloud.themeId, cloud.canvasJson);
    showToast("클라우드 벽을 불러왔어요");
  }, [user, showToast]);

  useEffect(() => {
    if (!user || activeSharedId) {
      if (!user) syncedUserRef.current = null;
      return;
    }
    if (!isReady || syncedUserRef.current === user.id) return;
    syncedUserRef.current = user.id;
    syncCloudWall();
  }, [user, isReady, activeSharedId, syncCloudWall]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_error")) {
      showToast("로그인에 실패했어요. Google·Supabase 설정을 확인해 주세요");
      window.history.replaceState({}, "", "/");
    }
  }, [showToast]);

  const handleSave = useCallback(async () => {
    const json = canvasRef.current?.toJSON();
    if (!json) return;

    if (activeSharedId && user) {
      const saved = await saveSharedWallToCloud(activeSharedId, themeId, json);
      showToast(saved ? "공동 벽에 저장됐어요" : "저장에 실패했어요");
      return;
    }

    const data = saveWall(themeId, json);

    if (user) {
      const cloud = await saveWallToCloud(themeId, json, data.id);
      showToast(cloud ? "클라우드에 저장됐어요" : "저장됐어요");
      return;
    }

    showToast("저장됐어요");
  }, [themeId, user, activeSharedId, showToast]);

  const handleClear = useCallback(() => {
    if (!confirm("벽의 모든 꾸미기를 지울까요?")) return;
    canvasRef.current?.clear();
    if (!activeSharedId) clearWall();
    showToast("벽을 비웠어요");
  }, [activeSharedId, showToast]);

  const handleThemeChange = useCallback((nextThemeId: WallThemeId) => {
    setThemeId(nextThemeId);
    themeIdRef.current = nextThemeId;

    const json = canvasRef.current?.toJSON();
    if (!json) return;

    const sharedId = sharedWallIdRef.current;
    const currentUser = userRef.current;

    if (sharedId && currentUser) {
      void saveSharedWallToCloud(sharedId, nextThemeId, json).then((saved) => {
        if (saved) {
          setAutoSaved(true);
          setTimeout(() => setAutoSaved(false), 1500);
        }
      });
      return;
    }

    saveWall(nextThemeId, json);
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 1500);

    if (currentUser) {
      const local = loadWall();
      void saveWallToCloud(nextThemeId, json, local?.id);
    }
  }, []);

  const handleModeChange = useCallback((next: EditorMode) => {
    setMode(next);
    canvasRef.current?.setMode(next);
  }, []);

  const handleDrawColorChange = useCallback((color: string) => {
    setDrawColor(color);
    canvasRef.current?.setDrawColor(color);
  }, []);

  const handleDrawWidthChange = useCallback((width: number) => {
    setDrawWidth(width);
    canvasRef.current?.setDrawWidth(width);
  }, []);

  const handleAddSvgSticker = useCallback((src: string) => {
    canvasRef.current?.addSvgSticker(src);
  }, []);

  const handleShare = useCallback(async () => {
    const json = canvasRef.current?.toJSON();
    if (!json) return;

    setIsSharing(true);
    try {
      if (activeSharedId) {
        const url = `${window.location.origin}/wall/${activeSharedId}`;
        await navigator.clipboard.writeText(url);
        showToast("공동 벽 링크가 복사됐어요");
        return;
      }

      const data = saveWall(themeId, json);
      const { url } = await publishWall(data);
      await navigator.clipboard.writeText(url);
      showToast("링크가 복사됐어요");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "공유에 실패했어요");
    } finally {
      setIsSharing(false);
    }
  }, [themeId, activeSharedId, showToast]);

  const handleExport = useCallback(async () => {
    const stage = canvasRef.current?.getWallStageElement();
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
    const json = canvasRef.current?.toJSON();
    if (!json) return;

    setIsInviting(true);
    try {
      if (activeSharedId) {
        const { url } = await createWallInvite(activeSharedId);
        await navigator.clipboard.writeText(url);
        showToast("공동 벽 초대 링크가 복사됐어요");
        return;
      }

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
  }, [themeId, activeSharedId, showToast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        canvasRef.current?.undo();
        return;
      }
      if (isMod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        canvasRef.current?.redo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (hasSelection && mode === "select") {
          e.preventDefault();
          canvasRef.current?.deleteSelected();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasSelection, mode]);

  return (
    <div ref={containerRef} className="relative h-[100dvh] w-screen overflow-hidden bg-white">
      <WallCanvas
        ref={canvasRef}
        themeId={themeId}
        drawColor={drawColor}
        drawWidth={drawWidth}
        resolvePhotoUrl={resolvePhoto}
        onSelectionChange={setHasSelection}
        onCanvasChange={handleCanvasChange}
        onHistoryChange={({ canUndo: u, canRedo: r }) => {
          setCanUndo(u);
          setCanRedo(r);
        }}
        onReady={handleCanvasReady}
      />

      <button
        type="button"
        onClick={() => setIsMenuOpen(true)}
        className={`absolute left-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white text-neutral-900 shadow-md ring-1 ring-black/8 transition hover:shadow-lg active:scale-95 sm:left-5 ${
          activeSharedId ? "top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)]" : ""
        }`}
        style={activeSharedId ? undefined : { top: "max(1rem, env(safe-area-inset-top))" }}
        aria-label="메뉴 열기"
      >
        <MenuIcon />
      </button>

      {!activeSharedId && (
        <Link
          href="/"
          className="absolute left-[4.5rem] z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-neutral-500 shadow-sm ring-1 ring-black/8 transition hover:text-neutral-900 active:scale-95 sm:left-[5.5rem]"
          style={{ top: "max(1.25rem, env(safe-area-inset-top))" }}
          aria-label="홈으로"
        >
          <HomeIcon />
        </Link>
      )}

      {activeSharedId && (
        <>
          <header
            className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between gap-3 border-b border-rose-200 bg-rose-100 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-md"
          >
            <button
              type="button"
              onClick={() => {
                window.location.href = "/wall/edit";
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm ring-1 ring-rose-200 transition hover:bg-rose-50 active:scale-95"
            >
              ← 내 벽으로
            </button>
            <p className="min-w-0 truncate text-sm font-semibold text-rose-800">
              {sharedWallTitle ?? "공동 벽"}
            </p>
            <span className="w-[100px] shrink-0" aria-hidden="true" />
          </header>

          <div
            className="fixed inset-x-0 bottom-0 z-[100] border-t border-rose-200 bg-rose-100/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={() => {
                window.location.href = "/wall/edit";
              }}
              className="w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-neutral-900 shadow-sm ring-1 ring-rose-200 transition hover:bg-rose-50 active:scale-[0.98]"
            >
              ← 내 벽으로 돌아가기
            </button>
          </div>
        </>
      )}

      <div
        className="absolute right-4 z-30 flex flex-col items-end gap-2 sm:right-5"
        style={{
          top: activeSharedId
            ? "calc(max(0.75rem, env(safe-area-inset-top)) + 3.5rem)"
            : "max(1rem, env(safe-area-inset-top))",
        }}
      >
        <AuthButton />
        {user && (
          <>
            <button
              type="button"
              onClick={() => setIsSharedOpen(true)}
              className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-neutral-900 shadow-sm ring-1 ring-black/8 backdrop-blur-sm transition hover:bg-white active:scale-95"
            >
              공동
            </button>
            <button
              type="button"
              onClick={() => setIsFriendsOpen(true)}
              className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-neutral-900 shadow-sm ring-1 ring-black/8 backdrop-blur-sm transition hover:bg-white active:scale-95"
            >
              친구
            </button>
          </>
        )}
        {autoSaved && !saveMessage && (
          <div className="pointer-events-none rounded-full bg-white/90 px-3 py-1.5 text-xs text-muted shadow-sm ring-1 ring-black/6">
            {activeSharedId ? "공동 벽 자동 저장됨" : user ? "클라우드 자동 저장됨" : "자동 저장됨"}
          </div>
        )}
      </div>

      {!isReady && (
        <div
          className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-xs text-muted shadow-sm ring-1 ring-black/6"
          style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          저장된 벽 불러오는 중...
        </div>
      )}

      {saveMessage && (
        <div
          className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg"
          style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          {saveMessage}
        </div>
      )}

      <Toolbar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        themeId={themeId}
        mode={mode}
        drawColor={drawColor}
        drawWidth={drawWidth}
        drawColors={DRAW_COLORS}
        drawWidths={DRAW_WIDTHS}
        hasSelection={hasSelection}
        canUndo={canUndo}
        canRedo={canRedo}
        onThemeChange={handleThemeChange}
        onPhotoUpload={(file) => canvasRef.current?.addPhoto(file)}
        onAddTape={(color) => canvasRef.current?.addTape(color)}
        onAddSticker={(emoji) => canvasRef.current?.addSticker(emoji)}
        onAddSvgSticker={handleAddSvgSticker}
        onShare={handleShare}
        onExport={handleExport}
        onInvite={handleInvite}
        isSharing={isSharing}
        isExporting={isExporting}
        isInviting={isInviting}
        onModeChange={handleModeChange}
        onDrawColorChange={handleDrawColorChange}
        onDrawWidthChange={handleDrawWidthChange}
        onUndo={() => canvasRef.current?.undo()}
        onRedo={() => canvasRef.current?.redo()}
        onBringForward={() => canvasRef.current?.bringForward()}
        onSendBackward={() => canvasRef.current?.sendBackward()}
        onDelete={() => canvasRef.current?.deleteSelected()}
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
