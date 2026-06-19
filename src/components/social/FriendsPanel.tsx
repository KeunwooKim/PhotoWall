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
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="친구 목록"
        className={`fixed right-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col bg-surface text-foreground shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between border-b border-foreground/8 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">친구</h2>
            <p className="mt-0.5 text-xs text-muted">코드로 친구를 추가하고 벽을 방문해요</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-foreground/5 hover:text-foreground"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
          {profile && (
            <section className="space-y-2 rounded-xl bg-foreground/5 p-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">내 친구 코드</h3>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-background px-3 py-2 text-sm font-mono tracking-widest ring-1 ring-foreground/10">
                  {profile.friendCode}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background"
                >
                  복사
                </button>
              </div>
              <p className="text-[11px] text-muted">친구에게 이 코드를 공유하면 서로 연결돼요</p>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">친구 추가</h3>
            <form onSubmit={handleAddFriend} className="flex gap-2">
              <input
                type="text"
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                placeholder="친구 코드 입력"
                maxLength={8}
                className="flex-1 rounded-xl border border-foreground/10 px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-foreground/25"
              />
              <button
                type="submit"
                disabled={!friendCode.trim() || isAdding}
                className="rounded-xl bg-foreground px-4 py-2 text-xs font-medium text-background disabled:opacity-50"
              >
                {isAdding ? "..." : "추가"}
              </button>
            </form>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              친구 목록 {friends.length > 0 && `(${friends.length})`}
            </h3>
            {isLoading && <p className="text-xs text-muted">불러오는 중...</p>}
            {!isLoading && friends.length === 0 && (
              <p className="text-xs text-muted">아직 친구가 없어요. 코드를 공유해 보세요</p>
            )}
            <ul className="space-y-2">
              {friends.map((friend) => (
                <li
                  key={friend.id}
                  className="flex items-center gap-3 rounded-xl border border-foreground/8 px-3 py-2.5"
                >
                  {friend.avatarUrl ? (
                    <img
                      src={friend.avatarUrl}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover ring-1 ring-black/8"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/6 text-sm">
                      {friend.displayName.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{friend.displayName}</p>
                    <p className="text-[11px] text-muted">{friend.friendCode}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {friend.wallVisitable && friend.wallId ? (
                      <Link
                        href={`/wall/${friend.wallId}`}
                        onClick={onClose}
                        className="rounded-lg bg-foreground/5 px-2.5 py-1.5 text-xs font-medium hover:bg-foreground/8"
                      >
                        벽 방문
                      </Link>
                    ) : friend.wallId ? (
                      <span className="rounded-lg px-2.5 py-1.5 text-[11px] text-muted">벽 비공개</span>
                    ) : (
                      <span className="rounded-lg px-2.5 py-1.5 text-[11px] text-muted">벽 없음</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveFriend(friend.id)}
                      className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-red-50 hover:text-red-500"
                      aria-label={`${friend.displayName} 삭제`}
                    >
                      ✕
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
