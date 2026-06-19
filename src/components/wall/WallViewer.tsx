"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import WallCanvas, { type WallCanvasHandle } from "./WallCanvas";
import WallSocialPanel from "./WallSocialPanel";
import type { WallThemeId } from "@/types/wall";
import { shareWallImage } from "@/lib/wall-export";
import AuthButton from "@/components/auth/AuthButton";

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
  const canvasRef = useRef<WallCanvasHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentCanvasJson, setCurrentCanvasJson] = useState(canvasJson);
  const loadedRef = useRef(false);

  const handleReady = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    await canvasRef.current?.loadFromJSON(currentCanvasJson);
    setIsReady(true);
  }, [currentCanvasJson]);

  const handleGuestbookAdded = useCallback(async (updatedCanvas: object) => {
    setCurrentCanvasJson(updatedCanvas);
    loadedRef.current = false;
    await canvasRef.current?.loadFromJSON(updatedCanvas);
    loadedRef.current = true;
  }, []);

  const handleExport = async () => {
    const stage = canvasRef.current?.getWallStageElement();
    if (!stage || isExporting) return;
    setIsExporting(true);
    try {
      await shareWallImage(stage);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div ref={containerRef} className="relative h-[100dvh] w-screen overflow-hidden bg-white">
      <WallCanvas
        ref={canvasRef}
        themeId={themeId}
        drawColor="#e85d8f"
        drawWidth={4}
        readOnly={readOnly}
        onSelectionChange={() => {}}
        onReady={handleReady}
      />

      <div
        className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Link
          href="/"
          className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-neutral-900 shadow-sm ring-1 ring-black/8 backdrop-blur-sm"
        >
          나도 꾸미기
        </Link>

        <div className="flex items-center gap-2">
          <AuthButton />
          {wallId && (
            <WallSocialPanel
              wallId={wallId}
              canGuestbook={canGuestbook}
              onGuestbookAdded={handleGuestbookAdded}
            />
          )}
          {wallId && (
            <span className="rounded-full bg-white/90 px-3 py-2 text-[11px] text-muted shadow-sm ring-1 ring-black/6 backdrop-blur-sm">
              @{wallId.slice(0, 8)}
            </span>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={!isReady || isExporting}
            className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {isExporting ? "저장 중..." : "이미지 저장"}
          </button>
        </div>
      </div>

      {!isReady && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/80 text-sm text-muted">
          벽 불러오는 중...
        </div>
      )}
    </div>
  );
}
