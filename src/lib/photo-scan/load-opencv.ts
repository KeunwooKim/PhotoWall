/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    cv?: any;
  }
}

const OPENCV_CDN = "https://docs.opencv.org/4.8.0/opencv.js";
const LOAD_TIMEOUT_MS = 25_000;

let loadPromise: Promise<any> | null = null;

function settleCv(
  resolve: (cv: any) => void,
  reject: (err: Error) => void,
  onSettled: () => void,
): void {
  const cv = window.cv;
  if (!cv) {
    onSettled();
    reject(new Error("OpenCV failed to load"));
    return;
  }
  if (cv.Mat) {
    onSettled();
    resolve(cv);
    return;
  }
  cv.onRuntimeInitialized = () => {
    onSettled();
    resolve(cv);
  };
}

/** Load OpenCV.js from CDN once (heavy; never block camera startup on this). */
export function loadOpenCv(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV requires browser"));
  }
  if (window.cv?.Mat) return Promise.resolve(window.cv);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    let settled = false;
    const onSettled = () => {
      settled = true;
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      loadPromise = null;
      onSettled();
      reject(new Error("OpenCV load timeout"));
    }, LOAD_TIMEOUT_MS);

    const finish = () => settleCv(resolve, reject, onSettled);

    const existing = document.querySelector<HTMLScriptElement>("script[data-opencv]");
    if (existing) {
      // load event may have already fired — do not wait on it exclusively
      finish();
      return;
    }

    const script = document.createElement("script");
    script.src = OPENCV_CDN;
    script.async = true;
    script.dataset.opencv = "1";
    script.onload = finish;
    script.onerror = () => {
      if (settled) return;
      loadPromise = null;
      onSettled();
      reject(new Error("OpenCV script failed"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function isOpenCvReady(): boolean {
  return typeof window !== "undefined" && !!window.cv?.Mat;
}
