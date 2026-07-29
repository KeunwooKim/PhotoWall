/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    cv?: any;
  }
}

const OPENCV_CDN = "https://docs.opencv.org/4.8.0/opencv.js";

let loadPromise: Promise<any> | null = null;

/** Load OpenCV.js from CDN once (heavy; call only on /capture). */
export function loadOpenCv(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV requires browser"));
  }
  if (window.cv?.Mat) return Promise.resolve(window.cv);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const finish = () => {
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
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[data-opencv]`);
    if (existing) {
      if (window.cv) finish();
      else existing.addEventListener("load", finish);
      return;
    }

    const script = document.createElement("script");
    script.src = OPENCV_CDN;
    script.async = true;
    script.dataset.opencv = "1";
    script.onload = finish;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("OpenCV script failed"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
