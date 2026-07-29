"use client";

import { useEffect, useState } from "react";
import { getCachedHtmlImage, loadHtmlImage } from "@/lib/storage/load-html-image";
import type { CropAspectPresetId } from "@/lib/wall-scene/photo-crop";
import type { PhotoCropRect, WallScenePhoto } from "@/types/wall-scene-v2";
import { useResolvedImageSrc } from "./useResolvedImageSrc";
import PhotoCropOverlay from "./PhotoCropOverlay";

interface PhotoCropLayerProps {
  photo: WallScenePhoto;
  aspectPreset: CropAspectPresetId;
  resolvePhotoSrc?: (src: string) => Promise<string>;
  onDraftChange: (crop: PhotoCropRect, display: { x: number; y: number; width: number; height: number }) => void;
  onNaturalSize: (width: number, height: number) => void;
}

export default function PhotoCropLayer({
  photo,
  aspectPreset,
  resolvePhotoSrc,
  onDraftChange,
  onNaturalSize,
}: PhotoCropLayerProps) {
  const displaySrc = useResolvedImageSrc(photo.src, resolvePhotoSrc);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(
    () => {
      if (!displaySrc) return null;
      const cached = getCachedHtmlImage(displaySrc);
      return cached
        ? { width: cached.naturalWidth, height: cached.naturalHeight }
        : null;
    },
  );
  const [image, setImage] = useState<HTMLImageElement | null>(() => {
    if (!displaySrc) return null;
    return getCachedHtmlImage(displaySrc);
  });

  useEffect(() => {
    if (!displaySrc) {
      setNaturalSize(null);
      setImage(null);
      return;
    }

    const cached = getCachedHtmlImage(displaySrc);
    if (cached) {
      const size = { width: cached.naturalWidth, height: cached.naturalHeight };
      setNaturalSize(size);
      setImage(cached);
      onNaturalSize(size.width, size.height);
      return;
    }

    let cancelled = false;
    void loadHtmlImage(displaySrc)
      .then((img) => {
        if (cancelled) return;
        const size = { width: img.naturalWidth, height: img.naturalHeight };
        setNaturalSize(size);
        setImage(img);
        onNaturalSize(size.width, size.height);
      })
      .catch(() => {
        if (!cancelled) {
          setNaturalSize(null);
          setImage(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [displaySrc, onNaturalSize]);

  if (!naturalSize || !image) return null;

  return (
    <PhotoCropOverlay
      key={photo.id}
      photo={photo}
      image={image}
      naturalWidth={naturalSize.width}
      naturalHeight={naturalSize.height}
      aspectPreset={aspectPreset}
      onDraftChange={onDraftChange}
    />
  );
}
