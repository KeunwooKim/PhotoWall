"use client";

import dynamic from "next/dynamic";
import type { PixiWallStageProps } from "./PixiWallStage";

const PixiWallStage = dynamic(() => import("./PixiWallStage"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-background"
      role="status"
      aria-live="polite"
    >
      <svg className="h-6 w-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p className="text-sm font-medium text-foreground">Pixi 편집 화면 준비 중...</p>
    </div>
  ),
});

export default function PixiWallStageClient(props: PixiWallStageProps) {
  return <PixiWallStage {...props} />;
}

export type { PixiWallStageProps, WallStageExportHandle } from "./PixiWallStage";
