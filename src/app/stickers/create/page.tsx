"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import {
  STICKER_PACK_MAX_ITEMS,
  STICKER_PACK_MIN_ITEMS,
  type StickerPackItemRow,
  type StickerPackRow,
} from "@/lib/stickers/ugc-types";
import StickerStoreNav from "@/components/stickers/StickerStoreNav";

type StickerPreview = { id: string; name: string; src: string };

export default function StickersCreatePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pack, setPack] = useState<StickerPackRow | null>(null);
  const [items, setItems] = useState<StickerPreview[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/stickers");
  }, [authLoading, user, router]);

  const ensurePack = useCallback(async () => {
    if (pack) return pack;
    const res = await authFetch("/api/sticker-packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || "새 스티커팩", description }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "팩 생성 실패");
    }
    const data = (await res.json()) as { pack: StickerPackRow };
    setPack(data.pack);
    return data.pack;
  }, [pack, name, description]);

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setMessage(null);
    try {
      const current = await ensurePack();
      for (const file of Array.from(files)) {
        if (items.length >= STICKER_PACK_MAX_ITEMS) break;
        const form = new FormData();
        form.set("file", file);
        const res = await authFetch(`/api/sticker-packs/${current.id}/items/upload`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "업로드 실패");
        }
        const data = (await res.json()) as {
          item: StickerPackItemRow;
          sticker: { id: string; name: string; src: string };
        };
        setItems((prev) => [
          ...prev,
          { id: data.item.id, name: data.sticker.name, src: data.sticker.src },
        ]);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    if (!pack) {
      setMessage("먼저 스티커를 올려 주세요");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (name.trim()) {
        await authFetch(`/api/sticker-packs/${pack.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), description }),
        });
      }
      const res = await authFetch(`/api/sticker-packs/${pack.id}/submit`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "제출 실패");
      }
      router.push("/stickers/mine");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="sticker-store-root">
        <StickerStoreNav crumb="팩 만들기" />
        <div className="ss-page">
          <p className="ss-loading">로그인 확인 중…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sticker-store-root">
      <StickerStoreNav crumb="팩 만들기" />
      <div className="ss-page">
        <div className="ss-page-inner">
          <div className="ss-page-hd">
            <h1>스티커팩 만들기</h1>
          </div>
          <p className="ss-page-sub">
            PNG/WebP, 장당 512KB 이하 · {STICKER_PACK_MIN_ITEMS}–{STICKER_PACK_MAX_ITEMS}장 · 제출 후
            관리자 심사
          </p>

          <div className="ss-panel">
            <label className="ss-field">
              <span className="ss-field-label">이름</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="예: 봄나들이"
              />
            </label>
            <label className="ss-field">
              <span className="ss-field-label">설명</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={280}
                placeholder="팩을 소개해 주세요"
              />
            </label>
          </div>

          <div className="ss-panel">
            <label className="ss-upload">
              이미지 추가
              <span>
                {items.length}/{STICKER_PACK_MAX_ITEMS}
              </span>
              <input
                type="file"
                accept="image/png,image/webp"
                multiple
                disabled={busy || items.length >= STICKER_PACK_MAX_ITEMS}
                onChange={(e) => {
                  void onUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {items.length > 0 && (
              <div className="ss-preview-grid">
                {items.map((item) => (
                  <div key={item.id} className="ss-preview-cell" title={item.name}>
                    <img src={item.src} alt={item.name} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {message && <p className="ss-message">{message}</p>}

          <button
            type="button"
            className="ss-primary-btn"
            disabled={busy || items.length < STICKER_PACK_MIN_ITEMS}
            onClick={() => void onSubmit()}
          >
            {busy ? "처리 중…" : "심사 제출"}
          </button>
        </div>
      </div>
    </div>
  );
}
