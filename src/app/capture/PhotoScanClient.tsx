"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  detectDocumentQuadWithDebug,
  drawQuadPath,
  type DetectDebugInfo,
} from "@/lib/photo-scan/detect-quad";
import { isOpenCvReady, loadOpenCv } from "@/lib/photo-scan/load-opencv";
import {
  canvasToJpegFile,
  warpPerspective,
} from "@/lib/photo-scan/perspective";
import { savePendingScanFiles } from "@/lib/photo-scan/scan-session";
import type { Point2, QuadPoints } from "@/lib/photo-scan/types";
import {
  defaultPhotoQuad,
  drawVideoToCanvas,
  waitForVideoFrame,
} from "@/lib/photo-scan/video-frame";

type Phase = "loading" | "camera" | "review" | "processing" | "error";

const EMPTY_DEBUG: DetectDebugInfo = {
  ms: 0,
  readMethod: "failed",
  frameW: 0,
  frameH: 0,
  contourCount: 0,
  candidateCount: 0,
  edgeRatio: 0,
  quadFound: false,
  error: null,
};

/** Map object-cover video display rect → analysis canvas coordinates. */
function coverMapping(
  viewW: number,
  viewH: number,
  mediaW: number,
  mediaH: number,
) {
  const scale = Math.max(viewW / mediaW, viewH / mediaH);
  const drawW = mediaW * scale;
  const drawH = mediaH * scale;
  const offsetX = (viewW - drawW) / 2;
  const offsetY = (viewH - drawH) / 2;
  return { scale, offsetX, offsetY, drawW, drawH };
}

function paintOverlay(
  overlay: HTMLCanvasElement,
  host: HTMLElement,
  mediaW: number,
  mediaH: number,
  guide: QuadPoints,
  detected: QuadPoints | null,
) {
  const rect = host.getBoundingClientRect();
  if (!rect.width || !rect.height || !mediaW || !mediaH) return;

  const { scale, offsetX, offsetY } = coverMapping(rect.width, rect.height, mediaW, mediaH);
  overlay.width = Math.round(rect.width * devicePixelRatio);
  overlay.height = Math.round(rect.height * devicePixelRatio);
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;

  const ctx = overlay.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

  // Dim outside guide
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.save();
  drawQuadPath(ctx, guide, offsetX, offsetY, scale);
  ctx.clip();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.restore();

  drawQuadPath(ctx, guide, offsetX, offsetY, scale);
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.setLineDash([]);

  if (detected) {
    drawQuadPath(ctx, detected, offsetX, offsetY, scale);
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "rgba(74,222,128,0.18)";
    ctx.fill();
  }
}

export default function PhotoScanClient() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const detectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const reviewWrapRef = useRef<HTMLDivElement>(null);
  const frameSizeRef = useRef({ width: 0, height: 0 });

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [reviewQuad, setReviewQuad] = useState<QuadPoints | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [autoDetectOn, setAutoDetectOn] = useState(false);
  const [detectStatus, setDetectStatus] = useState<"off" | "loading" | "on" | "failed">("off");
  const [detectDebug, setDetectDebug] = useState<DetectDebugInfo>(EMPTY_DEBUG);
  const [showDebug, setShowDebug] = useState(false);
  const [liveQuad, setLiveQuad] = useState<QuadPoints | null>(null);

  const capturingRef = useRef(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setVideoReady(false);
  }, []);

  const refreshGuideOverlay = useCallback((detected: QuadPoints | null = null) => {
    const video = videoRef.current;
    const stage = stageRef.current;
    const overlay = overlayRef.current;
    if (!video?.videoWidth || !stage || !overlay) return;

    if (!detectCanvasRef.current) detectCanvasRef.current = document.createElement("canvas");
    const size = drawVideoToCanvas(video, detectCanvasRef.current, 720);
    if (!size) return;
    frameSizeRef.current = size;

    const guide = defaultPhotoQuad(size.width, size.height);
    paintOverlay(overlay, stage, size.width, size.height, guide, detected);
  }, []);

  const startCamera = useCallback(async () => {
    setErrorMessage(null);
    setPhase("loading");
    setVideoReady(false);
    setLiveQuad(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");

      // Keep constraints loose — exact 1080p often breaks / shrinks preview on iOS Safari
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
        },
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("video missing");

      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      await video.play();

      const ready = await waitForVideoFrame(video);
      if (!ready) throw new Error("video not ready");

      setVideoReady(true);
      setPhase("camera");
      requestAnimationFrame(() => refreshGuideOverlay(null));
    } catch (err) {
      setPhase("error");
      const name = err instanceof Error ? err.name : "";
      const message = err instanceof Error ? err.message : "";
      setErrorMessage(
        name === "NotAllowedError"
          ? "카메라 권한이 필요해요. 브라우저 설정에서 허용해 주세요"
          : name === "NotFoundError"
            ? "카메라를 찾을 수 없어요"
            : message === "video not ready"
              ? "카메라 화면을 준비하지 못했어요. 다시 시도해 주세요"
              : "카메라를 열 수 없어요. HTTPS에서 다시 시도해 주세요",
      );
    }
  }, [refreshGuideOverlay]);

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Keep guide painted on resize / orientation
  useEffect(() => {
    if (phase !== "camera" || !videoReady) return;
    const onResize = () => refreshGuideOverlay(liveQuad);
    window.addEventListener("resize", onResize);
    const id = window.setInterval(() => refreshGuideOverlay(liveQuad), 500);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearInterval(id);
    };
  }, [phase, videoReady, liveQuad, refreshGuideOverlay]);

  // Optional auto-detect — never blocks camera
  useEffect(() => {
    if (!autoDetectOn || phase !== "camera" || !videoReady) {
      if (!autoDetectOn) setDetectStatus("off");
      return;
    }

    let cancelled = false;
    setDetectStatus(isOpenCvReady() ? "on" : "loading");

    void (async () => {
      try {
        await loadOpenCv();
        if (!cancelled) setDetectStatus("on");
      } catch (err) {
        if (!cancelled) {
          setDetectStatus("failed");
          setAutoDetectOn(false);
          setDetectDebug({
            ...EMPTY_DEBUG,
            error: err instanceof Error ? err.message : "OpenCV load failed",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoDetectOn, phase, videoReady]);

  useEffect(() => {
    if (!autoDetectOn || detectStatus !== "on" || phase !== "camera" || !videoReady) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled || capturingRef.current) return;
      const video = videoRef.current;
      if (!video?.videoWidth) {
        timer = setTimeout(() => void tick(), 400);
        return;
      }

      if (!detectCanvasRef.current) detectCanvasRef.current = document.createElement("canvas");
      const size = drawVideoToCanvas(video, detectCanvasRef.current, 480);
      if (!size) {
        timer = setTimeout(() => void tick(), 400);
        return;
      }
      frameSizeRef.current = size;

      const { quad, debug } = await detectDocumentQuadWithDebug(detectCanvasRef.current);
      if (cancelled) return;
      setDetectDebug(debug);
      setLiveQuad(quad);
      refreshGuideOverlay(quad);
      timer = setTimeout(() => void tick(), 350);
    };

    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [autoDetectOn, detectStatus, phase, videoReady, refreshGuideOverlay]);

  const captureNow = useCallback(async () => {
    if (capturingRef.current) return;
    const video = videoRef.current;
    if (!video) {
      setErrorMessage("카메라를 찾을 수 없어요");
      return;
    }

    capturingRef.current = true;
    setIsCapturing(true);
    setErrorMessage(null);

    try {
      const ready = await waitForVideoFrame(video);
      if (!ready) {
        setErrorMessage("카메라가 아직 준비되지 않았어요");
        return;
      }

      const full = document.createElement("canvas");
      const fullSize = drawVideoToCanvas(video, full);
      if (!fullSize) {
        setErrorMessage("촬영에 실패했어요");
        return;
      }

      let quad = liveQuad
        ? ([
            {
              x: (liveQuad[0].x / frameSizeRef.current.width) * fullSize.width,
              y: (liveQuad[0].y / frameSizeRef.current.height) * fullSize.height,
            },
            {
              x: (liveQuad[1].x / frameSizeRef.current.width) * fullSize.width,
              y: (liveQuad[1].y / frameSizeRef.current.height) * fullSize.height,
            },
            {
              x: (liveQuad[2].x / frameSizeRef.current.width) * fullSize.width,
              y: (liveQuad[2].y / frameSizeRef.current.height) * fullSize.height,
            },
            {
              x: (liveQuad[3].x / frameSizeRef.current.width) * fullSize.width,
              y: (liveQuad[3].y / frameSizeRef.current.height) * fullSize.height,
            },
          ] as QuadPoints)
        : defaultPhotoQuad(fullSize.width, fullSize.height);

      if (!liveQuad && isOpenCvReady()) {
        try {
          const { quad: detected } = await detectDocumentQuadWithDebug(full);
          if (detected) quad = detected;
        } catch {
          // keep default guide
        }
      }

      setCapturedUrl(full.toDataURL("image/jpeg", 0.92));
      setImageSize(fullSize);
      setReviewQuad(quad);
      stopCamera();
      setPhase("review");
    } finally {
      capturingRef.current = false;
      setIsCapturing(false);
    }
  }, [liveQuad, stopCamera]);

  const applyScan = useCallback(async () => {
    if (!capturedUrl || !reviewQuad) return;
    setPhase("processing");
    setErrorMessage(null);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image load failed"));
        img.src = capturedUrl;
      });
      // Keep under free photo limit & avoid bloating scene JSON when guest fallback uses data URL
      const warped = warpPerspective(img, reviewQuad, 1400);
      const file = await canvasToJpegFile(warped, 0.8);
      if (file.size > 8 * 1024 * 1024) {
        const smaller = await canvasToJpegFile(warpPerspective(img, reviewQuad, 1000), 0.7);
        savePendingScanFiles([smaller]);
      } else {
        savePendingScanFiles([file]);
      }
      router.replace("/wall/edit");
    } catch (err) {
      setPhase("review");
      setErrorMessage(
        err instanceof Error && /quota|storage/i.test(err.message)
          ? "저장 공간이 부족해요. 다시 촬영해 주세요"
          : "평탄화에 실패했어요. 모서리를 다시 맞춰 보세요",
      );
    }
  }, [capturedUrl, reviewQuad, router]);

  const retake = useCallback(() => {
    setCapturedUrl(null);
    setReviewQuad(null);
    setLiveQuad(null);
    setErrorMessage(null);
    void startCamera();
  }, [startCamera]);

  const clientToImagePoint = useCallback(
    (clientX: number, clientY: number): Point2 | null => {
      const wrap = reviewWrapRef.current;
      if (!wrap) return null;
      const rect = wrap.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(imageSize.width, ((clientX - rect.left) / rect.width) * imageSize.width)),
        y: Math.max(0, Math.min(imageSize.height, ((clientY - rect.top) / rect.height) * imageSize.height)),
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
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-black text-white">
      <header
        className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Link
          href="/wall/edit"
          className="rounded-full bg-black/50 px-3 py-1.5 text-sm backdrop-blur-sm"
          onClick={stopCamera}
        >
          닫기
        </Link>
        <p className="rounded-full bg-black/50 px-3 py-1.5 text-xs backdrop-blur-sm">
          {phase === "review" ? "모서리 조정" : "사진 스캔"}
        </p>
        <button
          type="button"
          onClick={() => setShowDebug((v) => !v)}
          className="rounded-full bg-black/50 px-3 py-1.5 text-xs backdrop-blur-sm"
        >
          {showDebug ? "디버그 끔" : "디버그"}
        </button>
      </header>

      {(phase === "loading" || phase === "camera" || phase === "error") && (
        <div ref={stageRef} className="absolute inset-0">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`absolute inset-0 h-full w-full object-cover ${phase === "camera" ? "" : "opacity-0"}`}
          />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />

          {phase === "loading" && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
              카메라 여는 중…
            </p>
          )}

          {phase === "error" && (
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <div className="max-w-sm rounded-2xl bg-white/10 p-5 text-center backdrop-blur">
                <p className="text-sm">{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-900"
                >
                  다시 시도
                </button>
              </div>
            </div>
          )}

          {phase === "camera" && (
            <>
              {showDebug && (
                <div
                  className="pointer-events-none absolute inset-x-3 z-20 rounded-xl bg-black/70 p-2 font-mono text-[10px] leading-relaxed backdrop-blur"
                  style={{ top: "max(3.5rem, calc(env(safe-area-inset-top) + 2.75rem))" }}
                >
                  <p>
                    자동감지:{detectStatus} · 프레임 {frameSizeRef.current.width}×
                    {frameSizeRef.current.height}
                  </p>
                  <p>
                    분석 {detectDebug.ms}ms · 읽기:{detectDebug.readMethod} · 윤곽:
                    {detectDebug.contourCount} · 후보:{detectDebug.candidateCount}
                  </p>
                  <p>
                    엣지 {(detectDebug.edgeRatio * 100).toFixed(1)}% ·{" "}
                    {detectDebug.quadFound ? "사각형 O" : "사각형 X"}
                    {detectDebug.error ? ` · ${detectDebug.error}` : ""}
                  </p>
                </div>
              )}

              <div
                className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-3 px-4"
                style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
              >
                {errorMessage && (
                  <p className="rounded-full bg-red-500/80 px-3 py-1.5 text-center text-xs">{errorMessage}</p>
                )}
                <p className="rounded-full bg-black/55 px-3 py-1.5 text-center text-xs text-white/95 backdrop-blur-sm">
                  흰 가이드 안에 인생네컷·사진을 맞춘 뒤 촬영하세요
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAutoDetectOn((v) => !v)}
                    className={`rounded-full px-3 py-2 text-xs font-medium backdrop-blur-sm ${
                      autoDetectOn ? "bg-green-500/80 text-white" : "bg-white/15 text-white/90"
                    }`}
                  >
                    {detectStatus === "loading"
                      ? "감지 준비…"
                      : detectStatus === "failed"
                        ? "감지 불가"
                        : autoDetectOn
                          ? "자동감지 ON"
                          : "자동감지 OFF"}
                  </button>
                  <button
                    type="button"
                    disabled={isCapturing || !videoReady}
                    onClick={() => void captureNow()}
                    className="flex h-16 w-16 touch-manipulation items-center justify-center rounded-full border-4 border-white/90 bg-white/25 active:scale-95 disabled:opacity-40"
                    aria-label="촬영"
                  >
                    <span className="h-12 w-12 rounded-full bg-white" />
                  </button>
                  <label className="cursor-pointer rounded-full bg-white/15 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur-sm">
                    앨범
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        const url = URL.createObjectURL(file);
                        const img = new Image();
                        await new Promise<void>((resolve, reject) => {
                          img.onload = () => resolve();
                          img.onerror = () => reject(new Error("load failed"));
                          img.src = url;
                        });
                        const canvas = document.createElement("canvas");
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        canvas.getContext("2d")?.drawImage(img, 0, 0);
                        URL.revokeObjectURL(url);
                        setCapturedUrl(canvas.toDataURL("image/jpeg", 0.92));
                        setImageSize({ width: canvas.width, height: canvas.height });
                        setReviewQuad(defaultPhotoQuad(canvas.width, canvas.height));
                        stopCamera();
                        setPhase("review");
                      }}
                    />
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {(phase === "review" || phase === "processing") && capturedUrl && reviewQuad && (
        <div className="flex h-full flex-col">
          <div className="relative flex flex-1 items-center justify-center px-3 pt-14">
            <div
              ref={reviewWrapRef}
              className="relative mx-auto max-h-[70dvh] w-full max-w-lg"
              style={{ aspectRatio: `${imageSize.width} / ${imageSize.height}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedUrl}
                alt="촬영본"
                className="absolute inset-0 h-full w-full"
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

          {errorMessage && <p className="px-4 text-center text-sm text-red-300">{errorMessage}</p>}

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
