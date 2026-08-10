"use client";

import { useEffect, useState } from "react";
import { Gaegu } from "next/font/google";

const displayFont = Gaegu({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const ASSET_V = "20260807i";

const MEMBERS = [
  { name: "민지", color: "#FF5B8D", initial: "민" },
  { name: "하은", color: "#4A9B83", initial: "하" },
  { name: "수연", color: "#7C6BB0", initial: "수" },
] as const;

const PHOTOS = [
  {
    src: `/promo/friends/strips/strip-day.webp?v=${ASSET_V}`,
    top: "8%",
    left: "6%",
    w: "18%",
    rotate: -6,
    tape: "#FFE082",
  },
  {
    src: `/promo/friends/photos/photo-cafe.webp?v=${ASSET_V}`,
    top: "10%",
    left: "28%",
    w: "26%",
    rotate: 3,
    tape: "#B2DFDB",
  },
  {
    src: `/promo/friends/strips/strip-evening.webp?v=${ASSET_V}`,
    top: "6%",
    left: "58%",
    w: "17%",
    rotate: 5,
    tape: "#FFCCBC",
  },
  {
    src: `/promo/friends/photos/photo-park.webp?v=${ASSET_V}`,
    top: "48%",
    left: "10%",
    w: "24%",
    rotate: -3,
    tape: "#FFB3C6",
  },
  {
    src: `/promo/friends/photos/photo-spring.webp?v=${ASSET_V}`,
    top: "46%",
    left: "42%",
    w: "22%",
    rotate: 4,
    tape: "#FFE082",
  },
  {
    src: `/promo/friends/strips/strip-night.webp?v=${ASSET_V}`,
    top: "42%",
    left: "70%",
    w: "16%",
    rotate: -5,
    tape: "#C5B4E3",
  },
] as const;

const ACTIVITY = [
  { who: "민지", color: "#FF5B8D", text: "네컷 스트립을 붙였어요" },
  { who: "하은", color: "#4A9B83", text: "카페 스냅을 올렸어요" },
  { who: "수연", color: "#7C6BB0", text: "스티커를 추가했어요" },
  { who: "민지", color: "#FF5B8D", text: "사진을 조금 돌렸어요" },
] as const;

const CURSORS = [
  { name: "민지", color: "#FF5B8D", className: "promo-collab-cursor-a" },
  { name: "하은", color: "#4A9B83", className: "promo-collab-cursor-b" },
  { name: "수연", color: "#7C6BB0", className: "promo-collab-cursor-c" },
] as const;

export default function PromoCollabDemo() {
  const [activityIdx, setActivityIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActivityIdx((i) => (i + 1) % ACTIVITY.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, []);

  const toast = ACTIVITY[activityIdx];

  return (
    <div className="relative w-full">
      {/* Presence bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {MEMBERS.map((m) => (
              <div
                key={m.name}
                className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#f5f1eb] text-[12px] font-bold text-white"
                style={{ background: m.color }}
                title={m.name}
              >
                {m.initial}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#f5f1eb] bg-[#4a9b83]" />
              </div>
            ))}
          </div>
          <p className={`${displayFont.className} text-[14px] text-[#1c1917]`}>
            민지 · 하은 · 수연{" "}
            <span className="text-[#9b8e82]">함께 편집 중</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium text-[#4a9b83] ring-1 ring-[rgba(74,155,131,0.25)]">
          <span className="promo-collab-pulse h-1.5 w-1.5 rounded-full bg-[#4a9b83]" />
          실시간 동기화
        </span>
      </div>

      {/* Shared wall canvas */}
      <div className="promo-collab-board relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.12)]">
        {PHOTOS.map((photo, i) => (
          <div
            key={photo.src}
            className="absolute"
            style={{
              top: photo.top,
              left: photo.left,
              width: photo.w,
              transform: `rotate(${photo.rotate}deg)`,
              zIndex: i + 1,
            }}
          >
            <div
              className="promo-collab-photo relative bg-white p-[3%] pb-[10%] shadow-[2px_4px_14px_rgba(0,0,0,0.2)]"
              style={{ animationDelay: `${0.15 + i * 0.12}s` }}
            >
              <div
                className="promo-tape"
                style={{ width: 40, backgroundColor: photo.tape }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.src}
                alt=""
                className="block w-full object-cover"
                style={{
                  aspectRatio: photo.src.includes("strip") ? "1 / 2.4" : "1",
                }}
                draggable={false}
              />
            </div>
          </div>
        ))}

        {/* Live cursors */}
        {CURSORS.map((c) => (
          <div
            key={c.name}
            className={`pointer-events-none absolute z-20 ${c.className}`}
            aria-hidden
          >
            <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
              <path
                d="M1 1L16.5 10.2L9.2 11.6L6.4 20.5L1 1Z"
                fill={c.color}
                stroke="#fff"
                strokeWidth="1.2"
              />
            </svg>
            <span
              className={`${displayFont.className} ml-3 -mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] text-white shadow-sm`}
              style={{ background: c.color }}
            >
              {c.name}
            </span>
          </div>
        ))}

        {/* Activity toast */}
        <div
          key={activityIdx}
          className="promo-collab-toast absolute bottom-3 left-3 right-3 z-30 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.12)] sm:right-auto sm:max-w-[280px]"
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: toast.color }}
          >
            {toast.who[0]}
          </div>
          <p className="text-[12px] leading-snug text-[#1c1917]">
            <span className="font-semibold">{toast.who}</span>
            <span className="text-[#9b8e82]"> · {toast.text}</span>
          </p>
        </div>

        <p
          className={`${displayFont.className} pointer-events-none absolute right-3 top-3 text-[13px] text-[rgba(90,50,10,0.35)] -rotate-2`}
        >
          우리들의 공동 벽 ✦
        </p>
      </div>
    </div>
  );
}
