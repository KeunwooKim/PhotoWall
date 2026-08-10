"use client";

import { Gaegu } from "next/font/google";

const displayFont = Gaegu({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const ASSET_V = "20260807i";

/** Scattered collage for hero — real promo assets */
const COLLAGE = [
  {
    src: `/promo/strips/strip-cafe-day.webp?v=${ASSET_V}`,
    label: "낮 카페",
    w: 118,
    top: 18,
    left: 38,
    rotate: -7,
    z: 4,
    tape: "#FFE082",
    pin: null,
  },
  {
    src: `/promo/photos/photo-day.webp?v=${ASSET_V}`,
    label: "놀이공원",
    w: 134,
    top: 8,
    left: 170,
    rotate: 3.5,
    z: 6,
    tape: null,
    pin: "#FF5B8D",
  },
  {
    src: `/promo/strips/strip-evening-date.webp?v=${ASSET_V}`,
    label: "네컷",
    w: 96,
    top: 22,
    left: 322,
    rotate: -4,
    z: 3,
    tape: "#B2DFDB",
    pin: null,
  },
  {
    src: `/promo/photos/photo-evening.webp?v=${ASSET_V}`,
    label: "저녁 데이트",
    w: 122,
    top: 36,
    left: 430,
    rotate: 6,
    z: 5,
    tape: "#FFCCBC",
    pin: null,
  },
  {
    src: `/promo/strips/strip-season-spring.webp?v=${ASSET_V}`,
    label: "봄 산책",
    w: 108,
    top: 202,
    left: 22,
    rotate: 5,
    z: 7,
    tape: null,
    pin: "#C5B4E3",
  },
  {
    src: `/promo/photos/photo-spring.webp?v=${ASSET_V}`,
    label: "벚꽃",
    w: 130,
    top: 190,
    left: 148,
    rotate: -2,
    z: 8,
    tape: "#FFB3C6",
    pin: null,
  },
  {
    src: `/promo/friends/strips/strip-day.webp?v=${ASSET_V}`,
    label: "친구 네컷",
    w: 120,
    top: 200,
    left: 300,
    rotate: 5,
    z: 5,
    tape: "#B2DFDB",
    pin: null,
  },
  {
    src: `/promo/pets/photos/photo-park.webp?v=${ASSET_V}`,
    label: "산책",
    w: 110,
    top: 200,
    left: 430,
    rotate: -5,
    z: 4,
    tape: null,
    pin: "#FFD166",
  },
  {
    src: `/promo/strips/strip-night-city.webp?v=${ASSET_V}`,
    label: "밤",
    w: 118,
    top: 390,
    left: 60,
    rotate: -4,
    z: 6,
    tape: "#FFE082",
    pin: null,
  },
  {
    src: `/promo/photos/photo-night.webp?v=${ASSET_V}`,
    label: "야경",
    w: 126,
    top: 380,
    left: 198,
    rotate: 3,
    z: 5,
    tape: null,
    pin: "#FF5B8D",
  },
  {
    src: `/promo/pets/strips/strip-day.webp?v=${ASSET_V}`,
    label: "우리 아이",
    w: 104,
    top: 392,
    left: 342,
    rotate: -6,
    z: 4,
    tape: "#FFCCBC",
    pin: null,
  },
] as const;

export default function PromoHeroCollage() {
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-[460px] sm:h-[520px]">
      {COLLAGE.map((item) => (
        <div
          key={item.label}
          className="absolute cursor-default bg-white shadow-[2px_4px_16px_rgba(0,0,0,0.14)] transition hover:z-20 hover:scale-105 hover:shadow-[4px_8px_28px_rgba(0,0,0,0.2)]"
          style={{
            width: item.w,
            top: item.top * 0.82,
            left: `${(item.left / 560) * 100}%`,
            transform: `rotate(${item.rotate}deg)`,
            zIndex: item.z,
          }}
        >
          {item.tape ? (
            <div
              className="promo-tape"
              style={{ width: 48, backgroundColor: item.tape }}
            />
          ) : null}
          {item.pin ? (
            <div className="promo-pin" style={{ background: item.pin }} />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.src}
            alt=""
            className="block w-full object-cover"
            style={{ height: item.w * 0.95 }}
            draggable={false}
          />
          <p
            className={`${displayFont.className} truncate px-2 py-1.5 text-center text-[12px] text-[#888]`}
          >
            {item.label}
          </p>
        </div>
      ))}
      <p
        className={`${displayFont.className} pointer-events-none absolute bottom-2 right-0 text-[16px] text-[rgba(100,70,40,0.35)] -rotate-3`}
      >
        내 방 🏠 ✦
      </p>
    </div>
  );
}
