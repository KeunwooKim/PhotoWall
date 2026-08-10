"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { autoLevelCanvas } from "@/lib/photo-scan/auto-level";
import { detectDocumentCorners, loadCornerDetector } from "@/lib/photo-scan/detect-corners";
import { enhanceScannedCanvas } from "@/lib/photo-scan/filters";
import {
  canvasToJpegFile,
  defaultPhotoQuad,
  warpPerspective,
} from "@/lib/photo-scan/perspective";
import { resampleCanvas } from "@/lib/photo-scan/resample";
import { savePendingScanFiles } from "@/lib/photo-scan/scan-session";
import type { Point2, QuadPoints, ScanEnhanceMode } from "@/lib/photo-scan/types";
import { sanitizeWallReturnPath } from "@/lib/wall-return-path";

type Phase = "pick" | "detecting" | "review" | "processing";

export default function PhotoScanClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wallReturnPath = useMemo(
    () => sanitizeWallReturnPath(searchParams.get("returnTo")),
    [searchParams],
  );
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const reviewWrapRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("pick");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [reviewQuad, setReviewQuad] = useState<QuadPoints | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [enhanceMode, setEnhanceMode] = useState<ScanEnhanceMode>("photo");
  const [autoLevel, setAutoLevel] = useState(true);
  const [upscale, setUpscale] = useState(true);
  const [detectMs, setDetectMs] = useState<number | null>(null);
  const [modelReady, setModelReady] = useState(false);

  // Prefetch ONNX model while user picks a photo
  useEffect(() => {
    let cancelled = false;
    void loadCornerDetector()
      .then(() => {
        if (!cancelled) setModelReady(true);
      })
      .catch((err) => {
        console.error("[photo-scan] model load failed", err);
        if (!cancelled) setModelReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const revokeSource = useCallback(() => {
    if (sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  useEffect(() => () => revokeSource(), [revokeSource]);

  const loadFileForReview = useCallback(
    async (file: File) => {
      setErrorMessage(null);
      setStatusHint(null);
      setDetectMs(null);
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
      setPhase("detecting");
      setStatusHint("AI가 모서리를 찾는 중…");

      try {
        const { quad, ms } = await detectDocumentCorners(img);
        setDetectMs(ms);
        if (quad) {
          setReviewQuad(quad);
          setStatusHint(`모서리 자동 감지 완료 (${ms}ms) · 필요하면 미세 조정하세요`);
        } else {
          setReviewQuad(defaultPhotoQuad(w, h));
          setStatusHint("자동 감지가 약해요 · 모서리를 직접 맞춰 주세요");
        }
      } catch (err) {
        console.error("[photo-scan] detect failed", err);
        setReviewQuad(defaultPhotoQuad(w, h));
        setStatusHint("AI 모델을 쓰지 못했어요 · 모서리를 직접 맞춰 주세요");
      }

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

  const finishScanCanvas = useCallback(
    (warped: HTMLCanvasElement) => {
      enhanceScannedCanvas(warped, enhanceMode);
      let out = warped;
      if (autoLevel) {
        out = autoLevelCanvas(out).canvas;
      }
      if (upscale) {
        out = resampleCanvas(out, { scale: 1.5, maxSide: 2400 });
      }
      return out;
    },
    [enhanceMode, autoLevel, upscale],
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

      let warped = finishScanCanvas(warpPerspective(img, reviewQuad, 1400));
      let file = await canvasToJpegFile(warped, 0.82);
      if (file.size > 6 * 1024 * 1024) {
        let retry = warpPerspective(img, reviewQuad, 1000);
        enhanceScannedCanvas(retry, enhanceMode);
        if (autoLevel) retry = autoLevelCanvas(retry).canvas;
        if (upscale) retry = resampleCanvas(retry, { scale: 1.25, maxSide: 1800 });
        warped = retry;
        file = await canvasToJpegFile(warped, 0.72);
      }

      savePendingScanFiles([file]);
      router.replace(wallReturnPath);
    } catch {
      setPhase("review");
      setErrorMessage("평탄화에 실패했어요. 모서리를 다시 맞춰 보세요");
    }
  }, [sourceUrl, reviewQuad, finishScanCanvas, enhanceMode, autoLevel, upscale, router, wallReturnPath]);

  const retake = useCallback(() => {
    revokeSource();
    setSourceUrl(null);
    setReviewQuad(null);
    setErrorMessage(null);
    setStatusHint(null);
    setDetectMs(null);
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
          href={wallReturnPath}
          className="rounded-full bg-black/50 px-3 py-1.5 text-sm backdrop-blur-sm"
        >
          닫기
        </Link>
        <p className="rounded-full bg-black/50 px-3 py-1.5 text-xs backdrop-blur-sm">
          {phase === "pick" ? "AI 스캔" : "모서리 조정"}
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
            <p className="text-lg font-semibold">인생네컷·사진을 AI로 스캔해요</p>
            <p className="text-sm leading-relaxed text-white/65">
              아이폰 카메라로 찍으면 온디바이스 AI가 모서리를 자동으로 찾고, 색감을 스캐너처럼
              보정해요.
            </p>
            <p className="text-[11px] text-white/45">
              {modelReady
                ? "AI 모델 준비됨 · 서버 전송 없음"
                : "AI 모델 준비 중… (실패해도 수동 모서리 조정은 가능)"}
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

      {phase === "detecting" && (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-white/80">{statusHint ?? "AI가 모서리를 찾는 중…"}</p>
        </div>
      )}

      {(phase === "review" || phase === "processing") && sourceUrl && reviewQuad && (
        <div className="flex flex-1 flex-col">
          <div className="relative flex flex-1 items-center justify-center px-3 pt-14">
            <div
              ref={reviewWrapRef}
              className="relative mx-auto max-h-[62dvh] w-full max-w-lg"
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
                  fill="rgba(74,222,128,0.14)"
                  stroke="#4ade80"
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

          {statusHint && (
            <p className="px-4 text-center text-[11px] text-white/60">
              {statusHint}
              {detectMs != null ? "" : ""}
            </p>
          )}
          {errorMessage && (
            <p className="px-4 text-center text-sm text-red-300">{errorMessage}</p>
          )}

          <div className="flex flex-wrap justify-center gap-2 px-4 pt-2">
            <button
              type="button"
              onClick={() => setEnhanceMode("photo")}
              className={`rounded-full px-3 py-1.5 text-xs ${
                enhanceMode === "photo" ? "bg-white text-neutral-900" : "bg-white/15"
              }`}
            >
              사진 보정
            </button>
            <button
              type="button"
              onClick={() => setEnhanceMode("scanner")}
              className={`rounded-full px-3 py-1.5 text-xs ${
                enhanceMode === "scanner" ? "bg-white text-neutral-900" : "bg-white/15"
              }`}
            >
              스캐너 느낌
            </button>
            <button
              type="button"
              onClick={() => setAutoLevel((v) => !v)}
              className={`rounded-full px-3 py-1.5 text-xs ${
                autoLevel ? "bg-white text-neutral-900" : "bg-white/15"
              }`}
            >
              자동 수평
            </button>
            <button
              type="button"
              onClick={() => setUpscale((v) => !v)}
              className={`rounded-full px-3 py-1.5 text-xs ${
                upscale ? "bg-white text-neutral-900" : "bg-white/15"
              }`}
            >
              화질 업스케일
            </button>
          </div>

          <div
            className="flex gap-3 px-4 pt-3"
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
              {phase === "processing" ? "보정·업스케일 중…" : "평탄화 후 붙이기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
