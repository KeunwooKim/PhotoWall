import type { Metadata } from "next";
import { Suspense } from "react";
import SupportPageClient from "@/components/support/SupportPageClient";

export const metadata: Metadata = {
  title: "고객센터 · PhotoWall",
  description: "자주 묻는 질문과 문의하기",
};

export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted">
          불러오는 중…
        </div>
      }
    >
      <SupportPageClient />
    </Suspense>
  );
}
