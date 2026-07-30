import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  // onnxruntime-web uses wasm/dynamic imports — keep it client-only
  serverExternalPackages: ["onnxruntime-web"],
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
  disableLogger: true,
  sourcemaps: {
    disable: !hasSentryAuth,
  },
});
