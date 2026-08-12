import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { BRAND } from "@/lib/brand/assets";
import { getSiteBaseUrl } from "@/lib/site-url";
import "./globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";
import ThemeScript from "@/providers/ThemeScript";
import SyncLegalConsent from "@/components/auth/SyncLegalConsent";
import Analytics from "@/components/analytics/Analytics";
import AdSenseBootstrap from "@/components/ads/AdSenseBootstrap";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist-sans",
});

const siteUrl = getSiteBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "PhotoWall — 디지털 포토월",
  description: "네컷사진을 디지털 벽에 붙이고 꾸미는 Z세대 감성 포토월 서비스",
  icons: {
    icon: [
      { url: BRAND.favicon, type: "image/png" },
      { url: BRAND.markSvg, type: "image/svg+xml" },
    ],
    apple: BRAND.appleTouchIcon,
  },
  openGraph: {
    title: "PhotoWall — 디지털 포토월",
    description: "네컷사진을 디지털 벽에 붙이고 꾸미는 Z세대 감성 포토월 서비스",
    url: siteUrl,
    images: [{ url: BRAND.ogDefault, width: 1200, height: 630, alt: "PhotoWall" }],
  },
  verification: {
    other: {
      "naver-site-verification": "b5d3caa6387bb5f31b1805c003a958ca4f92397b",
    },
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
        <meta
          name="naver-site-verification"
          content="b5d3caa6387bb5f31b1805c003a958ca4f92397b"
        />
        <ThemeScript />
      </head>
      <body className={`${notoSansKr.variable} antialiased`}>
        <ThemeProvider>
          <SyncLegalConsent />
          <Analytics />
          <AdSenseBootstrap />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
