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
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://accounts.google.com",
      // Next.js + Sentry browser SDK need inline/eval in production builds today
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://browser.sentry-cdn.com",
      "style-src 'self' 'unsafe-inline'",
      // Google OAuth avatars (lh3/lh4/…googleusercontent.com)
      `img-src 'self' data: blob: ${api} https://*.googleusercontent.com`,
      "font-src 'self' data:",
      `connect-src 'self' ${api} https://*.ingest.us.sentry.io https://accounts.google.com https://www.googleapis.com`,
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
