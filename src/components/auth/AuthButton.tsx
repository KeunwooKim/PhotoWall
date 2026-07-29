"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface AuthButtonProps {
  className?: string;
  /** Avatar / short login — for immersive editor & viewer chrome */
  compact?: boolean;
}

/** Google sign-in only — consent is collected after login via SyncLegalConsent. */
export default function AuthButton({ className = "", compact = false }: AuthButtonProps) {
  const { user, isLoading, isConfigured, signInWithGoogle, signOut } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  if (!isConfigured) return null;

  const handleSignIn = async () => {
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setIsSubmitting(true);
    try {
      await signOut();
      setMenuOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className={`rounded-full bg-surface/90 px-3 py-2 text-xs text-muted shadow-sm ring-1 ring-foreground/10 ${className}`}
      >
        ...
      </div>
    );
  }

  if (user) {
    const name =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0] ??
      "나";
    const initial = name.trim().charAt(0).toUpperCase() || "나";

    if (compact) {
      return (
        <div ref={rootRef} className={`relative ${className}`}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-xs font-semibold text-foreground shadow-sm ring-1 ring-foreground/10"
            aria-label={`${name} 계정 메뉴`}
            aria-expanded={menuOpen}
          >
            {initial}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-2xl bg-white py-1 shadow-lg ring-1 ring-black/10">
              <p className="truncate px-3 py-2 text-xs font-medium text-foreground">{name}</p>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-left text-xs text-muted transition hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="max-w-[100px] truncate rounded-full bg-surface/90 px-3 py-2 text-xs font-medium text-foreground shadow-sm ring-1 ring-foreground/10 sm:max-w-[140px]">
          {name}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSubmitting}
          className="rounded-full bg-surface/90 px-3 py-2 text-xs text-muted shadow-sm ring-1 ring-foreground/10 transition hover:text-foreground disabled:opacity-50"
        >
          로그아웃
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void handleSignIn()}
        disabled={isSubmitting}
        className={`rounded-full bg-surface px-3 py-2 text-xs font-medium text-foreground shadow-sm ring-1 ring-foreground/10 transition hover:shadow-md active:scale-95 disabled:opacity-50 ${className}`}
      >
        {isSubmitting ? "…" : "로그인"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignIn()}
      disabled={isSubmitting}
      className={`flex items-center gap-2 rounded-full bg-surface px-3 py-2 text-xs font-medium text-foreground shadow-md ring-1 ring-foreground/10 transition hover:shadow-lg active:scale-95 disabled:opacity-50 sm:px-4 ${className}`}
    >
      <GoogleIcon />
      {isSubmitting ? "연결 중..." : "Google 로그인"}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
