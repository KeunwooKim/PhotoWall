"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import { useUgcStickerLibrary } from "@/hooks/useUgcStickerLibrary";
import {
  getFirstPartyPackStickers,
  getFirstPartyStorePackById,
  isFirstPartyPackId,
} from "@/lib/stickers/first-party-store";
import type { StickerPackRow } from "@/lib/stickers/ugc-types";
import StickerStoreNav from "@/components/stickers/StickerStoreNav";

type DetailSticker = { id: string; name: string; src: string };

export default function StickerPackDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { user } = useAuth();
  const { refresh } = useUgcStickerLibrary();
  const [pack, setPack] = useState<StickerPackRow | null>(null);
  const [stickers, setStickers] = useState<DetailSticker[]>([]);
  const [installed, setInstalled] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isOfficial, setIsOfficial] = useState(false);
  const [officialName, setOfficialName] = useState("");
  const [officialDesc, setOfficialDesc] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    if (isFirstPartyPackId(id)) {
      const official = getFirstPartyStorePackById(id);
      const items = getFirstPartyPackStickers(id);
      setIsOfficial(true);
      setOfficialName(official?.name ?? id);
      setOfficialDesc(official?.description ?? "");
      setStickers(items.map((s) => ({ id: s.id, name: s.name, src: s.src })));
      setInstalled(true);
      setPack(null);
      setLoading(false);
      return;
    }

    setIsOfficial(false);
    const res = await authFetch(`/api/sticker-packs/${id}`);
    if (!res.ok) {
      setMessage("팩을 찾을 수 없어요");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as {
      pack: StickerPackRow;
      stickers: DetailSticker[];
      installed: boolean;
      isOwner: boolean;
    };
    setPack(data.pack);
    setStickers(data.stickers ?? []);
    setInstalled(!!data.installed);
    setIsOwner(!!data.isOwner);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleInstall = async () => {
    if (isOfficial) return;
    if (!user || !pack || pack.status !== "published") {
      setMessage("로그인 후 공개 팩을 설치할 수 있어요");
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch(`/api/sticker-packs/${pack.id}/install`, {
        method: installed ? "DELETE" : "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "실패");
      }
      setInstalled(!installed);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  const title = isOfficial ? officialName : pack?.name ?? "스티커 팩";
  const description = isOfficial ? officialDesc : pack?.description || "설명 없음";

  return (
    <div className="sticker-store-root">
      <StickerStoreNav crumb={title} />
      <div className="ss-page">
        <div className="ss-page-inner">
          <Link href="/stickers" className="ss-list-meta" style={{ display: "inline-block", marginBottom: 12 }}>
            ← 스토어
          </Link>

          {loading ? (
            <p className="ss-loading">불러오는 중…</p>
          ) : !isOfficial && !pack ? (
            <p className="ss-message">{message ?? "팩을 찾을 수 없어요"}</p>
          ) : (
            <>
              <div className="ss-page-hd">
                <h1>{title}</h1>
                <span className={`ss-status ${isOfficial ? "published" : pack?.status ?? ""}`}>
                  {isOfficial
                    ? "공식"
                    : pack?.status === "published"
                      ? "공개"
                      : pack?.status === "pending"
                        ? "심사 중"
                        : pack?.status === "rejected"
                          ? "거절"
                          : pack?.status === "draft"
                            ? "초안"
                            : pack?.status}
                </span>
              </div>
              <p className="ss-page-sub">{description}</p>
              <p className="ss-list-meta" style={{ marginBottom: 8 }}>
                {stickers.length}장
                {!isOfficial && pack?.reject_reason ? ` · ${pack.reject_reason}` : ""}
                {isOfficial ? " · 기본 제공" : ""}
              </p>

              <div className="ss-detail-grid">
                {stickers.map((s) => (
                  <div key={s.id} className="ss-preview-cell" title={s.name}>
                    <img src={s.src} alt={s.name} />
                  </div>
                ))}
              </div>

              {isOfficial ? (
                <Link href="/wall/edit" className="ss-primary-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                  벽 에디터에서 쓰기
                </Link>
              ) : pack?.status === "published" ? (
                <button
                  type="button"
                  className="ss-primary-btn"
                  disabled={busy}
                  onClick={() => void toggleInstall()}
                >
                  {installed ? "설치 해제" : "라이브러리에 추가"}
                </button>
              ) : null}

              {isOwner && (
                <Link href="/stickers/mine" className="ss-list-meta" style={{ display: "block", textAlign: "center", marginTop: 14 }}>
                  내 제출함
                </Link>
              )}
              {message && <p className="ss-message">{message}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
