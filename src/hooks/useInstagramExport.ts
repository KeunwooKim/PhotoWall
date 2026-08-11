"use client";

import { useCallback, useState } from "react";
import type { WallBounds } from "@/lib/wall-bounds";
import {
  findDensestSquareFrame,
  getInstagramExportPreset,
  refitFrameToAspect,
  snapRectFromMarquee,
  snapRectToAspect,
  type InstagramExportPresetId,
  type WallExportRect,
} from "@/lib/wall-scene/instagram-export";
import type { WallSceneObject } from "@/types/wall-scene-v2";

export type InstagramExportPhase = "pick" | "adjust";

export function useInstagramExport(wallBounds: WallBounds) {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<InstagramExportPhase>("pick");
  const [presetId, setPresetId] = useState<InstagramExportPresetId>("1:1");
  const [frame, setFrame] = useState<WallExportRect | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const start = useCallback(() => {
    setActive(true);
    setPhase("pick");
    setFrame(null);
    setPresetId("1:1");
  }, []);

  const cancel = useCallback(() => {
    setActive(false);
    setPhase("pick");
    setFrame(null);
    setIsExporting(false);
  }, []);

  const completeMarquee = useCallback(
    (marquee: WallExportRect) => {
      const preset = getInstagramExportPreset(presetId);
      const snapped = snapRectFromMarquee(marquee, preset.ratio, wallBounds);
      setFrame(snapped);
      setPhase("adjust");
    },
    [presetId, wallBounds],
  );

  const autoSuggest = useCallback(
    (objects: WallSceneObject[]) => {
      const preset = getInstagramExportPreset(presetId);
      const square = findDensestSquareFrame(objects, wallBounds);
      const fitted =
        preset.ratio === 1
          ? square
          : refitFrameToAspect(square, preset.ratio, wallBounds);
      setFrame(fitted);
      setPhase("adjust");
    },
    [presetId, wallBounds],
  );

  const changePreset = useCallback(
    (nextId: InstagramExportPresetId) => {
      setPresetId(nextId);
      const preset = getInstagramExportPreset(nextId);
      setFrame((current) => {
        if (!current) {
          return snapRectToAspect(preset.ratio, wallBounds);
        }
        return refitFrameToAspect(current, preset.ratio, wallBounds);
      });
      if (!frame) {
        setPhase("adjust");
      }
    },
    [frame, wallBounds],
  );

  return {
    active,
    phase,
    presetId,
    frame,
    isExporting,
    setIsExporting,
    start,
    cancel,
    completeMarquee,
    autoSuggest,
    changePreset,
    setFrame,
  };
}
