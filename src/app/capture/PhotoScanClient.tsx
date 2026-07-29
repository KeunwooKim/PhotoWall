"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { detectDocumentQuad, quadSimilarity } from "@/lib/photo-scan/detect-quad";
import { loadOpenCv } from "@/lib/photo-scan/load-opencv";
import {
  canvasToJpegDataUrl,
  defaultInsetQuad,
  warpPerspective,
} from "@/lib/photo-scan/perspective";
import { savePendingScans } from "@/lib/photo-scan/scan-session";
import type { Point2, QuadPoints } from "@/lib/photo-scan/types";

type Phase = "loading" | "camera" | "review" | "processing" | "error";

const STABLE_MS = 700;
const DETECT_INTERVAL_MS = 120;

function drawVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  maxSide = 960,
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;
  const scale = Math.min(1, maxSide / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.drawImage(video, 0, 0, w, h);
  return true;
}

function scaleQuad(quad: QuadPoints, sx: number, sy: number): QuadPoints {
  return [
    { x: quad[0].x * sx, y: quad[0].y * sy },
    { x: quad[1].x * sx, y: quad[1].y * sy },
    { x: quad[2].x * sx, y: quad[2].y * sy },
    { x: quad[3].x * sx, y: quad[3].y * sy },
  ];
}

export default function PhotoScanClient() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const reviewWrapRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveQuad, setLiveQuad] = useState<QuadPoints | null>(null);
  const [stableProgress, setStableProgress] = useState(0);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [reviewQuad, setReviewQuad] = useState<QuadPoints | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const stableSinceRef = useRef<number | null>(null);
  const lastQuadRef = useRef<QuadPoints | null>(null);
  const capturingRef = useRef(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setErrorMessage(null);
    setPhase("loading");
    try {
      await loadOpenCv();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("video missing");
      video.srcObject = stream;
      await video.play();
      setPhase("camera");
    } catch (err) {
      setPhase("error");
      setErrorMessage(
        err instanceof Error && err.name === "NotAllowedError"
          ? "카메라 권한이 필요해요. 브라우저 설정에서 허용해 주세요"
          : "카메라를 열 수 없어요. HTTPS 환경에서 다시 시도해 주세요",
      );
    }
  }, []);

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const captureAtQuad = useCallback(
    async (detectQuad: QuadPoints | null) => {
      if (capturingRef.current) return;
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;

      capturingRef.current = true;
      try {
        const full = document.createElement("canvas");
        full.width = video.videoWidth;
        full.height = video.videoHeight;
        const ctx = full.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);

        const detectCanvas = detectCanvasRef.current;
        let quad: QuadPoints;
        if (detectQuad && detectCanvas && detectCanvas.width > 0) {
          const sx = full.width / detectCanvas.width;
          const sy = full.height / detectCanvas.height;
          quad = scaleQuad(detectQuad, sx, sy);
        } else {
          const detected = await detectDocumentQuad(full);
          quad = detected ?? defaultInsetQuad(full.width, full.height);
        }

        const url = full.toDataURL("image/jpeg", 0.95);
        setCapturedUrl(url);
        setImageSize({ width: full.width, height: full.height });
        setReviewQuad(quad);
        stopCamera();
        setPhase("review");
      } finally {
        capturingRef.current = false;
        stableSinceRef.current = null;
        setStableProgress(0);
      }
    },
    [stopCamera],
  );

  // Live detection loop
  useEffect(() => {
    if (phase !== "camera") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled || capturingRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        timer = setTimeout(() => void tick(), DETECT_INTERVAL_MS);
        return;
      }

      if (!detectCanvasRef.current) {
        detectCanvasRef.current = document.createElement("canvas");
      }
      const canvas = detectCanvasRef.current;
      if (!drawVideoFrame(video, canvas, 640)) {
        timer = setTimeout(() => void tick(), DETECT_INTERVAL_MS);
        return;
      }

      try {
        const quad = await detectDocumentQuad(canvas);
        if (cancelled) return;

        setLiveQuad(quad);

          const overlay = overlayRef.current;
          if (overlay && video) {
            const rect = video.getBoundingClientRect();
            const mediaW = canvas.width;
            const mediaH = canvas.height;
            const scale = Math.min(rect.width / mediaW, rect.height / mediaH);
            const drawW = mediaW * scale;
            const drawH = mediaH * scale;
            const offsetX = (rect.width - drawW) / 2;
            const offsetY = (rect.height - drawH) / 2;

            overlay.width = Math.round(rect.width * devicePixelRatio);
            overlay.height = Math.round(rect.height * devicePixelRatio);
            overlay.style.width = `${rect.width}px`;
            overlay.style.height = `${rect.height}px`;
            const octx = overlay.getContext("2d");
            if (octx) {
              octx.setTransform(1, 0, 0, 1, 0, 0);
              octx.clearRect(0, 0, overlay.width, overlay.height);
              octx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
              if (quad) {
                octx.beginPath();
                octx.moveTo(offsetX + quad[0].x * scale, offsetY + quad[0].y * scale);
                for (let i = 1; i < 4; i++) {
                  octx.lineTo(offsetX + quad[i].x * scale, offsetY + quad[i].y * scale);
                }
                octx.closePath();
                octx.strokeStyle = "#fff";
                octx.lineWidth = 2.5;
                octx.stroke();
                octx.fillStyle = "rgba(255,255,255,0.12)";
                octx.fill();
              }
            }
          }

        const now = Date.now();
        const prev = lastQuadRef.current;
        if (quad && prev && quadSimilarity(quad, prev) > 0.72) {
          if (stableSinceRef.current == null) stableSinceRef.current = now;
          const elapsed = now - stableSinceRef.current;
          setStableProgress(Math.min(1, elapsed / STABLE_MS));
          if (elapsed >= STABLE_MS) {
            lastQuadRef.current = quad;
            await captureAtQuad(quad);
            return;
          }
        } else {
          stableSinceRef.current = quad ? now : null;
          setStableProgress(quad ? 0.05 : 0);
        }
        lastQuadRef.current = quad;
      } catch {
        // OpenCV not ready / transient — keep looping
      }

      timer = setTimeout(() => void tick(), DETECT_INTERVAL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, captureAtQuad]);

  const applyScan = useCallback(async () => {
    if (!capturedUrl || !reviewQuad) return;
    setPhase("processing");
    try {
      const img = new Image();
      img.decoding = "async";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image load failed"));
        img.src = capturedUrl;
      });
      const warped = warpPerspective(img, reviewQuad);
      const dataUrl = canvasToJpegDataUrl(warped, 0.92);
      savePendingScans([dataUrl]);
      router.replace("/wall/edit");
    } catch {
      setPhase("review");
      setErrorMessage("평탄화에 실패했어요. 모서리를 다시 맞춰 보세요");
    }
  }, [capturedUrl, reviewQuad, router]);

  const retake = useCallback(() => {
    setCapturedUrl(null);
    setReviewQuad(null);
    setLiveQuad(null);
    setErrorMessage(null);
    lastQuadRef.current = null;
    void startCamera();
  }, [startCamera]);

  const clientToImagePoint = useCallback(
    (clientX: number, clientY: number): Point2 | null => {
      const wrap = reviewWrapRef.current;
      if (!wrap) return null;
      const rect = wrap.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * imageSize.width;
      const y = ((clientY - rect.top) / rect.height) * imageSize.height;
      return {
        x: Math.max(0, Math.min(imageSize.width, x)),
        y: Math.max(0, Math.min(imageSize.height, y)),
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
    <div className="relative flex min-h-[100dvh] flex-col bg-neutral-950 text-white">
      <header
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Link
          href="/wall/edit"
          className="rounded-full bg-black/45 px-3 py-1.5 text-sm backdrop-blur-sm"
          onClick={stopCamera}
        >
          닫기
        </Link>
        <p className="rounded-full bg-black/45 px-3 py-1.5 text-xs backdrop-blur-sm">
          {phase === "review" ? "모서리 조정" : "사진 스캔"}
        </p>
        <span className="w-14" />
      </header>

      {(phase === "loading" || phase === "camera" || phase === "error") && (
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`max-h-[100dvh] w-full object-contain ${phase === "camera" ? "" : "opacity-0"}`}
          />
          <canvas
            ref={overlayRef}
            className="pointer-events-none absolute inset-0 m-auto max-h-[100dvh] max-w-full"
          />

          {phase === "loading" && (
            <p className="absolute text-sm text-white/80">카메라·스캔 엔진 준비 중…</p>
          )}

          {phase === "error" && (
            <div className="absolute mx-6 max-w-sm rounded-2xl bg-white/10 p-5 text-center backdrop-blur">
              <p className="text-sm">{errorMessage}</p>
              <button
                type="button"
                onClick={() => void startCamera()}
                className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-900"
              >
                다시 시도
              </button>
            </div>
          )}

          {phase === "camera" && (
            <div
              className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4"
              style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            >
              <p className="rounded-full bg-black/50 px-3 py-1.5 text-center text-xs text-white/90 backdrop-blur-sm">
                {liveQuad
                  ? "테두리가 잡히면 자동으로 촬영해요"
                  : "인생네컷·사진을 프레임 안에 맞춰 주세요"}
              </p>
              {stableProgress > 0 && (
                <div className="h-1 w-40 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full bg-white transition-[width] duration-100"
                    style={{ width: `${stableProgress * 100}%` }}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => void captureAtQuad(liveQuad)}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 bg-white/20 active:scale-95"
                aria-label="촬영"
              >
                <span className="h-12 w-12 rounded-full bg-white" />
              </button>
            </div>
          )}
        </div>
      )}

      {(phase === "review" || phase === "processing") && capturedUrl && reviewQuad && (
        <div className="flex flex-1 flex-col">
          <div className="relative flex flex-1 items-center justify-center px-3 pt-14">
            <div
              ref={reviewWrapRef}
              className="relative mx-auto max-h-[70dvh] w-full max-w-lg"
              style={{
                aspectRatio: `${imageSize.width} / ${imageSize.height}`,
                width: `min(100%, calc(70dvh * ${imageSize.width / imageSize.height}))`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedUrl}
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
                    style={{ touchAction: "none", cursor: "grab" }}
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
              다시 찍기
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
