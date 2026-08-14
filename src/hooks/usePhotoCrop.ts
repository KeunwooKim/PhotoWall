"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  clampWindowInside,
  copyFourCutWindows,
  ensureFourCutBaseWindows,
  windowsClose,
} from "@/lib/four-cut";
import {
  clampCropToSource,
  displayCropToSource,
  displaySizeAfterSourceCrop,
  hasPhotoCrop,
  photoPositionAfterDisplayCrop,
  type CropAspectPresetId,
} from "@/lib/wall-scene/photo-crop";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { PhotoCropRect, WallSceneFourCut, WallSceneObject, WallScenePhoto } from "@/types/wall-scene-v2";

type DisplayCrop = { x: number; y: number; width: number; height: number };

export function usePhotoCrop(sceneObjects: WallSceneObject[]) {
  const [cropPhotoId, setCropPhotoId] = useState<string | null>(null);
  const [cropAspectPreset, setCropAspectPreset] = useState<CropAspectPresetId>("free");
  const [cropSlotIndex, setCropSlotIndex] = useState(0);
  const [slotWindows, setSlotWindows] = useState<WallSceneFourCut["windows"] | null>(null);
  const slotBoundsRef = useRef<WallSceneFourCut["windows"] | null>(null);
  const cropDraftRef = useRef<PhotoCropRect | null>(null);
  const cropDisplayDraftRef = useRef<DisplayCrop | null>(null);
  const cropDisplayStartRef = useRef<DisplayCrop>({ x: 0, y: 0, width: 0, height: 0 });
  const cropNaturalSizeRef = useRef<{ width: number; height: number } | null>(null);

  const cropPhoto = useMemo((): WallScenePhoto | null => {
    if (!cropPhotoId) return null;
    const object = sceneObjects.find((item) => item.id === cropPhotoId);
    return object?.type === "photo" ? object : null;
  }, [cropPhotoId, sceneObjects]);

  const isFourCutSlotCrop = Boolean(cropPhoto?.fourCut);

  const handleCropDraftChange = useCallback((crop: PhotoCropRect, display: DisplayCrop) => {
    cropDraftRef.current = crop;
    cropDisplayDraftRef.current = display;
  }, []);

  const handleCropNaturalSize = useCallback((width: number, height: number) => {
    cropNaturalSizeRef.current = { width, height };
  }, []);

  const handleSlotWindowChange = useCallback((index: number, window: PhotoCropRect) => {
    setSlotWindows((prev) => {
      if (!prev || index < 0 || index > 3) return prev;
      const bounds = slotBoundsRef.current?.[index] ?? prev[index];
      const next = copyFourCutWindows(prev);
      next[index] = clampWindowInside(window, bounds);
      cropDraftRef.current = next[index];
      return next;
    });
  }, []);

  const handleStartCrop = useCallback(
    (id: string) => {
      const photo = sceneObjects.find((item) => item.id === id);
      setCropPhotoId(id);
      setCropAspectPreset("free");
      cropDraftRef.current = null;
      cropDisplayDraftRef.current = null;
      cropDisplayStartRef.current =
        photo?.type === "photo"
          ? { x: 0, y: 0, width: photo.width, height: photo.height }
          : { x: 0, y: 0, width: 0, height: 0 };
      cropNaturalSizeRef.current = null;
      if (photo?.type === "photo" && photo.fourCut) {
        const windows = copyFourCutWindows(photo.fourCut.windows);
        setCropSlotIndex(0);
        setSlotWindows(windows);
        slotBoundsRef.current = copyFourCutWindows(photo.fourCut.baseWindows ?? photo.fourCut.windows);
      } else {
        setCropSlotIndex(0);
        setSlotWindows(null);
        slotBoundsRef.current = null;
      }
    },
    [sceneObjects],
  );

  const handleCropCancel = useCallback(() => {
    setCropPhotoId(null);
    setSlotWindows(null);
    slotBoundsRef.current = null;
  }, []);

  const handleCropApply = useCallback(() => {
    if (!cropPhoto) return;

    if (cropPhoto.fourCut && slotWindows) {
      const fourCut = ensureFourCutBaseWindows(cropPhoto.fourCut);
      const windows = copyFourCutWindows(slotWindows);
      for (let i = 0; i < 4; i++) {
        windows[i] = clampWindowInside(windows[i], fourCut.baseWindows![i]);
      }
      useWallSceneStore.getState().recordHistory();
      useWallSceneStore.getState().upsertObject({
        ...cropPhoto,
        fourCut: { ...fourCut, windows },
      });
      useWallSceneStore.getState().bumpRevision();
      setCropPhotoId(null);
      setSlotWindows(null);
      slotBoundsRef.current = null;
      return;
    }

    const natural = cropNaturalSizeRef.current;
    if (!natural) return;

    const display =
      cropDisplayDraftRef.current ??
      ({ x: 0, y: 0, width: cropPhoto.width, height: cropPhoto.height } satisfies DisplayCrop);

    const draft =
      cropDraftRef.current ??
      displayCropToSource(display, cropPhoto, natural.width, natural.height);

    const { width, height } = displaySizeAfterSourceCrop(
      cropPhoto,
      draft,
      natural.width,
      natural.height,
    );
    const { x, y } = photoPositionAfterDisplayCrop(
      cropPhoto,
      display,
      cropDisplayStartRef.current,
    );

    useWallSceneStore.getState().recordHistory();
    useWallSceneStore.getState().upsertObject({
      ...cropPhoto,
      crop: draft,
      x,
      y,
      width,
      height,
    });
    useWallSceneStore.getState().bumpRevision();
    setCropPhotoId(null);
  }, [cropPhoto, slotWindows]);

  const handleCropReset = useCallback(() => {
    if (!cropPhoto) return;

    if (cropPhoto.fourCut && slotWindows) {
      const bounds = slotBoundsRef.current?.[cropSlotIndex] ?? cropPhoto.fourCut.baseWindows?.[cropSlotIndex];
      if (!bounds) return;
      handleSlotWindowChange(cropSlotIndex, bounds);
      return;
    }

    if (!cropPhoto.crop) return;
    const natural = cropNaturalSizeRef.current;
    useWallSceneStore.getState().recordHistory();

    const next: WallScenePhoto = { ...cropPhoto };
    delete next.crop;

    // Expand the frame back to the full source at the same px/source density,
    // so clearing crop does not stretch the whole image into the cropped box.
    if (natural) {
      const visible = clampCropToSource(
        cropPhoto.crop,
        natural.width,
        natural.height,
      );
      const scaleX = cropPhoto.width / visible.width;
      const scaleY = cropPhoto.height / visible.height;
      const offsetX = -visible.x * scaleX;
      const offsetY = -visible.y * scaleY;
      next.width = Math.max(24, natural.width * scaleX);
      next.height = Math.max(24, natural.height * scaleY);
      const pos = photoPositionAfterDisplayCrop(
        cropPhoto,
        { x: offsetX, y: offsetY },
        { x: 0, y: 0 },
      );
      next.x = pos.x;
      next.y = pos.y;
    }

    useWallSceneStore.getState().upsertObject(next);
    useWallSceneStore.getState().bumpRevision();
    setCropPhotoId(null);
  }, [cropPhoto, cropSlotIndex, handleSlotWindowChange, slotWindows]);

  const canResetCrop = isFourCutSlotCrop
    ? Boolean(
        slotWindows &&
          slotBoundsRef.current &&
          !windowsClose(slotWindows[cropSlotIndex], slotBoundsRef.current[cropSlotIndex]),
      )
    : cropPhoto
      ? hasPhotoCrop(cropPhoto)
      : false;

  return {
    cropPhotoId,
    cropPhoto,
    cropAspectPreset,
    setCropAspectPreset,
    cropSlotIndex,
    setCropSlotIndex,
    slotWindows,
    isFourCutSlotCrop,
    handleStartCrop,
    handleCropDraftChange,
    handleCropNaturalSize,
    handleSlotWindowChange,
    handleCropApply,
    handleCropCancel,
    handleCropReset,
    canResetCrop,
    konvaCropProps: {
      cropPhotoId,
      cropAspectPreset,
      cropSlotIndex,
      cropSlotWindows: slotWindows,
      onCropDraftChange: handleCropDraftChange,
      onCropNaturalSize: handleCropNaturalSize,
      onCropSlotWindowChange: handleSlotWindowChange,
    },
  };
}
