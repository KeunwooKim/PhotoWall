"use client";

import { useCallback, useEffect, useState } from "react";
import type { Friend } from "@/types/profile";
import type { SharedWall, WallMemberInvite } from "@/types/shared-wall";
import { authFetch } from "@/lib/auth/api-fetch";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

interface SharedWallsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SharedWallsPanel({ isOpen, onClose }: SharedWallsPanelProps) {
  const { flags } = useFeatureFlags();
  const [walls, setWalls] = useState<SharedWall[]>([]);
  const [invites, setInvites] = useState<WallMemberInvite[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [invitingWallId, setInvitingWallId] = useState<string | null>(null);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2000);
  }, []);

  const loadWalls = useCallback(async () => {
    setIsLoading(true);
    try {
      const [wallsRes, friendsRes, invitesRes] = await Promise.all([
        authFetch("/api/shared-walls"),
        authFetch("/api/friends"),
        authFetch("/api/shared-walls/invitations"),
      ]);
      if (wallsRes.ok) setWalls((await wallsRes.json()) as SharedWall[]);
      if (friendsRes.ok) setFriends((await friendsRes.json()) as Friend[]);
      if (invitesRes.ok) setInvites((await invitesRes.json()) as WallMemberInvite[]);
    } catch {
      showMessage("공동 벽 목록을 불러오지 못했어요");
    } finally {
      setIsLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    if (isOpen) loadWalls();
  }, [isOpen, loadWalls]);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;

    setIsCreating(true);
    try {
      const res = await authFetch("/api/shared-walls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || "우리 인생네컷" }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        const detail = err.error ?? "";
        if (detail.includes("create_shared_wall") || detail.includes("does not exist")) {
          showMessage("SQL 마이그레이션 필요: shared-walls-fix.sql 실행");
        } else if (detail.includes("Not authenticated")) {
          showMessage("로그인이 필요해요");
        } else {
          showMessage(detail ? `실패: ${detail}` : "공동 벽 만들기에 실패했어요");
        }
        return;
      }

      const wall = (await res.json()) as SharedWall;
      setWalls((prev) => [wall, ...prev]);
      setTitle("");
      showMessage("공동 벽을 만들었어요");
    } catch {
      showMessage("공동 벽 만들기에 실패했어요");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEditor = (wallId: string) => {
    onClose();
    window.location.href = `/shared/${wallId}`;
  };

  const handleInviteFriend = async (wallId: string, friendId: string) => {
    setInvitingWallId(wallId);
    try {
      const res = await authFetch(`/api/shared-walls/${wallId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });

      if (!res.ok) {
        showMessage("초대에 실패했어요 (이미 초대됐을 수 있어요)");
        return;
      }

      showMessage("초대를 보냈어요. 친구가 수락하면 참여할 수 있어요");
      await loadWalls();
    } catch {
      showMessage("초대에 실패했어요");
    } finally {
      setInvitingWallId(null);
    }
  };

  const handleInviteResponse = async (inviteId: string, action: "accept" | "decline") => {
    setRespondingInviteId(inviteId);
    try {
      const res = await authFetch(`/api/shared-walls/invitations/${inviteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        showMessage(action === "accept" ? "수락에 실패했어요" : "거절에 실패했어요");
        return;
      }

      if (action === "accept") {
        const data = (await res.json()) as { wallId?: string };
        showMessage("공동 벽에 참여했어요");
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
        await loadWalls();
        if (data.wallId) {
          onClose();
          window.location.href = `/shared/${data.wallId}`;
        }
      } else {
        showMessage("초대를 거절했어요");
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      }
    } catch {
      showMessage("처리에 실패했어요");
    } finally {
      setRespondingInviteId(null);
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
        aria-label="공동 벽"
        className={`fixed right-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col bg-surface text-foreground shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between border-b border-foreground/8 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">공동 인생네컷</h2>
            <p className="mt-0.5 text-xs text-muted">친구와 함께 한 벽에 사진을 모아요</p>
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
          {invites.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                받은 초대 ({invites.length})
              </h3>
              <ul className="space-y-2">
                {invites.map((invite) => (
                  <li key={invite.id} className="rounded-xl border border-accent/30 bg-accent/5 p-3">
                    <p className="text-sm font-medium">{invite.wallTitle}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{invite.inviterName}님의 초대</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={respondingInviteId === invite.id}
                        onClick={() => handleInviteResponse(invite.id, "accept")}
                        className="flex-1 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
                      >
                        수락
                      </button>
                      <button
                        type="button"
                        disabled={respondingInviteId === invite.id}
                        onClick={() => handleInviteResponse(invite.id, "decline")}
                        className="rounded-lg bg-foreground/5 px-3 py-1.5 text-xs font-medium hover:bg-foreground/8 disabled:opacity-50"
                      >
                        거절
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">새 공동 벽</h3>
            {!flags.shared_walls ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                공동 벽 기능이 일시적으로 중단되었어요. 기존 벽은 계속 이용할 수 있어요.
              </p>
            ) : (
            <form onSubmit={handleCreate} className="space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="우리 인생네컷"
                maxLength={50}
                className="w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm outline-none focus:border-foreground/25"
              />
              <button
                type="submit"
                disabled={isCreating}
                className="w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50"
              >
                {isCreating ? "만드는 중..." : "공동 벽 만들기"}
              </button>
            </form>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              내 공동 벽{walls.length > 0 && ` (${walls.length})`}
            </h3>
            {isLoading && <p className="text-xs text-muted">불러오는 중...</p>}
            {!isLoading && walls.length === 0 && (
              <p className="text-xs text-muted">아직 공동 벽이 없어요</p>
            )}
            <ul className="space-y-2">
              {walls.map((wall) => (
                <li key={wall.id} className="rounded-xl border border-foreground/8 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{wall.title}</p>
                      <p className="text-[11px] text-muted">
                        {wall.memberCount}명 · {wall.myRole === "owner" ? "방장" : "멤버"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenEditor(wall.id)}
                      className="shrink-0 rounded-lg bg-foreground/5 px-2.5 py-1.5 text-xs font-medium hover:bg-foreground/8"
                    >
                      꾸미기
                    </button>
                  </div>

                  {wall.myRole === "owner" && friends.length > 0 && (
                    <div className="mt-2 border-t border-foreground/8 pt-2">
                      <p className="mb-1.5 text-[11px] text-muted">친구 초대</p>
                      <div className="flex flex-wrap gap-1">
                        {friends.slice(0, 4).map((friend) => (
                          <button
                            key={friend.id}
                            type="button"
                            disabled={invitingWallId === wall.id}
                            onClick={() => handleInviteFriend(wall.id, friend.id)}
                            className="rounded-lg bg-foreground/4 px-2 py-1 text-[11px] hover:bg-foreground/8 disabled:opacity-50"
                          >
                            + {friend.displayName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
