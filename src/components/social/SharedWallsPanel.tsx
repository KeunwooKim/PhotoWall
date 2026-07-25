"use client";

import { useCallback, useEffect, useState } from "react";
import type { Friend } from "@/types/profile";
import type { SharedWall, SharedWallMember, WallMemberInvite } from "@/types/shared-wall";
import { authFetch } from "@/lib/auth/api-fetch";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

interface SharedWallsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SharedWallsPanel({ isOpen, onClose }: SharedWallsPanelProps) {
  const { user } = useAuth();
  const { flags } = useFeatureFlags();
  const [walls, setWalls] = useState<SharedWall[]>([]);
  const [invites, setInvites] = useState<WallMemberInvite[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [invitingWallId, setInvitingWallId] = useState<string | null>(null);
  const [invitePickerWallId, setInvitePickerWallId] = useState<string | null>(null);
  const [membersPanelWallId, setMembersPanelWallId] = useState<string | null>(null);
  const [membersByWall, setMembersByWall] = useState<Record<string, SharedWallMember[]>>({});
  const [loadingMembersWallId, setLoadingMembersWallId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
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
    if (!isOpen) {
      setInvitePickerWallId(null);
      setMembersPanelWallId(null);
      return;
    }

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

  const loadMembers = useCallback(
    async (wallId: string) => {
      setLoadingMembersWallId(wallId);
      try {
        const res = await authFetch(`/api/shared-walls/${wallId}/members`);
        if (!res.ok) {
          showMessage("멤버 목록을 불러오지 못했어요");
          return;
        }
        const members = (await res.json()) as SharedWallMember[];
        setMembersByWall((prev) => ({ ...prev, [wallId]: members }));
      } catch {
        showMessage("멤버 목록을 불러오지 못했어요");
      } finally {
        setLoadingMembersWallId(null);
      }
    },
    [showMessage],
  );

  const toggleMembersPanel = useCallback(
    (wallId: string) => {
      setInvitePickerWallId(null);
      setMembersPanelWallId((id) => {
        const next = id === wallId ? null : wallId;
        if (next) void loadMembers(next);
        return next;
      });
    },
    [loadMembers],
  );

  const handleRemoveMember = async (wallId: string, targetUserId: string, isSelf: boolean) => {
    if (removingUserId) return;
    setRemovingUserId(targetUserId);
    try {
      const res = await authFetch(`/api/shared-walls/${wallId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      });

      if (!res.ok) {
        showMessage(isSelf ? "나가기에 실패했어요" : "멤버 제거에 실패했어요");
        return;
      }

      if (isSelf) {
        showMessage("공동 벽에서 나갔어요");
        setMembersPanelWallId(null);
        setWalls((prev) => prev.filter((w) => w.id !== wallId));
        return;
      }

      const members = (await res.json()) as SharedWallMember[];
      setMembersByWall((prev) => ({ ...prev, [wallId]: members }));
      setWalls((prev) =>
        prev.map((w) => (w.id === wallId ? { ...w, memberCount: members.length } : w)),
      );
      showMessage("멤버를 내보냈어요");
    } catch {
      showMessage(isSelf ? "나가기에 실패했어요" : "멤버 제거에 실패했어요");
    } finally {
      setRemovingUserId(null);
    }
  };

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

      showMessage("초대를 보냈어요");
      setInvitePickerWallId(null);
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
        className={`fixed inset-0 z-40 bg-black/25 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="공동 벽"
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl bg-surface text-foreground shadow-2xl transition-transform duration-300 ease-out sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[22rem] sm:max-w-[90vw] sm:rounded-none ${
          isOpen ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full sm:translate-y-0"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-foreground/15 sm:hidden" />

        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4 sm:pt-[max(1rem,env(safe-area-inset-top))]">
          <div>
            <h2 className="text-lg font-bold tracking-tight">공동 벽</h2>
            <p className="mt-0.5 text-xs text-muted">친구와 한 벽에 네컷을 모아요</p>
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
          {invites.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-medium tracking-wide text-muted">
                받은 초대 · {invites.length}
              </h3>
              <ul className="space-y-2">
                {invites.map((invite) => (
                  <li key={invite.id} className="rounded-2xl bg-foreground/[0.04] px-4 py-3">
                    <p className="text-sm font-semibold">{invite.wallTitle}</p>
                    <p className="mt-0.5 text-xs text-muted">{invite.inviterName}님의 초대</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={respondingInviteId === invite.id}
                        onClick={() => handleInviteResponse(invite.id, "accept")}
                        className="flex-1 rounded-xl bg-foreground py-2 text-xs font-medium text-background disabled:opacity-50"
                      >
                        수락
                      </button>
                      <button
                        type="button"
                        disabled={respondingInviteId === invite.id}
                        onClick={() => handleInviteResponse(invite.id, "decline")}
                        className="rounded-xl bg-foreground/[0.06] px-4 py-2 text-xs font-medium disabled:opacity-50"
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
            <h3 className="text-xs font-medium tracking-wide text-muted">새 벽 만들기</h3>
            {!flags.shared_walls ? (
              <p className="rounded-2xl bg-foreground/[0.03] px-4 py-3 text-xs text-muted">
                공동 벽 생성이 잠시 중단되었어요. 기존 벽은 계속 쓸 수 있어요.
              </p>
            ) : (
              <form onSubmit={handleCreate} className="space-y-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="우리 인생네컷"
                  maxLength={50}
                  className="w-full rounded-xl bg-foreground/[0.04] px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-foreground/15"
                />
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-50"
                >
                  {isCreating ? "만드는 중..." : "만들기"}
                </button>
              </form>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted">
              내 공동 벽{walls.length > 0 ? ` · ${walls.length}` : ""}
            </h3>
            {isLoading && <p className="py-6 text-center text-xs text-muted">불러오는 중...</p>}
            {!isLoading && walls.length === 0 && (
              <p className="rounded-2xl bg-foreground/[0.03] px-4 py-6 text-center text-xs text-muted">
                아직 공동 벽이 없어요
              </p>
            )}
            <ul className="overflow-hidden rounded-2xl bg-foreground/[0.03]">
              {walls.map((wall, index) => (
                <li
                  key={wall.id}
                  className={index < walls.length - 1 ? "border-b border-foreground/6" : ""}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{wall.title}</p>
                      <p className="text-xs text-muted">
                        {wall.memberCount}명 · {wall.myRole === "owner" ? "방장" : "멤버"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => toggleMembersPanel(wall.id)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-foreground/5 hover:text-foreground"
                      >
                        멤버
                      </button>
                      {wall.myRole === "owner" && friends.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setMembersPanelWallId(null);
                            setInvitePickerWallId((id) => (id === wall.id ? null : wall.id));
                          }}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-foreground/5 hover:text-foreground"
                        >
                          초대
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenEditor(wall.id)}
                        className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background"
                      >
                        꾸미기
                      </button>
                    </div>
                  </div>

                  {membersPanelWallId === wall.id && (
                    <div className="border-t border-foreground/6 px-4 py-3">
                      <p className="mb-2 text-[11px] text-muted">함께하는 사람</p>
                      {loadingMembersWallId === wall.id && (
                        <p className="py-2 text-xs text-muted">불러오는 중...</p>
                      )}
                      {loadingMembersWallId !== wall.id && (
                        <ul className="space-y-1.5">
                          {[...(membersByWall[wall.id] ?? [])]
                            .sort((a, b) => {
                              if (a.role === "owner" && b.role !== "owner") return -1;
                              if (b.role === "owner" && a.role !== "owner") return 1;
                              return a.displayName.localeCompare(b.displayName, "ko");
                            })
                            .map((member) => {
                            const isSelf = user?.id === member.userId;
                            const canRemove =
                              member.role !== "owner" &&
                              (wall.myRole === "owner" || isSelf);
                            return (
                              <li
                                key={member.id}
                                className="flex items-center gap-2 rounded-xl bg-foreground/[0.04] px-3 py-2"
                              >
                                {member.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={member.avatarUrl}
                                    alt=""
                                    className="h-7 w-7 rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground/10 text-[11px] font-semibold">
                                    {member.displayName.slice(0, 1)}
                                  </span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {member.displayName}
                                    {isSelf ? " · 나" : ""}
                                  </p>
                                  <p className="text-[11px] text-muted">
                                    {roleLabel(member.role)}
                                  </p>
                                </div>
                                {canRemove && (
                                  <button
                                    type="button"
                                    disabled={removingUserId === member.userId}
                                    onClick={() =>
                                      handleRemoveMember(wall.id, member.userId, isSelf)
                                    }
                                    className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-muted transition hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
                                  >
                                    {isSelf ? "나가기" : "내보내기"}
                                  </button>
                                )}
                              </li>
                            );
                          })}
                          {(membersByWall[wall.id] ?? []).length === 0 && (
                            <p className="py-2 text-xs text-muted">멤버가 없어요</p>
                          )}
                        </ul>
                      )}
                    </div>
                  )}

                  {invitePickerWallId === wall.id && wall.myRole === "owner" && (
                    <div className="border-t border-foreground/6 px-4 py-3">
                      <p className="mb-2 text-[11px] text-muted">초대할 친구</p>
                      <div className="flex flex-wrap gap-1.5">
                        {friends.map((friend) => (
                          <button
                            key={friend.id}
                            type="button"
                            disabled={invitingWallId === wall.id}
                            onClick={() => handleInviteFriend(wall.id, friend.id)}
                            className="rounded-full bg-foreground/[0.06] px-3 py-1.5 text-xs font-medium transition hover:bg-foreground/10 disabled:opacity-50"
                          >
                            {friend.displayName}
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

function roleLabel(role: SharedWallMember["role"]) {
  if (role === "owner") return "방장";
  if (role === "editor") return "편집";
  return "보기";
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
