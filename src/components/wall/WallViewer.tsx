"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type Konva from "konva";
import KonvaWallStageClient from "@/components/wall/konva";
import WallSocialPanel from "./WallSocialPanel";
import type { WallThemeId } from "@/types/wall";
import { shareWallImage } from "@/lib/wall-export";
import AuthButton from "@/components/auth/AuthButton";
import ReportWallButton from "@/components/wall/ReportWallButton";
import { parseWallScene } from "@/lib/wall-scene/fabric-import";
import {
  prefetchWallScenePhotoUrls,
  resolveWallPhotoSrc,
} from "@/lib/storage/resolve-wall-photos";
import { authFetch } from "@/lib/auth/api-fetch";
import { uploadWallPreviewFromElement } from "@/lib/storage/upload-wall-preview";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { wallTextFontVariables } from "@/lib/fonts/wall-text-fonts";

interface WallViewerProps {
  themeId: WallThemeId;
  canvasJson: object;
  readOnly?: boolean;
  wallId?: string;
  canGuestbook?: boolean;
  previewPath?: string | null;
}

export default function WallViewer({
  themeId,
  canvasJson,
  readOnly = true,
  wallId,
  canGuestbook = false,
  previewPath = null,
}: WallViewerProps) {
  const { flags } = useFeatureFlags();
  const wallStageRef = useRef<HTMLDivElement>(null);
  const konvaStageRef = useRef<Konva.Stage | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [interactive, setInteractive] = useState(!previewPath);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(!!previewPath);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sceneJson, setSceneJson] = useState(canvasJson);
  const [loadedJson, setLoadedJson] = useState<object | null>(null);
  const [viewerKey, setViewerKey] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [activePreviewPath, setActivePreviewPath] = useState(previewPath);

  const usePreview = !!activePreviewPath && !interactive && !previewFailed;

  const resolvePhotoSrc = useCallback(
    (src: string) => (wallId ? resolveWallPhotoSrc(src, wallId) : Promise.resolve(src)),
    [wallId],
  );

  useEffect(() => {
    setSceneJson(canvasJson);
  }, [canvasJson]);

  useEffect(() => {
    setActivePreviewPath(previewPath);
    if (!previewPath) {
      setInteractive(true);
      setPreviewUrl(null);
      setPreviewLoading(false);
      setPreviewFailed(false);
    } else {
      setInteractive(false);
      setPreviewFailed(false);
    }
  }, [previewPath]);

  useEffect(() => {
    if (!wallId || !activePreviewPath || interactive) return;

    let cancelled = false;
    setPreviewLoading(true);

    void (async () => {
      try {
        const res = await authFetch(`/api/walls/${wallId}/signed-photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths: [activePreviewPath] }),
        });
        if (!res.ok) throw new Error("signed url failed");
        const body = (await res.json()) as { signedUrls?: Record<string, string> };
        const url = body.signedUrls?.[activePreviewPath];
        if (!url) throw new Error("missing url");
        if (!cancelled) {
          setPreviewUrl(url);
          setPreviewLoading(false);
        }
      } catch {
        if (!cancelled) {
          setPreviewFailed(true);
          setInteractive(true);
          setPreviewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wallId, activePreviewPath, interactive]);

  useEffect(() => {
    if (!interactive) {
      setLoadedJson(null);
      setIsReady(false);
      return;
    }

    let cancelled = false;
    setIsReady(false);
    setLoadedJson(null);

    void (async () => {
      const doc = parseWallScene(sceneJson);
      if (wallId) {
        await prefetchWallScenePhotoUrls(doc, wallId);
      }
      if (!cancelled) setLoadedJson(sceneJson);
    })();

    return () => {
      cancelled = true;
      useWallSceneStore.getState().reset();
    };
  }, [sceneJson, wallId, interactive]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [moreOpen]);

  const handleReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const handleEnterInteractive = useCallback(() => {
    setInteractive(true);
  }, []);

  const handleGuestbookAdded = useCallback(
    (updatedCanvas: object) => {
      setSceneJson(updatedCanvas);
      setViewerKey((key) => key + 1);

      window.setTimeout(() => {
        if (!wallId) return;
        void uploadWallPreviewFromElement(wallId, wallStageRef.current, {
          themeId,
          stage: konvaStageRef.current,
        }).then((path) => {
          if (!path) return;
          setActivePreviewPath(path);
        });
      }, 1200);
    },
    [wallId, themeId],
  );

  const handleExport = async () => {
    setMoreOpen(false);
    setIsExporting(true);
    try {
      if (usePreview && previewUrl) {
        const a = document.createElement("a");
        a.href = previewUrl;
        a.download = "photowall.jpg";
        a.target = "_blank";
        a.rel = "noopener";
        a.click();
        return;
      }
      const stage = wallStageRef.current;
      if (!stage) return;
      await shareWallImage(stage);
    } finally {
      setIsExporting(false);
    }
  };

  const showKonvaLoading = interactive && (!loadedJson || !isReady);
  const showPreviewLoading = usePreview && previewLoading;

  return (
    <div className={`relative h-[100dvh] w-screen overflow-hidden bg-white ${wallTextFontVariables}`}>
      {usePreview && previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="포토월 미리보기"
          className="absolute inset-0 h-full w-full object-contain bg-neutral-100"
          draggable={false}
        />
      )}

      {interactive && loadedJson && (
        <KonvaWallStageClient
          key={viewerKey}
          themeId={themeId}
          initialJson={loadedJson}
          readOnly={readOnly}
          wallId={wallId}
          resolvePhotoSrc={wallId ? resolvePhotoSrc : undefined}
          onReady={handleReady}
          wallStageRef={wallStageRef}
          konvaStageRef={konvaStageRef}
        />
      )}

      <div
        className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Link
          href="/wall/edit"
          className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-neutral-900 shadow-sm ring-1 ring-black/8 backdrop-blur-sm"
        >
          나도 꾸미기
        </Link>

        <div className="flex items-center gap-2">
          <AuthButton compact />
          {wallId && (
            <WallSocialPanel
              wallId={wallId}
              canGuestbook={canGuestbook && flags.guestbook}
              enableLikes={flags.likes}
              previewMode={usePreview}
              onEnterInteractive={handleEnterInteractive}
              onGuestbookAdded={handleGuestbookAdded}
            />
          )}

          <div ref={moreRef} className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-sm font-medium text-neutral-900 shadow-sm ring-1 ring-black/8 backdrop-blur-sm"
              aria-label="더보기"
              aria-expanded={moreOpen}
            >
              ⋯
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-2xl bg-white py-1 shadow-lg ring-1 ring-black/10">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={(!usePreview && !isReady) || isExporting}
                  className="w-full px-3 py-2.5 text-left text-xs font-medium text-foreground transition hover:bg-foreground/5 disabled:opacity-50"
                >
                  {isExporting ? "저장 중..." : "이미지 저장"}
                </button>
                {wallId && (
                  <div className="border-t border-foreground/6 px-1 py-1">
                    <ReportWallButton wallId={wallId} variant="menu" />
                  </div>
                )}
                {wallId && (
                  <p className="border-t border-foreground/6 px-3 py-2 text-[10px] text-muted">
                    @{wallId.slice(0, 8)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {(showKonvaLoading || showPreviewLoading) && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/80 text-sm text-muted">
          벽 불러오는 중...
        </div>
      )}
    </div>
  );
}
