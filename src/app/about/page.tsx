import type { Metadata } from "next";
import PromoLanding from "@/components/promo/PromoLanding";

export const metadata: Metadata = {
  title: "PhotoWall 소개 — 디지털 포토월",
  description:
    "네컷사진을 디지털 벽에 붙이고 꾸미는 감성 포토월. 자유 배치, 공동 벽, 친구 방문, AI 스캔까지.",
  openGraph: {
    title: "PhotoWall — 디지털 포토월",
    description:
      "네컷사진을 디지털 벽에 붙이고 꾸미는 감성 포토월. 로그인 없이 바로 체험해 보세요.",
    type: "website",
  },
};

export default function AboutPage() {
  return <PromoLanding showHomeLink />;
}
