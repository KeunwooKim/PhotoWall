"use client";

import { useEffect } from "react";
import FriendsContent from "@/components/social/FriendsContent";

interface FriendsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FriendsPanel({ isOpen, onClose }: FriendsPanelProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/25 transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="친구"
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl bg-surface text-foreground shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-foreground/20" />

        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">친구</h2>
            <p className="mt-0.5 text-xs text-muted">코드로 연결하고 벽을 방문해요</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-foreground/[0.06] hover:text-foreground"
            aria-label="닫기"
          >
            <CloseIcon />
          </button>
        </div>

        <FriendsContent
          variant="sheet"
          hideMyCode
          active={isOpen}
          onClose={onClose}
        />
      </aside>
    </>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
