"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import WallViewer from "@/components/wall/WallViewer";
import { decodeWallFromShare } from "@/lib/wall-share";
import { isWallThemeId } from "@/lib/wall-themes";

function ShareWallContent() {
  const searchParams = useSearchParams();
  const encoded = searchParams.get("d");

  if (!encoded) {
    return <WallError message="공유 링크가 올바르지 않아요" />;
  }

  const data = decodeWallFromShare(encoded);
  if (!data || !isWallThemeId(data.themeId)) {
    return <WallError message="벽 데이터를 불러올 수 없어요" />;
  }

  return (
    <WallViewer
      themeId={data.themeId}
      canvasJson={data.canvasJson}
      readOnly
    />
  );
}

function WallError({ message }: { message: string }) {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-sm text-muted">{message}</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-foreground underline">
          내 벽 꾸미러 가기
        </Link>
      </div>
    </div>
  );
}

export default function ShareWallPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-white text-sm text-muted">
          불러오는 중...
        </div>
      }
    >
      <ShareWallContent />
    </Suspense>
  );
}
