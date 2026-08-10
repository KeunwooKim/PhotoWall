"use client";

import { Caveat } from "next/font/google";

const handwritten = Caveat({
  subsets: ["latin"],
  weight: ["400", "600"],
});

/** Bump when replacing public/promo assets so browsers/CDN skip stale cache. */
const ASSET_V = "20260807d";

/** Same couple, different outfits/moments — trimmed life-4cut strips */
const STRIPS = [
  {
    src: `/promo/strips/strip-cafe-day.webp?v=${ASSET_V}`,
    label: "낮",
    className: "left-[4%] top-[6%] z-[5] w-[17%] -rotate-6 sm:w-[15%]",
    tape: { color: "#F5C5C5", rotate: 8, className: "-top-2 left-[12%]" },
  },
  {
    src: `/promo/strips/strip-evening-date.webp?v=${ASSET_V}`,
    label: "저녁",
    className: "left-[22%] top-[4%] z-[4] w-[17%] rotate-2 sm:w-[15%]",
    tape: { color: "#FAE4B0", rotate: -5, className: "-top-2 left-[18%]" },
  },
  {
    src: `/promo/strips/strip-night-city.webp?v=${ASSET_V}`,
    label: "밤",
    className: "left-[40%] top-[7%] z-[6] w-[17%] rotate-5 sm:w-[15%]",
    tape: { color: "#B5C9B1", rotate: 4, className: "-top-2 left-[16%]" },
  },
  {
    src: `/promo/strips/strip-season-spring.webp?v=${ASSET_V}`,
    label: "봄",
    className: "left-[8%] bottom-[6%] z-[5] w-[15%] -rotate-3 sm:w-[13.5%]",
    tape: { color: "#D4BDE0", rotate: -6, className: "-top-2 left-[22%]" },
  },
  {
    src: `/promo/strips/strip-home-cozy.webp?v=${ASSET_V}`,
    label: "집",
    className: "left-[26%] bottom-[5%] z-[4] w-[15%] rotate-4 sm:w-[13.5%]",
    tape: { color: "#e5e5e5", rotate: 7, className: "-top-2 left-[20%]" },
  },
] as const;

/** Rectangular couple prints for decoration (not 4-cut) */
const PHOTOS = [
  {
    src: `/promo/photos/photo-day.webp?v=${ASSET_V}`,
    label: "스냅 · 낮",
    className: "right-[4%] top-[8%] z-[7] w-[26%] rotate-3 sm:w-[24%]",
    tape: { color: "#F5C5C5", rotate: -4, className: "-top-2 left-[30%]" },
  },
  {
    src: `/promo/photos/photo-evening.webp?v=${ASSET_V}`,
    label: "스냅 · 저녁",
    className: "right-[6%] top-[42%] z-[5] w-[28%] -rotate-4 sm:w-[26%]",
    tape: { color: "#FAE4B0", rotate: 6, className: "-top-2 left-[35%]" },
  },
  {
    src: `/promo/photos/photo-night.webp?v=${ASSET_V}`,
    label: "스냅 · 밤",
    className: "right-[28%] bottom-[6%] z-[6] w-[18%] rotate-6 sm:w-[16%]",
    tape: { color: "#a3a3a3", rotate: -3, className: "-top-2 left-[28%]" },
  },
  {
    src: `/promo/photos/photo-spring.webp?v=${ASSET_V}`,
    label: "스냅 · 봄",
    className: "right-[4%] bottom-[5%] z-[4] w-[20%] -rotate-2 sm:w-[18%]",
    tape: { color: "#B5C9B1", rotate: 5, className: "-top-2 left-[32%]" },
  },
] as const;

function Tape({
  color,
  rotate,
  className = "",
}: {
  color: string;
  rotate: number;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute z-10 h-3.5 w-[48px] rounded-[3px] opacity-90 sm:h-4 sm:w-[52px] ${className}`}
      style={{
        backgroundColor: color,
        transform: `rotate(${rotate}deg)`,
        backgroundImage:
          "repeating-linear-gradient(90deg,transparent,transparent 3px,rgba(255,255,255,0.22) 3px,rgba(255,255,255,0.22) 4px)",
      }}
      aria-hidden
    />
  );
}

function Pin({ color, className = "" }: { color: string; className?: string }) {
  return (
    <div
      className={`absolute z-20 h-3 w-3 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.35)] sm:h-3.5 sm:w-3.5 ${className}`}
      style={{ background: color }}
      aria-hidden
    />
  );
}

interface PromoHeroWallProps {
  className?: string;
}

/** Cork wall: life-4cut strips + rectangular couple prints. */
export default function PromoHeroWall({ className = "" }: PromoHeroWallProps) {
  return (
    <div
      className={`relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-neutral-800 shadow-[inset_0_3px_12px_rgba(0,0,0,0.35),0_20px_50px_rgba(0,0,0,0.22)] dark:bg-neutral-900 ${className}`}
      style={{
        backgroundImage: `
          repeating-linear-gradient(0deg,rgba(255,255,255,0.04) 0px,rgba(255,255,255,0.04) 1px,transparent 1px,transparent 10px),
          repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0px,rgba(255,255,255,0.04) 1px,transparent 1px,transparent 10px)
        `,
      }}
      role="img"
      aria-label="같은 커플의 시간대별 인생네컷과 스냅이 붙은 포토월"
    >
      <Pin color="#f5f5f5" className="left-3 top-3 sm:left-3.5 sm:top-3.5" />
      <Pin color="#a3a3a3" className="right-3 top-3 sm:right-3.5 sm:top-3.5" />
      <Pin color="#d4d4d4" className="bottom-3 left-3 sm:bottom-3.5 sm:left-3.5" />
      <Pin color="#737373" className="bottom-3 right-3 sm:bottom-3.5 sm:right-3.5" />

      {STRIPS.map((strip, i) => (
        <div
          key={strip.src}
          className={`home-float absolute ${strip.className}`}
          style={{ animationDelay: `${i * 0.35}s` }}
        >
          <Tape
            color={strip.tape.color}
            rotate={strip.tape.rotate}
            className={strip.tape.className}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={strip.src}
            alt=""
            className="w-full bg-white object-contain shadow-[2px_4px_14px_rgba(0,0,0,0.4)]"
            draggable={false}
          />
          <span className="sr-only">{strip.label}</span>
        </div>
      ))}

      {PHOTOS.map((photo, i) => (
        <div
          key={photo.src}
          className={`home-float-slow absolute ${photo.className}`}
          style={{ animationDelay: `${0.2 + i * 0.45}s` }}
        >
          <Tape
            color={photo.tape.color}
            rotate={photo.tape.rotate}
            className={photo.tape.className}
          />
          <div className="bg-white p-[5%] pb-[14%] shadow-[2px_4px_14px_rgba(0,0,0,0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.src}
              alt=""
              className="aspect-square w-full object-cover"
              draggable={false}
            />
          </div>
          <span className="sr-only">{photo.label}</span>
        </div>
      ))}

      <div
        className={`${handwritten.className} absolute bottom-2 left-1/2 z-12 -translate-x-1/2 -rotate-[1.5deg] whitespace-nowrap rounded-md bg-white/85 px-3 py-0.5 text-[12px] tracking-wide text-neutral-800 sm:bottom-2.5 sm:text-[14px]`}
      >
        우리의 시간들
      </div>
    </div>
  );
}
