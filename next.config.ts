import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [],
  },
  // onnxruntime-web uses wasm/dynamic imports — keep it client-only
  serverExternalPackages: ["onnxruntime-web"],
  async headers() {
    const api = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://api.photowall.kr";
    // Chromium CSP: https://host does NOT allow wss://host — Realtime needs both.
    const apiWs = api.replace(/^http/i, "ws");
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://accounts.google.com",
      // Next.js + Sentry + Google AdSense (site verification / Auto ads)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://browser.sentry-cdn.com https://pagead2.googlesyndication.com https://www.googletagservices.com https://www.google.com https://partner.googleadservices.com",
      "style-src 'self' 'unsafe-inline'",
      // Google OAuth avatars + AdSense creatives
      `img-src 'self' data: blob: ${api} https://*.googleusercontent.com https://*.googlesyndication.com https://pagead2.googlesyndication.com https://www.google.com https://googleads.g.doubleclick.net`,
      "font-src 'self' data:",
      `connect-src 'self' ${api} ${apiWs} https://*.ingest.us.sentry.io https://accounts.google.com https://www.googleapis.com https://*.googlesyndication.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://www.google.com https://partner.googleadservices.com`,
      "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://pagead2.googlesyndication.com https://www.googletagmanager.com",
      "worker-src 'self' blob:",
      "media-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

const hasSentryAuth = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  // Also readable from SENTRY_ORG / SENTRY_PROJECT env
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Bypass ad-blockers for event ingest
  tunnelRoute: "/monitoring",
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
  sourcemaps: {
    disable: !hasSentryAuth,
  },
});
