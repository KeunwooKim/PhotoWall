/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    cv?: any;
  }
}

const OPENCV_CDNS = [
  "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0/dist/opencv.js",
  "https://docs.opencv.org/4.8.0/opencv.js",
];
const LOAD_TIMEOUT_MS = 25_000;

let loadPromise: Promise<any> | null = null;

function waitForCvReady(): Promise<any> {
  return new Promise((resolve, reject) => {
    const cv = window.cv;
    if (!cv) {
      reject(new Error("OpenCV failed to load"));
      return;
    }
    if (cv.Mat) {
      resolve(cv);
      return;
    }
    cv.onRuntimeInitialized = () => resolve(cv);
  });
}

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[data-opencv-src="${src}"]`);
  if (existing) {
    if (window.cv?.Mat) return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("OpenCV script failed")), {
        once: true,
      });
      if (window.cv) resolve();
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.opencv = "1";
    script.dataset.opencvSrc = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("OpenCV script failed"));
    document.head.appendChild(script);
  });
}

async function loadFromCdn(index: number): Promise<any> {
  if (index >= OPENCV_CDNS.length) {
    throw new Error("OpenCV script failed");
  }
  try {
    await loadScript(OPENCV_CDNS[index]);
    return await waitForCvReady();
  } catch {
    return loadFromCdn(index + 1);
  }
}

/** Load OpenCV.js from CDN once (heavy; never block camera startup on this). */
export function loadOpenCv(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV requires browser"));
  }
  if (window.cv?.Mat) return Promise.resolve(window.cv);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      loadPromise = null;
      reject(new Error("OpenCV load timeout"));
    }, LOAD_TIMEOUT_MS);

    void loadFromCdn(0)
      .then((cv) => {
        clearTimeout(timer);
        resolve(cv);
      })
      .catch((err) => {
        clearTimeout(timer);
        loadPromise = null;
        reject(err);
      });
  });

  return loadPromise;
}

export function isOpenCvReady(): boolean {
  return typeof window !== "undefined" && !!window.cv?.Mat;
}
