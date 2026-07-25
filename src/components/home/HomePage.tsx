"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Outfit } from "next/font/google";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import AppShell from "@/components/layout/AppShell";
import AuthButton from "@/components/auth/AuthButton";
import { useAuth } from "@/hooks/useAuth";

const brandFont = Outfit({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export default function HomePage() {
  const { user } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("auth_error")) return;
    window.history.replaceState({}, "", "/");
    setAuthError("Google 로그인에 실패했어요. Supabase·Google Cloud URL 설정을 확인해 주세요.");
  }, []);

  return (
    <AppShell tone="home">
      <div className="relative -mx-5 -mt-6">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/wallpapers/studio-pink.png')" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/75 via-white/55 to-[var(--background)] dark:from-black/70 dark:via-black/55 dark:to-[var(--background)]"
          aria-hidden
        />

        <div className="relative px-5 pb-10 pt-6">
          <AnnouncementBanner target="home" />

          {authError && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/95 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
              {authError}
            </div>
          )}

          <section className="home-hero-enter mt-8 space-y-4">
            <h1
              className={`${brandFont.className} text-[2.75rem] font-bold leading-none tracking-tight text-foreground sm:text-5xl`}
            >
              PhotoWall
            </h1>
            <p className="max-w-[18rem] text-sm leading-relaxed text-foreground/70">
              네컷을 벽에 붙이듯, 테이프와 스티커로 꾸며요.
            </p>
          </section>

          <div className="home-hero-enter home-hero-enter-delay mt-8">
            <WallPreview />
          </div>

          <section className="home-hero-enter home-hero-enter-delay-2 mt-8 space-y-3">
            <Link
              href="/wall/edit"
              className="flex w-full items-center justify-center rounded-2xl bg-foreground px-6 py-4 text-sm font-semibold text-background transition active:scale-[0.98]"
            >
              내 벽 꾸미기
            </Link>
            {user ? (
              <Link
                href="/profile"
                className="flex w-full items-center justify-center py-2 text-sm text-muted transition hover:text-foreground"
              >
                공동 벽 · 친구
              </Link>
            ) : (
              <div className="flex justify-center pt-1">
                <AuthButton />
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

/** Stylized product preview — framed photos on a wall, not a feature card grid. */
function WallPreview() {
  return (
    <div
      className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-sm shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
      style={{
        backgroundImage: "url('/wallpapers/linen-cream.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      aria-hidden
    >
      <div className="home-float absolute left-[12%] top-[16%] w-[38%]">
        <div className="relative rotate-[-6deg]">
          <Polaroid src="/wallpapers/studio-pink.png" />
          <span className="absolute -top-2 left-1/2 h-3 w-12 -translate-x-1/2 rotate-[-8deg] rounded-sm bg-[#f4d6a0]/70 shadow-sm" />
        </div>
      </div>

      <div className="home-float-slow absolute right-[10%] top-[22%] w-[40%]">
        <div className="relative rotate-[5deg]">
          <Polaroid src="/wallpapers/sage-room.png" />
          <span className="absolute -top-1.5 left-[20%] h-3 w-10 rotate-[12deg] rounded-sm bg-[#9dc4b5]/80 shadow-sm" />
        </div>
      </div>

      <div className="home-float absolute bottom-[14%] left-[28%] w-[42%]">
        <div className="relative rotate-[-2deg]">
          <Polaroid src="/wallpapers/cafe-cork.png" />
          <span className="absolute -top-2 right-[25%] h-3 w-11 rotate-[-4deg] rounded-sm bg-[#fda4af]/75 shadow-sm" />
        </div>
      </div>

      <img
        src="/stickers/basic/heart.svg"
        alt=""
        className="home-float-slow absolute bottom-[18%] right-[14%] h-9 w-9 drop-shadow-sm"
      />
      <img
        src="/stickers/basic/star.svg"
        alt=""
        className="home-float absolute left-[8%] top-[46%] h-7 w-7 drop-shadow-sm"
      />
    </div>
  );
}

function Polaroid({ src }: { src: string }) {
  return (
    <div className="rounded-[2px] bg-white p-1.5 pb-5 shadow-md ring-1 ring-black/5">
      <div
        className="aspect-[3/4] w-full bg-cover bg-center"
        style={{ backgroundImage: `url('${src}')` }}
      />
    </div>
  );
}
