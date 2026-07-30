"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0f0f0f",
          color: "#f5f5f5",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
            일시적인 오류가 났어요
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, margin: "0 0 20px" }}>
            새로고침 후에도 계속되면 잠시 후 다시 시도해 주세요
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              borderRadius: 10,
              padding: "10px 16px",
              background: "#f5f5f5",
              color: "#0f0f0f",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            새로고침
          </button>
        </div>
      </body>
    </html>
  );
}
