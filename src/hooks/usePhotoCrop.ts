"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  displayCropToSource,
  displaySizeAfterSourceCrop,
  hasPhotoCrop,
  photoPositionAfterDisplayCrop,
  type CropAspectPresetId,
} from "@/lib/wall-scene/photo-crop";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { PhotoCropRect, WallSceneObject, WallScenePhoto } from "@/types/wall-scene-v2";

type DisplayCrop = { x: number; y: number; width: number; height: number };

export function usePhotoCrop(sceneObjects: WallSceneObject[]) {
  const [cropPhotoId, setCropPhotoId] = useState<string | null>(null);
  const [cropAspectPreset, setCropAspectPreset] = useState<CropAspectPresetId>("free");
  const cropDraftRef = useRef<PhotoCropRect | null>(null);
  const cropDisplayDraftRef = useRef<DisplayCrop | null>(null);
  const cropDisplayStartRef = useRef<DisplayCrop>({ x: 0, y: 0, width: 0, height: 0 });
  const cropNaturalSizeRef = useRef<{ width: number; height: number } | null>(null);

  const cropPhoto = useMemo((): WallScenePhoto | null => {
    if (!cropPhotoId) return null;
    const object = sceneObjects.find((item) => item.id === cropPhotoId);
    return object?.type === "photo" ? object : null;
  }, [cropPhotoId, sceneObjects]);

  const handleCropDraftChange = useCallback((crop: PhotoCropRect, display: DisplayCrop) => {
    cropDraftRef.current = crop;
    cropDisplayDraftRef.current = display;
  }, []);

  const handleCropNaturalSize = useCallback((width: number, height: number) => {
    cropNaturalSizeRef.current = { width, height };
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
    },
    [sceneObjects],
  );

  const handleCropCancel = useCallback(() => {
    setCropPhotoId(null);
  }, []);

  const handleCropApply = useCallback(() => {
    if (!cropPhoto) return;
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
  }, [cropPhoto]);

  const handleCropReset = useCallback(() => {
    if (!cropPhoto) return;
    useWallSceneStore.getState().recordHistory();
    const next: WallScenePhoto = { ...cropPhoto };
    delete next.crop;
    useWallSceneStore.getState().upsertObject(next);
    useWallSceneStore.getState().bumpRevision();
    setCropPhotoId(null);
  }, [cropPhoto]);

  return {
    cropPhotoId,
    cropPhoto,
    cropAspectPreset,
    setCropAspectPreset,
    handleStartCrop,
    handleCropDraftChange,
    handleCropNaturalSize,
    handleCropApply,
    handleCropCancel,
    handleCropReset,
    canResetCrop: cropPhoto ? hasPhotoCrop(cropPhoto) : false,
    konvaCropProps: {
      cropPhotoId,
      cropAspectPreset,
      onCropDraftChange: handleCropDraftChange,
      onCropNaturalSize: handleCropNaturalSize,
    },
  };
}
