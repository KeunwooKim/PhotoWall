"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import { useWallSceneStore } from "@/stores/wall-scene-store";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

interface WallViewerProps {
  themeId: WallThemeId;
  canvasJson: object;
  readOnly?: boolean;
  wallId?: string;
  canGuestbook?: boolean;
}

export default function WallViewer({
  themeId,
  canvasJson,
  readOnly = true,
  wallId,
  canGuestbook = false,
}: WallViewerProps) {
  const { flags } = useFeatureFlags();
  const wallStageRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [loadedJson, setLoadedJson] = useState<object | null>(null);
  const [viewerKey, setViewerKey] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  const resolvePhotoSrc = useCallback(
    (src: string) => (wallId ? resolveWallPhotoSrc(src, wallId) : Promise.resolve(src)),
    [wallId],
  );

  useEffect(() => {
    setIsReady(false);
    setLoadedJson(null);

    void (async () => {
      const doc = parseWallScene(canvasJson);
      if (wallId) {
        await prefetchWallScenePhotoUrls(doc, wallId);
      }
      setLoadedJson(canvasJson);
    })();

    return () => {
      useWallSceneStore.getState().reset();
    };
  }, [canvasJson, wallId]);

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

  const handleGuestbookAdded = useCallback(
    (updatedCanvas: object) => {
      setIsReady(false);
      setLoadedJson(null);
      setViewerKey((key) => key + 1);

      void (async () => {
        const doc = parseWallScene(updatedCanvas);
        if (wallId) {
          await prefetchWallScenePhotoUrls(doc, wallId);
        }
        setLoadedJson(updatedCanvas);
      })();
    },
    [wallId],
  );

  const handleExport = async () => {
    const stage = wallStageRef.current;
    if (!stage || isExporting) return;

    setMoreOpen(false);
    setIsExporting(true);
    try {
      await shareWallImage(stage);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-white">
      {loadedJson && (
        <KonvaWallStageClient
          key={viewerKey}
          themeId={themeId}
          initialJson={loadedJson}
          readOnly={readOnly}
          wallId={wallId}
          resolvePhotoSrc={wallId ? resolvePhotoSrc : undefined}
          onReady={handleReady}
          wallStageRef={wallStageRef}
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
              enableComments={flags.comments}
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
                  disabled={!isReady || isExporting}
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

      {(!loadedJson || !isReady) && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/80 text-sm text-muted">
          벽 불러오는 중...
        </div>
      )}
    </div>
  );
}
