"use client";

import { useState } from "react";
import PromoFriendsWall from "@/components/promo/PromoFriendsWall";
import PromoHeroWall from "@/components/promo/PromoHeroWall";
import PromoPetsWall from "@/components/promo/PromoPetsWall";

const TABS = [
  { id: "couple", label: "커플 · 우리의 시간", canvas: "canvas-cork" },
  { id: "friends", label: "친구들과의 하루", canvas: "canvas-friends" },
  { id: "pets", label: "반려동물 · 우리 아이", canvas: "canvas-spring" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PromoWallShowcase() {
  const [active, setActive] = useState<TabId>("couple");
  const current = TABS.find((t) => t.id === active)!;

  return (
    <div id="wall" className="overflow-hidden bg-[#1c1917]">
      <div className="mx-auto max-w-[1200px] px-6 py-16 sm:px-16 sm:py-20">
        <p className="promo-reveal text-[11px] font-medium uppercase tracking-[0.2em] text-[#b8e0d2]">
          미리보기
        </p>
        <h2 className="promo-reveal font-[family-name:var(--font-gaegu)] text-[2rem] leading-tight text-[#faf7f2] sm:text-[3rem]">
          이런 벽을 만들 수 있어요
        </h2>
        <p className="promo-reveal mt-4 max-w-md text-base leading-relaxed text-[rgba(250,247,242,0.55)]">
          커플, 친구, 반려동물 — 추억 주제별로 네컷과 스냅을 자유롭게 배치해요.
        </p>
      </div>

      <div className="mx-auto flex max-w-[1200px] gap-0 overflow-x-auto border-b border-[rgba(250,247,242,0.1)] px-6 sm:px-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`shrink-0 border-b-2 px-5 py-3 text-[13px] transition ${
              active === tab.id
                ? "border-[#ff5b8d] text-[#faf7f2]"
                : "border-transparent text-[rgba(250,247,242,0.4)] hover:text-[#faf7f2]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-10 sm:px-16 sm:pb-20 sm:pt-12">
        <div
          className={`promo-landing ${current.canvas} mx-auto max-w-[1200px] overflow-hidden rounded-2xl p-4 sm:p-6`}
        >
          {active === "couple" && <PromoHeroWall className="!shadow-none" />}
          {active === "friends" && <PromoFriendsWall className="!shadow-none" />}
          {active === "pets" && <PromoPetsWall className="!shadow-none" />}
        </div>
      </div>
    </div>
  );
}
