import { Jua } from "next/font/google";
import "./sticker-store.css";
import StickerStoreRouteGate from "@/components/stickers/StickerStoreRouteGate";

const jua = Jua({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-store-display",
  display: "swap",
});

/** Display font + store CSS for /stickers/* ; chrome is applied per-page. */
export default function StickersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={jua.variable}>
      <StickerStoreRouteGate>{children}</StickerStoreRouteGate>
    </div>
  );
}
