import { Suspense } from "react";
import PhotoScanClient from "./PhotoScanClient";

export default function CapturePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-950 text-sm text-white/70">
          불러오는 중...
        </div>
      }
    >
      <PhotoScanClient />
    </Suspense>
  );
}
