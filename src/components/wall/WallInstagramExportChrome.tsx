"use client";

import { useCallback } from "react";
import InstagramExportOverlay from "@/components/wall/InstagramExportOverlay";
import InstagramExportToolbar from "@/components/wall/InstagramExportToolbar";
import type { WallStageExportHandle } from "@/components/wall/pixi/PixiWallStage";
import { shareWallRegionImage } from "@/lib/wall-export";
import type { useInstagramExport } from "@/hooks/useInstagramExport";
import type { WallBounds } from "@/lib/wall-bounds";
import type { WallViewportAdapter } from "@/lib/wall-scene/wall-viewport-adapter";
import type { WallThemeId } from "@/types/wall";
import type { WallSceneObject } from "@/types/wall-scene-v2";

type InstagramExportSession = ReturnType<typeof useInstagramExport>;

interface WallInstagramExportChromeProps {
  session: InstagramExportSession;
  viewport: WallViewportAdapter | null;
  wallBounds: WallBounds;
  themeId: WallThemeId;
  objects: WallSceneObject[];
  wallStageRef: React.RefObject<HTMLDivElement | null>;
  konvaStageRef: React.RefObject<WallStageExportHandle | null>;
  onToast: (message: string) => void;
  /** `stage` = viewport-aligned overlay only; `toolbar` = bottom toolbar only; `both` = default. */
  placement?: "stage" | "toolbar" | "both";
}

export default function WallInstagramExportChrome({
  session,
  viewport,
  wallBounds,
  themeId,
  objects,
  wallStageRef,
  konvaStageRef,
  onToast,
  placement = "both",
}: WallInstagramExportChromeProps) {
  const {
    active,
    phase,
    presetId,
    frame,
    isExporting,
    setIsExporting,
    cancel,
    completeMarquee,
    autoSuggest,
    changePreset,
    setFrame,
  } = session;

  const handleExport = useCallback(async () => {
    if (!frame || isExporting) return;
    setIsExporting(true);
    try {
      await shareWallRegionImage({
        element: wallStageRef.current,
        stage: konvaStageRef.current,
        region: frame,
        presetId,
        themeId,
        wallX: wallBounds.x,
        wallY: wallBounds.y,
      });
      onToast("인스타용 이미지를 저장했어요");
      cancel();
    } catch {
      onToast("이미지 저장에 실패했어요");
    } finally {
      setIsExporting(false);
    }
  }, [
    cancel,
    frame,
    isExporting,
    konvaStageRef,
    onToast,
    presetId,
    setIsExporting,
    themeId,
    wallBounds.x,
    wallBounds.y,
    wallStageRef,
  ]);

  if (!active || !viewport) return null;

  const showOverlay = placement === "both" || placement === "stage";
  const showToolbar = placement === "both" || placement === "toolbar";

  return (
    <>
      {showOverlay && (
        <InstagramExportOverlay
          viewport={viewport}
          wallBounds={wallBounds}
          phase={phase}
          presetId={presetId}
          frame={frame}
          onMarqueeComplete={completeMarquee}
          onFrameChange={setFrame}
        />
      )}
      {showToolbar && (
        <InstagramExportToolbar
          presetId={presetId}
          phase={phase}
          isExporting={isExporting}
          canExport={phase === "adjust" && !!frame}
          onPresetChange={changePreset}
          onAutoSuggest={() => autoSuggest(objects)}
          onCancel={cancel}
          onExport={() => void handleExport()}
        />
      )}
    </>
  );
}
