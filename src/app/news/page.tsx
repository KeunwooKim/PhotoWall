import type { Metadata } from "next";
import NewsPageClient from "./NewsPageClient";

export const metadata: Metadata = {
  title: "공지·이벤트 · PhotoWall",
};

export default function NewsPage() {
  return <NewsPageClient />;
}
