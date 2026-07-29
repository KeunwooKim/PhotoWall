"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  canvasToJpegFile,
  defaultInsetQuad,
  warpPerspective,
} from "@/lib/photo-scan/perspective";
import { savePendingScanFiles } from "@/lib/photo-scan/scan-session";
import type { Point2, QuadPoints } from "@/lib/photo-scan/types";
import { defaultPhotoQuad } from "@/lib/photo-scan/video-frame";

type Phase = "pick" | "review" | "processing";

/**
 * iOS-safe scan flow: native camera / gallery (no getUserMedia, no OpenCV).
 * Capture → adjust 4 corners → perspective flatten → File handoff to /wall/edit.
 */
export default function PhotoScanClient() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const reviewWrapRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("pick");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [reviewQuad, setReviewQuad] = useState<QuadPoints | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const revokeSource = useCallback(() => {
    if (sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  useEffect(() => () => revokeSource(), [revokeSource]);

  const loadFileForReview = useCallback(
    async (file: File) => {
      setErrorMessage(null);
      revokeSource();

      const url = URL.createObjectURL(file);
      const img = new Image();
      try {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("image load failed"));
          img.src = url;
        });
      } catch {
        URL.revokeObjectURL(url);
        setErrorMessage("사진을 불러오지 못했어요");
        return;
      }

      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setSourceUrl(url);
      setImageSize({ width: w, height: h });
      // Prefer portrait photo guide; fall back to inset if image is very wide
      const guide =
        h >= w * 0.9 ? defaultPhotoQuad(w, h) : defaultInsetQuad(w, h, 0.06);
      setReviewQuad(guide);
      setPhase("review");
    },
    [revokeSource],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setErrorMessage("이미지 파일만 선택할 수 있어요");
        return;
      }
      void loadFileForReview(file);
    },
    [loadFileForReview],
  );

  const applyScan = useCallback(async () => {
    if (!sourceUrl || !reviewQuad) return;
    setPhase("processing");
    setErrorMessage(null);

    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image load failed"));
        img.src = sourceUrl;
      });

      let warped = warpPerspective(img, reviewQuad, 1400);
      let file = await canvasToJpegFile(warped, 0.8);
      if (file.size > 6 * 1024 * 1024) {
        warped = warpPerspective(img, reviewQuad, 1000);
        file = await canvasToJpegFile(warped, 0.72);
      }

      savePendingScanFiles([file]);
      router.replace("/wall/edit");
    } catch {
      setPhase("review");
      setErrorMessage("평탄화에 실패했어요. 모서리를 다시 맞춰 보세요");
    }
  }, [sourceUrl, reviewQuad, router]);

  const retake = useCallback(() => {
    revokeSource();
    setSourceUrl(null);
    setReviewQuad(null);
    setErrorMessage(null);
    setPhase("pick");
  }, [revokeSource]);

  const clientToImagePoint = useCallback(
    (clientX: number, clientY: number): Point2 | null => {
      const wrap = reviewWrapRef.current;
      if (!wrap) return null;
      const rect = wrap.getBoundingClientRect();
      return {
        x: Math.max(
          0,
          Math.min(imageSize.width, ((clientX - rect.left) / rect.width) * imageSize.width),
        ),
        y: Math.max(
          0,
          Math.min(imageSize.height, ((clientY - rect.top) / rect.height) * imageSize.height),
        ),
      };
    },
    [imageSize.height, imageSize.width],
  );

  useEffect(() => {
    if (dragIndex == null) return;
    const onMove = (e: PointerEvent) => {
      const pt = clientToImagePoint(e.clientX, e.clientY);
      if (!pt || !reviewQuad) return;
      const next = [...reviewQuad] as QuadPoints;
      next[dragIndex] = pt;
      setReviewQuad(next);
    };
    const onUp = () => setDragIndex(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragIndex, clientToImagePoint, reviewQuad]);

  return (
    <div className="relative flex h-[100dvh] w-screen flex-col overflow-hidden bg-neutral-950 text-white">
      <header
        className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Link
          href="/wall/edit"
          className="rounded-full bg-black/50 px-3 py-1.5 text-sm backdrop-blur-sm"
        >
          닫기
        </Link>
        <p className="rounded-full bg-black/50 px-3 py-1.5 text-xs backdrop-blur-sm">
          {phase === "review" || phase === "processing" ? "모서리 조정" : "사진 스캔"}
        </p>
        <span className="w-14" />
      </header>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      {phase === "pick" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
          <div className="max-w-sm space-y-2 text-center">
            <p className="text-lg font-semibold">인생네컷·사진을 스캔해요</p>
            <p className="text-sm leading-relaxed text-white/65">
              아이폰 기본 카메라로 찍은 뒤, 모서리를 맞춰 반듯하게 펴서 벽에 붙여요.
            </p>
          </div>

          {errorMessage && (
            <p className="rounded-full bg-red-500/80 px-4 py-2 text-center text-xs">{errorMessage}</p>
          )}

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="w-full max-w-sm rounded-2xl bg-white py-4 text-sm font-semibold text-neutral-900 active:scale-[0.98]"
          >
            카메라로 촬영
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="w-full max-w-sm rounded-2xl border border-white/25 py-4 text-sm font-medium active:scale-[0.98]"
          >
            앨범에서 선택
          </button>
        </div>
      )}

      {(phase === "review" || phase === "processing") && sourceUrl && reviewQuad && (
        <div className="flex flex-1 flex-col">
          <div className="relative flex flex-1 items-center justify-center px-3 pt-14">
            <div
              ref={reviewWrapRef}
              className="relative mx-auto max-h-[70dvh] w-full max-w-lg"
              style={{ aspectRatio: `${imageSize.width} / ${imageSize.height}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sourceUrl}
                alt="촬영본"
                className="absolute inset-0 h-full w-full object-fill"
                draggable={false}
              />
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                preserveAspectRatio="none"
              >
                <polygon
                  points={reviewQuad.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="rgba(255,255,255,0.12)"
                  stroke="#fff"
                  strokeWidth={Math.max(2, imageSize.width * 0.003)}
                />
                {reviewQuad.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={Math.max(18, imageSize.width * 0.025)}
                    fill="#fff"
                    stroke="#111"
                    strokeWidth={2}
                    className="touch-manipulation"
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                      setDragIndex(i);
                    }}
                  />
                ))}
              </svg>
            </div>
          </div>

          {errorMessage && (
            <p className="px-4 text-center text-sm text-red-300">{errorMessage}</p>
          )}

          <div
            className="flex gap-3 px-4 pt-4"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={retake}
              disabled={phase === "processing"}
              className="flex-1 rounded-2xl border border-white/25 py-3.5 text-sm font-medium disabled:opacity-40"
            >
              다시 선택
            </button>
            <button
              type="button"
              onClick={() => void applyScan()}
              disabled={phase === "processing"}
              className="flex-1 rounded-2xl bg-white py-3.5 text-sm font-medium text-neutral-900 disabled:opacity-40"
            >
              {phase === "processing" ? "평탄화 중…" : "평탄화 후 붙이기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
