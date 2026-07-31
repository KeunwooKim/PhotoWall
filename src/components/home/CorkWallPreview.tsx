"use client";

import { Caveat } from "next/font/google";

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

interface CorkWallPreviewProps {
  previewUrl?: string | null;
  className?: string;
  /** mobile | desktop sizing */
  size?: "mobile" | "desktop";
}

/** Decorative mono board — mobile mock by default, taller for desktop. */
export default function CorkWallPreview({
  previewUrl,
  className = "",
  size = "mobile",
}: CorkWallPreviewProps) {
  const isDesktop = size === "desktop";

  return (
    <div
      className={`relative w-full overflow-hidden bg-neutral-800 shadow-[inset_0_3px_12px_rgba(0,0,0,0.35),0_8px_32px_rgba(0,0,0,0.18)] dark:bg-neutral-900 ${
        isDesktop ? "h-[460px] rounded-3xl" : "h-[340px] rounded-[28px]"
      } ${className}`}
      style={{
        backgroundImage: `
          repeating-linear-gradient(0deg,rgba(255,255,255,0.04) 0px,rgba(255,255,255,0.04) 1px,transparent 1px,transparent 10px),
          repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0px,rgba(255,255,255,0.04) 1px,transparent 1px,transparent 10px)
        `,
      }}
      aria-hidden
    >
      <Pin color="#f5f5f5" className="left-3.5 top-3.5" />
      <Pin color="#a3a3a3" className="right-3.5 top-3.5" />
      <Pin color="#d4d4d4" className="bottom-3.5 left-3.5" />
      {isDesktop && <Pin color="#737373" className="bottom-3.5 right-3.5" />}

      {previewUrl ? (
        <div className="absolute inset-4 overflow-hidden rounded-2xl bg-white/10 shadow-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
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
                style={{ backgroundImage: "url('/wallpapers/studio-pink.png')" }}
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
                style={{ backgroundImage: "url('/wallpapers/sage-room.png')" }}
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
                style={{ backgroundImage: "url('/wallpapers/cafe-cork.png')" }}
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
