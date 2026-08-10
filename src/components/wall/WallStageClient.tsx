"use client";

/**
 * Wall stage entry — selects Pixi (default) or Konva via NEXT_PUBLIC_WALL_RENDERER.
 * Only the active renderer chunk is loaded at runtime.
 */
import dynamic from "next/dynamic";
import { getWallRenderer } from "@/lib/wall-renderer";
import type { KonvaWallStageProps } from "@/components/wall/konva/KonvaWallStage";
import type { PixiWallStageProps } from "@/components/wall/pixi/PixiWallStage";

export type WallStageClientProps = KonvaWallStageProps & Partial<PixiWallStageProps>;

const stageLoading = (
  <div
    className="flex h-full w-full flex-col items-center justify-center gap-2 bg-background"
    role="status"
    aria-live="polite"
  >
    <svg className="h-6 w-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <p className="text-sm font-medium text-foreground">편집 화면 준비 중...</p>
  </div>
);

const KonvaWallStageClient = dynamic(() => import("@/components/wall/konva"), {
  ssr: false,
  loading: () => stageLoading,
});

const PixiWallStageClient = dynamic(() => import("@/components/wall/pixi"), {
  ssr: false,
  loading: () => stageLoading,
});

export default function WallStageClient(props: WallStageClientProps) {
  if (getWallRenderer() === "konva") {
    return <KonvaWallStageClient {...props} />;
  }
  return <PixiWallStageClient {...props} />;
}
