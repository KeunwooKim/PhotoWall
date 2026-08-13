"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PhotoWallLogo from "@/components/brand/PhotoWallLogo";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import { useStickerStoreGate } from "@/hooks/useStickerStoreGate";
import type { Profile } from "@/types/profile";

const SIDE_NAV = [
  { href: "/", label: "홈", icon: "home" as const },
  { href: "/walls", label: "벽꾸미기", icon: "wall" as const },
  { href: "/stickers", label: "스티커 스토어", icon: "sticker" as const },
  { href: "/profile", label: "내 프로필", icon: "user" as const },
  { href: "/settings", label: "설정", icon: "settings" as const },
];

interface AppDesktopSidebarProps {
  /** Optional badge count on 벽꾸미기 */
  wallsBadge?: number;
}

/** Shared left rail for desktop hub pages (home / walls / profile / settings). */
export default function AppDesktopSidebar({ wallsBadge }: AppDesktopSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { handleStoreClick, Toast } = useStickerStoreGate();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    authFetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Profile | null) => setProfile(data))
      .catch(() => {});
  }, [user]);

  const displayName =
    profile?.displayName ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "게스트";
  const avatarUrl =
    profile?.avatarUrl ?? (user?.user_metadata?.avatar_url as string | undefined) ?? null;
  const friendCode = profile?.friendCode ?? null;

  return (
    <aside className="flex h-[100dvh] flex-col overflow-y-auto border-r border-foreground/10 bg-surface py-7 text-foreground">
      <div className="border-b border-foreground/8 px-[22px] pb-8">
        <PhotoWallLogo variant="lockup" height={36} />
        <p className="mt-2 ml-0.5 text-[11px] text-muted">나만의 감성 사진 아카이브</p>
      </div>

      <nav className="flex-1 px-3 py-5">
        {SIDE_NAV.map(({ href, label, icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : href === "/walls"
                ? pathname === "/walls" ||
                  pathname === "/wall/edit" ||
                  pathname.startsWith("/shared/")
                : href === "/stickers"
                  ? pathname === "/stickers" || pathname.startsWith("/stickers/")
                  : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={href === "/stickers" ? handleStoreClick : undefined}
              className={`mb-1 flex w-full items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-sm transition ${
                active
                  ? "bg-accent/20 font-bold text-accent-dark"
                  : "font-normal text-muted hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              <SideIcon name={icon} />
              {label}
              {href === "/walls" && typeof wallsBadge === "number" && wallsBadge > 0 && (
                <span className="ml-auto rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">
                  {wallsBadge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <Link
          href="/wall/edit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-dark py-3.5 text-sm font-bold text-background"
        >
          <SparkleIcon />
          벽 꾸미기
        </Link>
      </div>

      <Link
        href={user ? "/profile" : "/"}
        className="mx-3 mb-1 flex items-center gap-2.5 rounded-2xl border border-foreground/10 bg-background p-3.5"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-[38px] w-[38px] shrink-0 rounded-full border-2 border-foreground/20 object-cover"
          />
        ) : (
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-2 border-foreground/20 bg-foreground/5 text-sm font-bold text-foreground">
            {displayName.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold">{user ? "나의 방" : "게스트"}</p>
          <p className="truncate text-[11px] text-muted">
            {friendCode ? `@${friendCode}` : user ? displayName : "로그인 하기"}
          </p>
        </div>
      </Link>
      {Toast}
    </aside>
  );
}

function SideIcon({ name }: { name: "home" | "wall" | "sticker" | "user" | "settings" }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none" as const };
  if (name === "home") {
    return (
      <svg {...common} aria-hidden>
        <path
          d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    );
  }
  if (name === "wall") {
    return (
      <svg {...common} aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "sticker") {
    return (
      <svg {...common} aria-hidden>
        <path
          d="M12 3l1.2 5.2L18 9.5l-4.8 1.3L12 16l-1.2-5.2L6 9.5l4.8-1.3L12 3z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="18.5" cy="17.5" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (name === "user") {
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.2 5.2L18 9.5l-4.8 1.3L12 16l-1.2-5.2L6 9.5l4.8-1.3L12 3z"
        fill="currentColor"
      />
      <path
        d="M18 14l.6 2.4L21 17l-2.4.6L18 20l-.6-2.4L15 17l2.4-.6L18 14z"
        fill="currentColor"
      />
    </svg>
  );
}
