"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/api-fetch";
import type {
  HouseBanner,
  HouseBannerAudience,
  HouseBannerPlacement,
} from "@/types/house-banner";
import {
  HOUSE_BANNER_ASPECT_RATIO,
  HOUSE_BANNER_HEIGHT,
  HOUSE_BANNER_WIDTH,
} from "@/types/house-banner";

const PLACEMENT_OPTIONS: { value: HouseBannerPlacement; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "home", label: "홈" },
  { value: "settings", label: "설정" },
  { value: "walls", label: "벽 목록" },
];

const AUDIENCE_OPTIONS: { value: HouseBannerAudience; label: string }[] = [
  { value: "free", label: "기본(무료)만" },
  { value: "all", label: "모든 유저" },
];

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(size);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽지 못했어요"));
    };
    img.src = url;
  });
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<HouseBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [href, setHref] = useState("/upgrade");
  const [placement, setPlacement] = useState<HouseBannerPlacement>("all");
  const [audience, setAudience] = useState<HouseBannerAudience>("free");
  const [sortOrder, setSortOrder] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageHint, setImageHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/banners");
      if (!res.ok) throw new Error();
      setBanners((await res.json()) as HouseBanner[]);
    } catch {
      setMessage("목록을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = async (file: File | null) => {
    setImageHint(null);
    setImageUrl(null);
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (!file) return;

    try {
      const size = await readImageSize(file);
      if (size.width !== HOUSE_BANNER_WIDTH || size.height !== HOUSE_BANNER_HEIGHT) {
        setImageHint(
          `권장 크기 ${HOUSE_BANNER_WIDTH}×${HOUSE_BANNER_HEIGHT}px (현재 ${size.width}×${size.height}px). 등록은 가능해요.`,
        );
      } else {
        setImageHint(`${size.width}×${size.height}px`);
      }
      setPreviewUrl(URL.createObjectURL(file));

      const form = new FormData();
      form.append("file", file);
      const res = await authFetch("/api/admin/banners/upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "업로드 실패");
      }
      const data = (await res.json()) as { imageUrl: string };
      setImageUrl(data.imageUrl);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "이미지 업로드에 실패했어요");
      setPreviewUrl(null);
      setImageUrl(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) {
      setMessage("배너 이미지를 업로드해 주세요");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          imageUrl,
          href: href.trim() || null,
          placement,
          audience,
          sortOrder,
          startsAt: fromLocalInput(startsAt),
          endsAt: fromLocalInput(endsAt),
        }),
      });
      if (!res.ok) throw new Error();
      setTitle("");
      setStartsAt("");
      setEndsAt("");
      setImageUrl(null);
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setImageHint(null);
      setMessage("광고 배너를 등록했어요");
      await load();
    } catch {
      setMessage("등록에 실패했어요");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: HouseBanner) => {
    if (!item.active && !item.imageUrl) {
      setMessage("이미지가 없는 배너는 켤 수 없어요");
      return;
    }
    try {
      const res = await authFetch(`/api/admin/banners/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setMessage("상태 변경에 실패했어요");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 배너를 삭제할까요?")) return;
    try {
      const res = await authFetch(`/api/admin/banners/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setMessage("삭제에 실패했어요");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">광고 배너</h2>
        <p className="mt-1 text-sm text-muted">
          {HOUSE_BANNER_WIDTH}×{HOUSE_BANNER_HEIGHT}px 이미지로 등록하세요. 홈·설정·벽 목록에
          표시됩니다.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-3 rounded-2xl border border-foreground/10 bg-surface p-4">
        <h3 className="text-sm font-semibold">새 배너</h3>

        <label className="block text-xs text-muted">
          배너 이미지 ({HOUSE_BANNER_WIDTH}×{HOUSE_BANNER_HEIGHT})
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
        </label>
        {imageHint ? <p className="text-[11px] text-muted">{imageHint}</p> : null}
        {(previewUrl || imageUrl) && (
          <div
            className="overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.04]"
            style={{ aspectRatio: HOUSE_BANNER_ASPECT_RATIO }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl || imageUrl || ""}
              alt="미리보기"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="대체 텍스트 / 제목 (선택)"
          className="w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm outline-none focus:border-foreground/25"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted">
            클릭 링크 (선택)
            <input
              type="text"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/upgrade"
              className="mt-1 w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-muted">
            표시 위치
            <select
              value={placement}
              onChange={(e) => setPlacement(e.target.value as HouseBannerPlacement)}
              className="mt-1 w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm"
            >
              {PLACEMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            노출 대상
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as HouseBannerAudience)}
              className="mt-1 w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm"
            >
              {AUDIENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            정렬 (작을수록 위)
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-muted">
            시작 (선택)
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-muted">
            종료 (선택)
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving || !imageUrl}
          className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {saving ? "등록 중..." : "배너 등록"}
        </button>
      </form>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">등록된 배너</h3>
        {loading ? (
          <p className="text-sm text-muted">불러오는 중...</p>
        ) : banners.length === 0 ? (
          <p className="text-sm text-muted">등록된 배너가 없어요</p>
        ) : (
          <ul className="space-y-2">
            {banners.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-surface p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        item.active ? "bg-emerald-100 text-emerald-800" : "bg-foreground/10 text-muted"
                      }`}
                    >
                      {item.active ? "활성" : "비활성"}
                    </span>
                    <span className="text-[10px] text-muted">{item.placement}</span>
                    <span className="text-[10px] text-muted">· {item.audience}</span>
                  </div>
                  {item.imageUrl ? (
                    <div
                      className="overflow-hidden rounded-lg border border-foreground/10"
                      style={{ aspectRatio: HOUSE_BANNER_ASPECT_RATIO, maxWidth: 480 }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt={item.title || "배너"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted">이미지 없음</p>
                  )}
                  {item.title ? <p className="text-sm font-semibold">{item.title}</p> : null}
                  {item.href ? <p className="text-[11px] text-muted">링크 → {item.href}</p> : null}
                  {(item.startsAt || item.endsAt) && (
                    <p className="text-[11px] text-muted">
                      {item.startsAt ? `시작 ${toLocalInput(item.startsAt)}` : ""}
                      {item.startsAt && item.endsAt ? " · " : ""}
                      {item.endsAt ? `종료 ${toLocalInput(item.endsAt)}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleActive(item)}
                    className="rounded-lg bg-foreground/5 px-3 py-1.5 text-xs font-medium hover:bg-foreground/10"
                  >
                    {item.active ? "끄기" : "켜기"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
