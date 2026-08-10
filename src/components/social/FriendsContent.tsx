"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Friend, Profile } from "@/types/profile";
import { authFetch } from "@/lib/auth/api-fetch";

export interface FriendsContentProps {
  /** sheet = overlay panel; inline = embedded in profile desktop */
  variant?: "sheet" | "inline";
  /** Hide "내 코드" when profile page already shows it */
  hideMyCode?: boolean;
  onClose?: () => void;
  /** Reload when parent wants refresh (e.g. sheet opens) */
  active?: boolean;
}

export default function FriendsContent({
  variant = "inline",
  hideMyCode = false,
  onClose,
  active = true,
}: FriendsContentProps) {
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
    if (active) void loadData();
  }, [active, loadData]);

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

  const isInline = variant === "inline";

  return (
    <div
      className={
        isInline
          ? "space-y-5"
          : "flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 pb-6"
      }
    >
      {!isInline && (
        <div className="sr-only" aria-live="polite">
          친구
        </div>
      )}

      {isInline && (
        <header className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight">친구</h2>
          <p className="text-xs text-muted">코드로 연결하고 벽을 방문해요</p>
        </header>
      )}

      {!hideMyCode && profile?.friendCode && (
        <section className="space-y-2">
          <h3 className="text-xs font-medium tracking-wide text-muted">내 코드</h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-xl bg-foreground/[0.05] px-4 py-3 text-center font-mono text-sm tracking-[0.2em]">
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
            className="flex-1 rounded-xl bg-foreground/[0.05] px-4 py-3 text-sm uppercase tracking-widest outline-none ring-1 ring-transparent focus:ring-foreground/20"
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
          <p className="rounded-2xl border border-foreground/10 bg-surface px-4 py-6 text-center text-xs text-muted">
            아직 친구가 없어요
          </p>
        )}
        <ul className="overflow-hidden rounded-2xl border border-foreground/10 bg-surface">
          {friends.map((friend, index) => (
            <li
              key={friend.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                index < friends.length - 1 ? "border-b border-foreground/10" : ""
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
                <p className="font-mono text-[11px] tracking-wider text-muted">
                  {friend.friendCode}
                </p>
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

      {message && (
        <div
          className="pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg"
          style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
