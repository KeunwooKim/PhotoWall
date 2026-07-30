"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_COLOR_ADJUST,
  type ColorAdjustParams,
} from "@/lib/photo-edit/color-adjust";
import { applyColorAdjustToWallPhoto } from "@/lib/photo-edit/apply-color-to-photo";
import type { WallSceneObject, WallScenePhoto } from "@/types/wall-scene-v2";
import type { UserPlan } from "@/lib/wall-quotas";

export type PhotoColorApplyContext = {
  wallId: string;
  userId?: string;
  plan?: UserPlan;
  resolvePhotoSrc: (src: string) => Promise<string>;
};

export function usePhotoColorEdit(sceneObjects: WallSceneObject[]) {
  const [colorEditPhotoId, setColorEditPhotoId] = useState<string | null>(null);
  const [params, setParams] = useState<ColorAdjustParams>(DEFAULT_COLOR_ADJUST);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const colorEditPhoto = useMemo((): WallScenePhoto | null => {
    if (!colorEditPhotoId) return null;
    const object = sceneObjects.find((item) => item.id === colorEditPhotoId);
    return object?.type === "photo" ? object : null;
  }, [colorEditPhotoId, sceneObjects]);

  const handleStartColorEdit = useCallback((id: string) => {
    setColorEditPhotoId(id);
    setParams({ ...DEFAULT_COLOR_ADJUST });
    setErrorMessage(null);
    setBusy(false);
  }, []);

  const handleColorCancel = useCallback(() => {
    setColorEditPhotoId(null);
    setParams({ ...DEFAULT_COLOR_ADJUST });
    setErrorMessage(null);
    setBusy(false);
  }, []);

  const handleColorApply = useCallback(
    async (ctx: PhotoColorApplyContext): Promise<boolean> => {
      if (!colorEditPhoto || busy) return false;
      setBusy(true);
      setErrorMessage(null);
      try {
        const displaySrc = await ctx.resolvePhotoSrc(colorEditPhoto.src);
        await applyColorAdjustToWallPhoto(colorEditPhoto, params, {
          displaySrc,
          userId: ctx.userId,
          plan: ctx.plan,
        });
        setColorEditPhotoId(null);
        setParams({ ...DEFAULT_COLOR_ADJUST });
        return true;
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "색 보정에 실패했어요");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, colorEditPhoto, params],
  );

  return {
    colorEditPhotoId,
    colorEditPhoto,
    params,
    setParams,
    busy,
    errorMessage,
    handleStartColorEdit,
    handleColorCancel,
    handleColorApply,
  };
}
