import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

function isIosLikeDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
}

const iosLike = isIosLikeDevice();

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : iosLike ? 0 : 0.1,
  // Replay allocates extra memory — disable on iOS where /wall/edit already stresses Safari.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: dsn && !iosLike ? 1.0 : 0,
  integrations: iosLike
    ? []
    : [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
