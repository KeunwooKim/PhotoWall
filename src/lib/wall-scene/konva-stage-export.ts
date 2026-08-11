import type Konva from "konva";
import type { WallBounds } from "@/lib/wall-bounds";
import type { PixiStageExport } from "@/components/wall/pixi/pixi-wall-engine";

export function createKonvaStageExportAdapter(
  stage: Konva.Stage,
  getWallBounds: () => WallBounds,
): PixiStageExport {
  return {
    width: () => getWallBounds().width,
    height: () => getWallBounds().height,
    prepareFullExport: async () => {
      stage.batchDraw();
    },
    toDataURL: (config) => {
      const bounds = getWallBounds();
      if (config?.frame) {
        return stage.toDataURL({
          x: config.frame.x - bounds.x,
          y: config.frame.y - bounds.y,
          width: config.frame.width,
          height: config.frame.height,
          pixelRatio: config.pixelRatio,
          mimeType: config.mimeType,
        });
      }
      return stage.toDataURL({
        pixelRatio: config?.pixelRatio,
        mimeType: config?.mimeType,
      });
    },
  };
}
