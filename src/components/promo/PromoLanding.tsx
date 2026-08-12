"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gaegu } from "next/font/google";
import AuthButton from "@/components/auth/AuthButton";
import PhotoWallLogo from "@/components/brand/PhotoWallLogo";
import AdSenseSlot from "@/components/ads/AdSenseSlot";
import { getAdSenseSlotLanding } from "@/lib/ads/adsense";
import PromoCollabDemo from "@/components/promo/PromoCollabDemo";
import PromoCollabInviteMock from "@/components/promo/PromoCollabInviteMock";
import PromoWallShowcase from "@/components/promo/PromoWallShowcase";
import { useAuth } from "@/hooks/useAuth";
import "./promo-landing.css";

const displayFont = Gaegu({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-gaegu",
});

const FEATURES = [
  {
    icon: "📌",
    bg: "rgba(255,91,141,0.1)",
    title: "자유롭게 붙이고 꾸미기",
    body: "사진·스티커·마스킹 테이프를 비뚤어지게 붙여요. 회전, 크기 조절, 레이어 순서까지 — 아날로그 벽 감성 그대로.",
  },
  {
    icon: "⚡",
    bg: "rgba(184,224,210,0.2)",
    title: "로그인 없이 먼저 체험",
    body: "바로 벽을 꾸며보고, 나중에 로그인하면 클라우드에 이어서 저장해요. 가입 부담 없이 시작.",
  },
  {
    icon: "👥",
    bg: "rgba(197,180,227,0.2)",
    title: "친구와 함께 공동 벽",
    body: "함께 꾸미는 방과 친구 벽 방문으로 추억을 나눠요. 방명록 사진을 몰래 붙여두고 오는 재미.",
  },
  {
    icon: "📸",
    bg: "rgba(255,209,102,0.15)",
    title: "네컷 스캔 · QR 가져오기",
    body: "카메라로 찍거나 부스 QR로 가져와 벽에 바로 붙여요. 오프라인 네컷을 디지털로 자연스럽게.",
  },
  {
    icon: "🔗",
    bg: "rgba(255,91,141,0.08)",
    title: "링크로 보여주고 방명록",
    body: "나만의 벽 링크를 공유하면 친구가 사진과 응원을 남길 수 있어요. 미니홈피 감성.",
  },
  {
    icon: "📲",
    bg: "rgba(184,224,210,0.2)",
    title: "인스타 스토리 공유",
    body: "내 포토월을 한 장으로 캡처해서 인스타에 바로 올려요. 탭 하나로 공유까지.",
  },
] as const;

interface PromoLandingProps {
  showHomeLink?: boolean;
}

function userDisplayName(email?: string | null, fullName?: string | null) {
  if (fullName) return fullName.slice(0, 8);
  if (email) return email.split("@")[0].slice(0, 8);
  return null;
}

export default function PromoLanding({ showHomeLink = false }: PromoLandingProps) {
  const { user } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_error")) {
      window.history.replaceState({}, "", window.location.pathname);
      setAuthError("Google 로그인에 실패했어요. Supabase·Google Cloud URL 설정을 확인해 주세요.");
    }
  }, []);

  useEffect(() => {
    const reveals = document.querySelectorAll(".promo-landing .promo-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("promo-visible");
        });
      },
      { threshold: 0.12 },
    );
    reveals.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const displayName = userDisplayName(
    user?.email,
    user?.user_metadata?.full_name as string | undefined,
  );

  return (
    <div
      className={`promo-landing ${displayFont.variable} ${displayFont.className} min-h-[100dvh] overflow-x-hidden`}
    >
      {/* Nav */}
      <nav
        className="fixed inset-x-0 top-0 z-[200] flex h-[60px] items-center justify-between border-b border-[rgba(28,25,23,0.1)] bg-[rgba(250,247,242,0.88)] px-5 backdrop-blur-xl sm:px-10"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <PhotoWallLogo
          variant="lockup"
          height={36}
          wordmarkClassName="text-[#1c1917]"
          markFill="#faf7f2"
        />
        <div className="flex items-center gap-3 sm:gap-5">
          {displayName ? (
            <span className="hidden text-[13px] text-[#9b8e82] sm:inline">{displayName}</span>
          ) : null}
          <AuthButton compact className="!bg-transparent !shadow-none !ring-0 !text-[#9b8e82] hover:!text-[#1c1917]" />
          <Link
            href="/wall/edit"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1c1917] px-4 py-2 text-[13px] font-medium text-[#faf7f2] transition hover:opacity-80"
          >
            지금 꾸며보기 →
          </Link>
        </div>
      </nav>

      {authError ? (
        <div className="relative z-10 mx-auto max-w-5xl px-5 pt-[calc(60px+env(safe-area-inset-top))]">
          <div className="rounded-2xl border border-rose-200 bg-rose-50/95 px-4 py-3 text-sm text-rose-800">
            {authError}
          </div>
        </div>
      ) : null}

      {/* Hero */}
      <section className="grid min-h-[100vh] grid-cols-1 overflow-hidden pt-[60px] lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-16 sm:px-16 sm:py-20 lg:py-24">
          <p className="promo-reveal mb-6 text-[11px] font-medium uppercase tracking-[0.25em] text-[#ff5b8d]">
            디지털 포토월 플랫폼
          </p>
          <h1
            className={`promo-reveal ${displayFont.className} text-[2.75rem] leading-[1.1] text-[#1c1917] sm:text-[4.5rem]`}
          >
            네컷사진,
            <br />
            <span className="text-[#ff5b8d]">디지털 벽</span>에
            <br />
            <span className="relative inline-block after:absolute after:inset-x-0 after:bottom-1 after:h-[3px] after:rounded-sm after:bg-[#c9a97a] after:content-['']">
              붙여봐
            </span>
          </h1>
          <p className="promo-reveal mt-6 max-w-[380px] text-base leading-relaxed text-[#9b8e82]">
            방 벽에 마스킹 테이프로 비뚤게 붙이던 그 감각.
            <br />
            친구와 <strong className="font-medium text-[#1c1917]">같은 벽</strong>에 함께 붙일 수도
            있어요.
          </p>
          <div className="promo-reveal mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/wall/edit"
              className="inline-flex items-center gap-2 rounded-full bg-[#ff5b8d] px-7 py-3.5 text-[15px] font-medium text-white shadow-[0_4px_20px_rgba(255,91,141,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(255,91,141,0.35)]"
            >
              벽 꾸미기 시작 ✦
            </Link>
            <a
              href="#wall"
              className="border-b border-[rgba(28,25,23,0.1)] pb-0.5 text-[14px] text-[#9b8e82] transition hover:border-[#1c1917] hover:text-[#1c1917]"
            >
              미리 구경하기
            </a>
          </div>
          <p className="promo-reveal mt-5 flex items-center gap-1.5 text-[12px] text-[#9b8e82] before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#4a9b83] before:content-['']">
            계정 없이 바로 체험할 수 있어요
          </p>
        </div>

        <div className="relative flex items-center justify-center overflow-hidden bg-[#f0ebe3] px-6 py-12 lg:py-0">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              backgroundImage: `
                radial-gradient(circle at 30% 60%, rgba(201,169,122,0.15) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(255,91,141,0.08) 0%, transparent 40%),
                radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)
              `,
              backgroundSize: "auto, auto, 12px 12px",
            }}
          />
          <div className="promo-reveal relative z-[2] w-full max-w-[540px]">
            <PromoCollabDemo />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[720px] px-6 py-8 sm:px-16">
        <AdSenseSlot slot={getAdSenseSlotLanding()} plan={null} className="promo-reveal" />
      </div>

      {/* Wall showcase tabs */}
      <PromoWallShowcase />

      {/* Features */}
      <section className="px-6 py-20 sm:px-16 sm:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className="promo-reveal text-[11px] font-medium uppercase tracking-[0.2em] text-[#ff5b8d]">
            이렇게 쓸 수 있어요
          </p>
          <h2
            className={`promo-reveal ${displayFont.className} mt-3 text-[2rem] leading-tight text-[#1c1917] sm:text-[3rem]`}
          >
            혼자도, 같이도
            <br />
            추억을 전시해요
          </h2>
          <p className="promo-reveal mt-4 max-w-md text-base leading-relaxed text-[#9b8e82]">
            혼자 꾸미기부터 친구와 함께하는 공동 벽까지, 내 취향대로 디지털 쇼룸을 만들어요.
          </p>

          <div className="promo-reveal mt-14 grid grid-cols-1 overflow-hidden rounded-2xl border border-[rgba(28,25,23,0.1)] sm:grid-cols-2">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className={`bg-white p-9 transition hover:bg-[#fffbf9] ${
                  i % 2 === 1 ? "sm:border-l sm:border-[rgba(28,25,23,0.1)]" : ""
                } ${i >= 2 ? "border-t border-[rgba(28,25,23,0.1)]" : ""}`}
              >
                <div
                  className="mb-5 flex h-10 w-10 items-center justify-center rounded-[10px] text-xl"
                  style={{ background: feature.bg }}
                >
                  {feature.icon}
                </div>
                <h3 className={`${displayFont.className} mb-2.5 text-[22px] font-bold text-[#1c1917]`}>
                  {feature.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-[#9b8e82]">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Collab */}
      <section className="bg-[#f5f1eb] px-6 py-20 sm:px-16 sm:py-24">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="promo-reveal text-[11px] font-medium uppercase tracking-[0.2em] text-[#ff5b8d]">
              공동 벽
            </p>
            <h2
              className={`promo-reveal ${displayFont.className} mt-3 text-[2rem] leading-tight text-[#1c1917] sm:text-[3rem]`}
            >
              같은 벽을
              <br />
              같이 꾸며요
            </h2>
            <p className="promo-reveal mt-4 max-w-md text-base leading-relaxed text-[#9b8e82]">
              친구를 초대하면 한 벽에 함께 사진을 붙일 수 있어요. 누가 무엇을 올렸는지 바로
              보이고, 떨어져 있어도 실시간으로 맞춰져요.
            </p>
            <ul className="promo-reveal mt-6 space-y-3 text-[14px] text-[#1c1917]">
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff5b8d]" />
                <span>
                  <strong className="font-medium">초대 링크</strong>
                  <span className="text-[#9b8e82]">로 친구를 바로 불러요</span>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4a9b83]" />
                <span>
                  <strong className="font-medium">동시 편집</strong>
                  <span className="text-[#9b8e82]"> — 각자 붙인 사진이 바로 반영돼요</span>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7c6bb0]" />
                <span>
                  <strong className="font-medium">누가 올렸는지</strong>
                  <span className="text-[#9b8e82]"> 표시되어 추억이 더 선명해져요</span>
                </span>
              </li>
            </ul>
            <Link
              href="/wall/edit"
              className="promo-reveal mt-8 inline-flex items-center rounded-full bg-[#ff5b8d] px-7 py-3.5 text-[15px] font-medium text-white shadow-[0_4px_20px_rgba(255,91,141,0.3)] transition hover:-translate-y-0.5"
            >
              공동 벽 만들어보기 →
            </Link>
          </div>

          <div className="promo-reveal flex w-full justify-center lg:justify-end">
            <PromoCollabInviteMock />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1c1917] px-6 py-24 text-center sm:px-16 sm:py-28">
        <div className="mx-auto max-w-[600px]">
          <p className="promo-reveal text-[11px] font-medium uppercase tracking-[0.2em] text-[#b8e0d2]">
            지금 시작해요
          </p>
          <h2
            className={`promo-reveal ${displayFont.className} mt-4 text-[2.5rem] leading-[1.15] text-[#faf7f2] sm:text-[3.75rem]`}
          >
            지금 내 벽을
            <br />
            만들어봐요 🏠
          </h2>
          <p className="promo-reveal mt-5 text-[15px] leading-relaxed text-[rgba(250,247,242,0.5)]">
            네컷사진, 비뚤게 붙여도 돼요.
            <br />
            오히려 그게 더 예쁘잖아요.
          </p>
          <div className="promo-reveal mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/wall/edit"
              className="inline-flex items-center rounded-full bg-[#faf7f2] px-7 py-3.5 text-[15px] font-medium text-[#1c1917] transition hover:opacity-90"
            >
              벽 꾸미기 시작
            </Link>
            <AuthButton className="!rounded-full !border !border-[rgba(250,247,242,0.15)] !bg-transparent !px-6 !py-3.5 !text-[14px] !font-normal !text-[rgba(250,247,242,0.5)] hover:!border-[rgba(250,247,242,0.4)] hover:!text-[rgba(250,247,242,0.8)]" />
          </div>
          <p className="promo-reveal mt-5 text-[12px] text-[rgba(250,247,242,0.3)]">
            계정 없이도 꾸밀 수 있고, 저장이 필요하면 Google로 이어가요.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="flex flex-wrap items-center justify-between gap-3 bg-[#1c1917] border-t border-[rgba(250,247,242,0.07)] px-6 py-7 sm:px-16"
        style={{ paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))" }}
      >
        <PhotoWallLogo
          variant="lockup"
          height={32}
          wordmarkClassName="text-[#faf7f2]"
          markFill="#1c1917"
        />
        <nav className="flex flex-wrap gap-5">
          {showHomeLink ? (
            <Link href="/" className="text-[12px] text-[rgba(250,247,242,0.3)] hover:text-[rgba(250,247,242,0.7)]">
              홈으로
            </Link>
          ) : null}
          <Link href="/legal/terms" className="text-[12px] text-[rgba(250,247,242,0.3)] hover:text-[rgba(250,247,242,0.7)]">
            이용약관
          </Link>
          <Link href="/legal/privacy" className="text-[12px] text-[rgba(250,247,242,0.3)] hover:text-[rgba(250,247,242,0.7)]">
            개인정보처리방침
          </Link>
        </nav>
        <span className="text-[12px] text-[rgba(250,247,242,0.2)]">© 2025 PhotoWall</span>
      </footer>
    </div>
  );
}
