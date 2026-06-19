import { Suspense } from "react";
import QrImportPage from "./QrImportClient";

export default function ImportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-background text-sm text-muted">
          불러오는 중...
        </div>
      }
    >
      <QrImportPage />
    </Suspense>
  );
}
