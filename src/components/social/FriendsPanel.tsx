"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Friend, Profile } from "@/types/profile";
import { authFetch } from "@/lib/auth/api-fetch";

interface FriendsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FriendsPanel({ isOpen, onClose }: FriendsPanelProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendCode, setFriendCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2000);
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profileRes, friendsRes] = await Promise.all([
        authFetch("/api/profile"),
        authFetch("/api/friends"),
      ]);

      if (profileRes.ok) setProfile((await profileRes.json()) as Profile);
      if (friendsRes.ok) setFriends((await friendsRes.json()) as Friend[]);
    } catch {
      showMessage("친구 목록을 불러오지 못했어요");
    } finally {
      setIsLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const handleCopyCode = async () => {
    if (!profile?.friendCode) return;
    try {
      await navigator.clipboard.writeText(profile.friendCode);
      showMessage("친구 코드가 복사됐어요");
    } catch {
      showMessage("복사에 실패했어요");
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = friendCode.trim();
    if (!code || isAdding) return;

    setIsAdding(true);
    try {
      const res = await authFetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendCode: code }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        showMessage(
          err.error === "Friend code not found"
            ? "친구 코드를 찾을 수 없어요"
            : err.error === "Already friends or failed to add"
              ? "이미 친구이거나 추가할 수 없어요"
              : "친구 추가에 실패했어요",
        );
        return;
      }

      setFriends((await res.json()) as Friend[]);
      setFriendCode("");
      showMessage("친구를 추가했어요");
    } catch {
      showMessage("친구 추가에 실패했어요");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    try {
      const res = await authFetch(`/api/friends/${friendId}`, { method: "DELETE" });
      if (res.ok) {
        setFriends((await res.json()) as Friend[]);
        showMessage("친구를 삭제했어요");
      }
    } catch {
      showMessage("삭제에 실패했어요");
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/25 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="친구"
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl bg-surface text-foreground shadow-2xl transition-transform duration-300 ease-out sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[22rem] sm:max-w-[90vw] sm:rounded-none ${
          isOpen ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full sm:translate-y-0"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-foreground/15 sm:hidden" />

        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4 sm:pt-[max(1rem,env(safe-area-inset-top))]">
          <div>
            <h2 className="text-lg font-bold tracking-tight">친구</h2>
            <p className="mt-0.5 text-xs text-muted">코드로 연결하고 벽을 방문해요</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-foreground/5 hover:text-foreground"
            aria-label="닫기"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-6">
          {profile?.friendCode && (
            <section className="space-y-2">
              <h3 className="text-xs font-medium tracking-wide text-muted">내 코드</h3>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-xl bg-foreground/[0.04] px-4 py-3 text-center font-mono text-sm tracking-[0.2em]">
                  {profile.friendCode}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="rounded-xl bg-foreground px-4 py-3 text-xs font-medium text-background"
                >
                  복사
                </button>
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted">친구 추가</h3>
            <form onSubmit={handleAddFriend} className="flex gap-2">
              <input
                type="text"
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                placeholder="코드 입력"
                maxLength={8}
                className="flex-1 rounded-xl bg-foreground/[0.04] px-4 py-3 text-sm uppercase tracking-widest outline-none ring-1 ring-transparent focus:ring-foreground/15"
              />
              <button
                type="submit"
                disabled={!friendCode.trim() || isAdding}
                className="rounded-xl bg-foreground px-4 py-3 text-xs font-medium text-background disabled:opacity-40"
              >
                {isAdding ? "…" : "추가"}
              </button>
            </form>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted">
              목록{friends.length > 0 ? ` · ${friends.length}` : ""}
            </h3>
            {isLoading && <p className="py-6 text-center text-xs text-muted">불러오는 중...</p>}
            {!isLoading && friends.length === 0 && (
              <p className="rounded-2xl bg-foreground/[0.03] px-4 py-6 text-center text-xs text-muted">
                아직 친구가 없어요
              </p>
            )}
            <ul className="overflow-hidden rounded-2xl bg-foreground/[0.03]">
              {friends.map((friend, index) => (
                <li
                  key={friend.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    index < friends.length - 1 ? "border-b border-foreground/6" : ""
                  }`}
                >
                  {friend.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={friend.avatarUrl}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                      {friend.displayName.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{friend.displayName}</p>
                    <p className="font-mono text-[11px] tracking-wider text-muted">{friend.friendCode}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {friend.wallVisitable && friend.wallId ? (
                      <Link
                        href={`/wall/${friend.wallId}`}
                        onClick={onClose}
                        className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background"
                      >
                        방문
                      </Link>
                    ) : (
                      <span className="px-1 text-[11px] text-muted">
                        {friend.wallId ? "비공개" : "벽 없음"}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveFriend(friend.id)}
                      className="rounded-lg px-2 py-1.5 text-xs text-muted transition hover:bg-red-50 hover:text-red-500"
                      aria-label={`${friend.displayName} 삭제`}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>

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

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
