"use client";

import dynamic from "next/dynamic";
import type { KonvaWallStageProps } from "./KonvaWallStage";

const KonvaWallStage = dynamic(() => import("./KonvaWallStage"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-sm text-muted">
      캔버스 준비 중...
    </div>
  ),
});

export default function KonvaWallStageClient(props: KonvaWallStageProps) {
  return <KonvaWallStage {...props} />;
}

export type { KonvaWallStageProps };
