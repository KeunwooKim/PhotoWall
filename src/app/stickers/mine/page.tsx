"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import type { StickerPackRow } from "@/lib/stickers/ugc-types";
import StickerStoreNav from "@/components/stickers/StickerStoreNav";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  pending: "심사 중",
  published: "공개",
  rejected: "거절",
  taken_down: "비공개",
};

export default function StickersMinePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [packs, setPacks] = useState<StickerPackRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/stickers");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const res = await authFetch("/api/sticker-packs");
      if (!res.ok) {
        setMessage("목록을 불러오지 못했어요");
        return;
      }
      const data = (await res.json()) as { packs: StickerPackRow[] };
      setPacks(data.packs ?? []);
    })();
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="sticker-store-root">
        <StickerStoreNav crumb="내 제출함" />
        <div className="ss-page">
          <p className="ss-loading">로그인 확인 중…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sticker-store-root">
      <StickerStoreNav crumb="내 제출함" />
      <div className="ss-page">
        <div className="ss-page-inner">
          <div className="ss-page-hd">
            <h1>내 제출함</h1>
            <Link href="/stickers/create" className="ss-ghost-btn">
              새 팩
            </Link>
          </div>
          <p className="ss-page-sub">초안 · 심사 · 공개 · 거절 상태를 한곳에서 확인해요.</p>

          {message && <p className="ss-message">{message}</p>}

          {packs.length === 0 ? (
            <div className="ss-empty">
              <h3>아직 만든 팩이 없어요</h3>
              <p>첫 커뮤니티 팩을 만들어 보세요.</p>
              <div className="ss-empty-actions">
                <Link href="/stickers/create" className="ss-banner-cta">
                  팩 만들기
                </Link>
              </div>
            </div>
          ) : (
            <ul className="ss-list">
              {packs.map((pack) => (
                <li key={pack.id} className="ss-list-item">
                  <div className="ss-list-row">
                    <Link href={`/stickers/${pack.id}`} className="ss-list-name">
                      {pack.name}
                    </Link>
                    <span className={`ss-status ${pack.status}`}>
                      {STATUS_LABEL[pack.status] ?? pack.status}
                    </span>
                  </div>
                  <p className="ss-list-meta">
                    {pack.sticker_count}장
                    {pack.reject_reason ? ` · ${pack.reject_reason}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
