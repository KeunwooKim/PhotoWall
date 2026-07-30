"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LOCAL_STORAGE_QUOTA_EVENT } from "@/lib/wall-storage";

const DISMISSED_KEY = "photowall-guest-banner-dismissed";

interface GuestSaveBannerProps {
  /** 오브젝트가 하나라도 있을 때만 표시 */
  hasObjects: boolean;
}

export default function GuestSaveBanner({ hasObjects }: GuestSaveBannerProps) {
  const { user, isLoading, isConfigured, signInWithGoogle } = useAuth();
  const [dismissed, setDismissed] = useState(true); // 초기엔 숨김 — hydration 후 결정
  const [quotaHit, setQuotaHit] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(!!localStorage.getItem(DISMISSED_KEY));

    const onQuota = () => {
      setQuotaHit(true);
      setDismissed(false);
    };
    window.addEventListener(LOCAL_STORAGE_QUOTA_EVENT, onQuota);
    return () => window.removeEventListener(LOCAL_STORAGE_QUOTA_EVENT, onQuota);
  }, []);

  const handleDismiss = () => {
    if (quotaHit) {
      setDismissed(true);
      return;
    }
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const handleLogin = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  if (!isConfigured || isLoading || user || dismissed || !hasObjects) return null;

  return (
    <div
      className="absolute inset-x-0 z-30 flex items-center gap-3 bg-foreground px-4 py-3"
      style={{ bottom: "max(5rem, calc(env(safe-area-inset-bottom) + 4rem))" }}
    >
      <p className="min-w-0 flex-1 text-xs leading-snug text-background/80">
        {quotaHit
          ? "이 기기 저장 공간이 가득 찼어요. 로그인하면 클라우드에 안전하게 보관돼요"
          : "로그인하면 클라우드에 저장돼요. 브라우저 데이터를 지우면 이 기기 작업도 사라질 수 있어요"}
      </p>
      <button
        type="button"
        onClick={handleLogin}
        disabled={isSigningIn}
        className="shrink-0 rounded-lg bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition active:scale-95 disabled:opacity-60"
      >
        {isSigningIn ? "로그인 중..." : "로그인"}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="닫기"
        className="shrink-0 text-background/50 transition hover:text-background/80"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
    </div>
  );
}
