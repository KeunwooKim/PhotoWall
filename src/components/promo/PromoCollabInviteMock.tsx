"use client";

import { Gaegu } from "next/font/google";
import Link from "next/link";
import {
  PROMO_COLLAB_FEATURES,
  PROMO_COLLAB_MEMBERS,
  PROMO_INVITE_CODE,
} from "@/components/promo/promo-collab-assets";

const displayFont = Gaegu({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const INVITE_URL = `photowall.kr/invite/${PROMO_INVITE_CODE}`;

/** Static invite / onboarding mock for the lower collab section */
export default function PromoCollabInviteMock() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-[rgba(28,25,23,0.1)] bg-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)] sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[#ff5b8d]">
            공동 벽 초대
          </p>
          <h3 className={`${displayFont.className} mt-1 text-[22px] text-[#1c1917]`}>
            친구를 불러요
          </h3>
        </div>
        <span className="rounded-full bg-[rgba(74,155,131,0.12)] px-2.5 py-1 text-[11px] font-medium text-[#4a9b83]">
          링크 1개로 OK
        </span>
      </div>

      <div className="mt-5 rounded-xl bg-[#faf7f2] p-3 ring-1 ring-[rgba(28,25,23,0.08)]">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[#9b8e82]">
          초대 링크
        </p>
        <p className="mt-1 truncate font-mono text-[13px] text-[#1c1917]">{INVITE_URL}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg bg-[#1c1917] px-3 py-2 text-[12px] font-medium text-white"
            aria-label="초대 링크 복사 (데모)"
          >
            링크 복사
          </button>
          <Link
            href="/wall/edit"
            className="flex-1 rounded-lg bg-[#ff5b8d] px-3 py-2 text-center text-[12px] font-medium text-white"
          >
            벽 만들기
          </Link>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-medium text-[#9b8e82]">멤버 3명</p>
        <ul className="mt-2 space-y-2">
          {PROMO_COLLAB_MEMBERS.map((m) => (
            <li key={m.name} className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{ background: m.color }}
              >
                {m.initial}
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#1c1917]">
                  {m.name}
                  {m.role === "방장" ? (
                    <span className="ml-1.5 text-[11px] font-normal text-[#ff5b8d]">
                      방장
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-[#9b8e82]">
                  {m.role === "방장" ? "벽을 만들고 친구를 초대했어요" : "초대를 수락했어요"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <ul className="mt-5 space-y-2 border-t border-[rgba(28,25,23,0.08)] pt-4">
        {PROMO_COLLAB_FEATURES.slice(0, 4).map((f) => (
          <li key={f.id} className="flex items-center gap-2 text-[12px] text-[#1c1917]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(74,155,131,0.12)] text-[10px] text-[#4a9b83]">
              ✓
            </span>
            <span>
              {f.icon} {f.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
