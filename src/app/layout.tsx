import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { getAdSenseClientId } from "@/lib/ads/adsense";
import "./globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";
import ThemeScript from "@/providers/ThemeScript";
import SyncLegalConsent from "@/components/auth/SyncLegalConsent";
import Analytics from "@/components/analytics/Analytics";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist-sans",
});

const adsenseClientId = getAdSenseClientId();
const adsenseSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`;

export const metadata: Metadata = {
  title: "PhotoWall — 디지털 포토월",
  description: "네컷사진을 디지털 벽에 붙이고 꾸미는 Z세대 감성 포토월 서비스",
  other: {
    "google-adsense-account": adsenseClientId,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/*
          AdSense ownership crawlers require a literal <script src=…adsbygoogle.js?client=ca-pub-…>
          in the initial HTML <head>. next/script (even beforeInteractive) only emits preload +
          a client loader, which Google does not count as the snippet.
        */}
        <script async src={adsenseSrc} crossOrigin="anonymous" />
        <ThemeScript />
      </head>
      <body className={`${notoSansKr.variable} antialiased`}>
        <ThemeProvider>
          <SyncLegalConsent />
          <Analytics />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
