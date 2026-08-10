"use client";

import { Caveat } from "next/font/google";
import { DEFAULT_WALL_THEME_ID, getWallTheme } from "@/lib/wall-themes";
import type { WallThemeId } from "@/types/wall";

const handwritten = Caveat({
  subsets: ["latin"],
  weight: ["400", "600"],
});

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
      className={`pointer-events-none absolute h-4 w-[52px] rounded-[3px] opacity-80 ${className}`}
      style={{
        backgroundColor: color,
        transform: `rotate(${rotate}deg)`,
        backgroundImage:
          "repeating-linear-gradient(90deg,transparent,transparent 3px,rgba(255,255,255,0.18) 3px,rgba(255,255,255,0.18) 4px)",
      }}
      aria-hidden
    />
  );
}

function Pin({ color, className = "" }: { color: string; className?: string }) {
  return (
    <div
      className={`absolute z-20 h-3.5 w-3.5 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.35)] ${className}`}
      style={{ background: color }}
      aria-hidden
    />
  );
}

type CollageSlot = {
  rotate: number;
  float?: "home-float" | "home-float-slow";
  wrap: string;
  tape: { color: string; rotate: number; className: string };
  frame: string;
  img: string;
};

const MOBILE_SLOTS: CollageSlot[] = [
  {
    rotate: -6,
    float: "home-float",
    wrap: "left-[30px] top-[30px] z-[5]",
    tape: { color: "#e5e5e5", rotate: 6, className: "-top-2.5 left-2 z-10" },
    frame: "w-[90px] p-[5px] pb-3.5",
    img: "h-[190px]",
  },
  {
    rotate: 5,
    float: "home-float-slow",
    wrap: "left-[148px] top-[50px] z-[4]",
    tape: { color: "#d4d4d4", rotate: -4, className: "-top-2.5 left-3 z-10" },
    frame: "w-[90px] p-[5px] pb-3.5",
    img: "h-[190px]",
  },
  {
    rotate: -7,
    float: "home-float",
    wrap: "bottom-5 right-[18px] z-[6]",
    tape: { color: "#a3a3a3", rotate: 7, className: "-top-2.5 left-[22px] z-10" },
    frame: "w-[108px] p-[5px] pb-6",
    img: "h-20",
  },
];

const DESKTOP_SLOTS: CollageSlot[] = [
  {
    rotate: -6,
    float: "home-float",
    wrap: "left-12 top-10 z-[5]",
    tape: { color: "#e5e5e5", rotate: 6, className: "-top-2.5 left-2 z-10" },
    frame: "w-[128px] p-1.5 pb-4",
    img: "h-[280px]",
  },
  {
    rotate: 5,
    float: "home-float-slow",
    wrap: "left-56 top-16 z-[4]",
    tape: { color: "#d4d4d4", rotate: -4, className: "-top-2.5 left-3 z-10" },
    frame: "w-[128px] p-1.5 pb-4",
    img: "h-[280px]",
  },
  {
    rotate: -7,
    float: "home-float",
    wrap: "bottom-8 right-10 z-[6]",
    tape: { color: "#a3a3a3", rotate: 7, className: "-top-2.5 left-[22px] z-10" },
    frame: "w-40 p-1.5 pb-8",
    img: "h-[110px]",
  },
  {
    rotate: 3,
    wrap: "right-14 top-28 z-[7]",
    tape: { color: "#d4d4d4", rotate: -3, className: "-top-2.5 left-4 z-10 w-[50px]" },
    frame: "w-[112px] p-1.5 pb-5",
    img: "h-[140px]",
  },
];

interface CorkWallPreviewProps {
  /** Signed photo URLs from the user's wall (newest / top z first). */
  photos?: string[];
  /** Current wall wallpaper theme — board background follows this. */
  themeId?: WallThemeId | string | null;
  className?: string;
  size?: "mobile" | "desktop";
}

/** Wall hero board — real photos as a polaroid collage on the user's wallpaper. */
export default function CorkWallPreview({
  photos = [],
  themeId = null,
  className = "",
  size = "mobile",
}: CorkWallPreviewProps) {
  const isDesktop = size === "desktop";
  const slots = isDesktop ? DESKTOP_SLOTS : MOBILE_SLOTS;
  const live = photos.filter(Boolean).slice(0, slots.length);
  const hasLive = live.length > 0;
  const theme = getWallTheme(themeId ?? DEFAULT_WALL_THEME_ID);

  return (
    <div
      className={`relative w-full overflow-hidden shadow-[inset_0_3px_12px_rgba(0,0,0,0.35),0_8px_32px_rgba(0,0,0,0.18)] ${
        isDesktop ? "h-[460px] rounded-3xl" : "h-[340px] rounded-[28px]"
      } ${className}`}
      style={{
        backgroundColor: "#2a2a2a",
        backgroundImage: `linear-gradient(rgba(0,0,0,0.12), rgba(0,0,0,0.18)), ${theme.background}`,
        // Smaller tiles than the editor wall so the pattern reads on this hero board
        backgroundSize: isDesktop ? "320px auto" : "240px auto",
        backgroundPosition: "0 0",
        backgroundRepeat: "repeat",
      }}
      aria-hidden
    >
      <Pin color="#f5f5f5" className="left-3.5 top-3.5" />
      <Pin color="#a3a3a3" className="right-3.5 top-3.5" />
      <Pin color="#d4d4d4" className="bottom-3.5 left-3.5" />
      {isDesktop && <Pin color="#737373" className="bottom-3.5 right-3.5" />}

      {hasLive
        ? live.map((src, i) => {
            const slot = slots[i]!;
            return (
              <div
                key={`${src}-${i}`}
                className={`absolute ${slot.float ?? ""} ${slot.wrap}`}
                style={{ transform: `rotate(${slot.rotate}deg)` }}
              >
                <Tape
                  color={slot.tape.color}
                  rotate={slot.tape.rotate}
                  className={slot.tape.className}
                />
                <div
                  className={`bg-white shadow-[2px_4px_14px_rgba(0,0,0,0.35)] ${slot.frame}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className={`w-full object-cover ${slot.img}`}
                    draggable={false}
                  />
                </div>
              </div>
            );
          })
        : (
          <>
            <div
              className={`home-float absolute z-[5] -rotate-6 ${
                isDesktop ? "left-12 top-10" : "left-[30px] top-[30px]"
              }`}
            >
              <Tape color="#e5e5e5" rotate={6} className="-top-2.5 left-2 z-10" />
              <div
                className={`bg-white shadow-[2px_4px_14px_rgba(0,0,0,0.35)] ${
                  isDesktop ? "w-[128px] p-1.5 pb-4" : "w-[90px] p-[5px] pb-3.5"
                }`}
              >
                <div
                  className={`w-full bg-neutral-200 bg-cover bg-center ${isDesktop ? "h-[280px]" : "h-[190px]"}`}
                  style={{ backgroundImage: "url('/wallpapers/white-brick.png')" }}
                />
                <p className={`${handwritten.className} mt-1 text-center text-[9px] text-neutral-500`}>
                  네컷 스트립
                </p>
              </div>
            </div>

            <div
              className={`home-float-slow absolute z-[4] rotate-5 ${
                isDesktop ? "left-56 top-16" : "left-[148px] top-[50px]"
              }`}
            >
              <Tape color="#d4d4d4" rotate={-4} className="-top-2.5 left-3 z-10" />
              <div
                className={`bg-white shadow-[2px_4px_14px_rgba(0,0,0,0.35)] ${
                  isDesktop ? "w-[128px] p-1.5 pb-4" : "w-[90px] p-[5px] pb-3.5"
                }`}
              >
                <div
                  className={`w-full bg-neutral-300 bg-cover bg-center grayscale ${isDesktop ? "h-[280px]" : "h-[190px]"}`}
                  style={{ backgroundImage: "url('/wallpapers/red-brick.png')" }}
                />
                <p className={`${handwritten.className} mt-1 text-center text-[9px] text-neutral-500`}>
                  주말 나들이
                </p>
              </div>
            </div>

            <div
              className={`home-float absolute z-[6] -rotate-7 ${
                isDesktop ? "bottom-8 right-10" : "bottom-5 right-[18px]"
              }`}
            >
              <Tape color="#a3a3a3" rotate={7} className="-top-2.5 left-[22px] z-10" />
              <div
                className={`bg-white shadow-[2px_4px_14px_rgba(0,0,0,0.35)] ${
                  isDesktop ? "w-40 p-1.5 pb-8" : "w-[108px] p-[5px] pb-6"
                }`}
              >
                <div
                  className={`w-full bg-neutral-400 bg-cover bg-center grayscale ${isDesktop ? "h-[110px]" : "h-20"}`}
                  style={{ backgroundImage: "url('/wallpapers/cork-board.png')" }}
                />
                <p className={`${handwritten.className} mt-1.5 text-center text-[9.5px] text-neutral-500`}>
                  여름 추억
                </p>
              </div>
            </div>

            {isDesktop && (
              <div className="absolute right-11 top-12 z-[7] w-[130px] rotate-3 bg-white px-3.5 py-3 shadow-[2px_4px_14px_rgba(0,0,0,0.25)]">
                <Tape color="#d4d4d4" rotate={-3} className="-top-2.5 left-7 z-10 w-[50px]" />
                <p className={`${handwritten.className} text-[12.5px] leading-relaxed text-neutral-700`}>
                  네컷을 벽에
                  <br />
                  붙이듯 꾸며보세요
                </p>
              </div>
            )}
          </>
        )}

      <div
        className={`${handwritten.className} absolute bottom-2.5 left-1/2 z-12 -translate-x-1/2 -rotate-[1.5deg] whitespace-nowrap rounded-md bg-white/80 px-3 py-0.5 tracking-wide text-neutral-800 ${
          isDesktop ? "text-[15px]" : "text-[12.5px]"
        }`}
      >
        나만의 포토월
      </div>
    </div>
  );
}
