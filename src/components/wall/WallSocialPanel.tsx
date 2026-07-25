"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WallLikesSummary } from "@/types/social";
import { getVisitorId } from "@/lib/visitor-id";
import { authFetch } from "@/lib/auth/api-fetch";
import { useAuth } from "@/hooks/useAuth";

interface WallSocialPanelProps {
  wallId: string;
  canGuestbook?: boolean;
  enableLikes?: boolean;
  /** When true, guestbook opens interactive Konva first instead of uploading immediately */
  previewMode?: boolean;
  onEnterInteractive?: () => void;
  onGuestbookAdded?: (canvasJson: object) => void;
}

export default function WallSocialPanel({
  wallId,
  canGuestbook = false,
  enableLikes = true,
  previewMode = false,
  onEnterInteractive,
  onGuestbookAdded,
}: WallSocialPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [likes, setLikes] = useState<WallLikesSummary | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [isSubmittingGuestbook, setIsSubmittingGuestbook] = useState(false);
  const [socialAvailable, setSocialAvailable] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const visitorId = getVisitorId();
  const { user } = useAuth();

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2000);
  }, []);

  useEffect(() => {
    if (!user) return;

    authFetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((profile: { displayName?: string } | null) => {
        if (profile?.displayName) setAuthorName(profile.displayName);
      })
      .catch(() => {});
  }, [user]);

  const loadSocial = useCallback(async () => {
    if (!enableLikes) {
      setSocialAvailable(canGuestbook);
      return;
    }

    try {
      const likesRes = await authFetch(`/api/walls/${wallId}/likes?visitorId=${visitorId}`);
      if (likesRes.status === 503) {
        setSocialAvailable(false);
        return;
      }
      if (likesRes.ok) setLikes((await likesRes.json()) as WallLikesSummary);
      setSocialAvailable(true);
    } catch {
      setSocialAvailable(false);
    }
  }, [wallId, visitorId, enableLikes, canGuestbook]);

  useEffect(() => {
    void loadSocial();
  }, [loadSocial]);

  const handleToggleLike = async () => {
    if (!enableLikes) return;
    if (!user) {
      showMessage("응원하려면 로그인이 필요해요");
      return;
    }

    try {
      const res = await authFetch(`/api/walls/${wallId}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId }),
      });
      if (res.ok) setLikes((await res.json()) as WallLikesSummary);
    } catch {
      showMessage("좋아요에 실패했어요");
    }
  };

  const handleGuestbookPhoto = async (file: File) => {
    if (!user) {
      showMessage("방명록을 남기려면 로그인이 필요해요");
      return;
    }
    if (isSubmittingGuestbook) return;

    setIsSubmittingGuestbook(true);
    try {
      const dimensions = await getImageDimensions(file);
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("authorName", authorName || "익명");
      formData.append("imageWidth", String(dimensions.width));
      formData.append("imageHeight", String(dimensions.height));

      const res = await authFetch(`/api/walls/${wallId}/guestbook`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error();

      const result = (await res.json()) as { canvasJson: object };
      onGuestbookAdded?.(result.canvasJson);
      showMessage("방명록 사진을 붙였어요");
    } catch {
      showMessage("방명록 등록에 실패했어요");
    } finally {
      setIsSubmittingGuestbook(false);
    }
  };

  if (!socialAvailable) return null;
  if (!enableLikes && !canGuestbook) return null;

  const panelLabel =
    enableLikes && canGuestbook ? "응원 & 방명록" : enableLikes ? "응원하기" : "방명록";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-neutral-900 shadow-sm ring-1 ring-black/8 backdrop-blur-sm"
      >
        {likes ? `♥ ${likes.count}` : enableLikes ? "응원하기" : panelLabel}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[70dvh] overflow-y-auto rounded-t-2xl bg-surface text-foreground shadow-xl"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-foreground/8 bg-surface px-5 py-4">
              <h2 className="text-sm font-semibold">{panelLabel}</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-muted hover:bg-foreground/5"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 px-5 py-4">
              {enableLikes && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleToggleLike}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      likes?.likedByMe
                        ? "bg-rose-100 text-rose-600"
                        : "bg-foreground/5 text-foreground hover:bg-foreground/8"
                    }`}
                  >
                    {likes?.likedByMe ? "♥ 응원 중" : "♡ 응원하기"}
                  </button>
                  <span className="text-sm text-muted">{likes?.count ?? 0}명이 응원했어요</span>
                </div>
              )}

              {canGuestbook ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">방명록 사진</h3>
                  <p className="text-xs text-muted">내 네컷사진을 벽에 슬쩍 붙여둘 수 있어요</p>
                  {previewMode ? (
                    <button
                      type="button"
                      onClick={() => onEnterInteractive?.()}
                      className="flex w-full items-center justify-center rounded-xl border border-dashed border-foreground/15 px-4 py-3 text-sm font-medium transition hover:border-foreground/25"
                    >
                      방명록 남기려면 벽 불러오기
                    </button>
                  ) : (
                    <>
                      <input
                        ref={photoInputRef}
                        type="text"
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                        placeholder="닉네임 (선택)"
                        className="w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm outline-none focus:border-foreground/25"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="guestbook-photo"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleGuestbookPhoto(file);
                          e.target.value = "";
                        }}
                      />
                      <label
                        htmlFor="guestbook-photo"
                        className={`flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-foreground/15 px-4 py-3 text-sm font-medium transition hover:border-foreground/25 ${
                          isSubmittingGuestbook ? "opacity-50" : ""
                        }`}
                      >
                        {isSubmittingGuestbook ? "붙이는 중..." : "사진 선택해서 붙이기"}
                      </label>
                    </>
                  )}
                </section>
              ) : null}
            </div>
          </aside>
        </>
      )}

      {message && (
        <div
          className="pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg"
          style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          {message}
        </div>
      )}
    </>
  );
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid image"));
    };
    img.src = url;
  });
}
