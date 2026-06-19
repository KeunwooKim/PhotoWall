"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WallComment, WallLikesSummary } from "@/types/social";
import { getVisitorId } from "@/lib/visitor-id";
import { authFetch } from "@/lib/auth/api-fetch";
import { useAuth } from "@/hooks/useAuth";

interface WallSocialPanelProps {
  wallId: string;
  canGuestbook?: boolean;
  onGuestbookAdded?: (canvasJson: object) => void;
}

export default function WallSocialPanel({
  wallId,
  canGuestbook = false,
  onGuestbookAdded,
}: WallSocialPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [likes, setLikes] = useState<WallLikesSummary | null>(null);
  const [comments, setComments] = useState<WallComment[]>([]);
  const [authorName, setAuthorName] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
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
    try {
      const [likesRes, commentsRes] = await Promise.all([
        authFetch(`/api/walls/${wallId}/likes?visitorId=${visitorId}`),
        fetch(`/api/walls/${wallId}/comments`),
      ]);

      if (likesRes.status === 503 || commentsRes.status === 503) {
        setSocialAvailable(false);
        return;
      }

      if (likesRes.ok) setLikes((await likesRes.json()) as WallLikesSummary);
      if (commentsRes.ok) setComments((await commentsRes.json()) as WallComment[]);
    } catch {
      setSocialAvailable(false);
    }
  }, [wallId, visitorId]);

  useEffect(() => {
    loadSocial();
  }, [loadSocial]);

  const handleToggleLike = async () => {
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

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const res = await authFetch(`/api/walls/${wallId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: authorName || "익명", body: commentBody }),
      });
      if (!res.ok) throw new Error();
      const comment = (await res.json()) as WallComment;
      setComments((prev) => [...prev, comment]);
      setCommentBody("");
      showMessage("응원 댓글을 남겼어요");
    } catch {
      showMessage("댓글 등록에 실패했어요");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleGuestbookPhoto = async (file: File) => {
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

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-neutral-900 shadow-sm ring-1 ring-black/8 backdrop-blur-sm"
      >
        {likes ? `♥ ${likes.count}` : "응원하기"}
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
              <h2 className="text-sm font-semibold">응원 & 방명록</h2>
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

              {canGuestbook ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">방명록 사진</h3>
                  <p className="text-xs text-muted">내 네컷사진을 벽에 슬쩍 붙여둘 수 있어요</p>
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
                      if (file) handleGuestbookPhoto(file);
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
                </section>
              ) : (
                <p className="text-xs text-muted">
                  이 벽에는 방명록 사진을 붙일 수 없어요. 응원 댓글은 남길 수 있어요.
                </p>
              )}

              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted">응원 댓글</h3>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {comments.length === 0 && (
                    <p className="text-xs text-muted">첫 응원 댓글을 남겨보세요</p>
                  )}
                  {comments.map((comment) => (
                    <div key={comment.id} className="rounded-xl bg-foreground/5 px-3 py-2">
                      <p className="text-xs font-medium">{comment.authorName}</p>
                      <p className="mt-0.5 text-sm">{comment.body}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSubmitComment} className="space-y-2">
                  <input
                    type="text"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="응원 메시지를 남겨주세요"
                    maxLength={500}
                    className="w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm outline-none focus:border-foreground/25"
                  />
                  <button
                    type="submit"
                    disabled={!commentBody.trim() || isSubmittingComment}
                    className="w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50"
                  >
                    {isSubmittingComment ? "등록 중..." : "댓글 남기기"}
                  </button>
                </form>
              </section>
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
