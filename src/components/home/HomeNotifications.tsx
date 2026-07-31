"use client";

import Link from "next/link";
import type { PublicAnnouncement } from "@/types/announcement";
import type { WallMemberInvite } from "@/types/shared-wall";
import type { WallActivityNotice } from "@/types/wall-activity-notice";
import { authFetch } from "@/lib/auth/api-fetch";

export type HomeNotice =
  | { kind: "invite"; invite: WallMemberInvite }
  | { kind: "announcement"; item: PublicAnnouncement }
  | { kind: "wall_activity"; activity: WallActivityNotice };

interface HomeNotificationsProps {
  open: boolean;
  onClose: () => void;
  notices: HomeNotice[];
  onDismissActivity?: (id: string) => void;
}

async function dismissActivity(id: string) {
  try {
    await authFetch("/api/notifications/wall-activity", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
  } catch {
    /* ignore */
  }
}

export default function HomeNotifications({
  open,
  onClose,
  notices,
  onDismissActivity,
}: HomeNotificationsProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal aria-label="알림">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[70dvh] overflow-hidden rounded-t-3xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4">
          <h2 className="text-base font-bold text-foreground">알림</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-foreground/[0.06] px-3 py-1.5 text-xs font-medium text-muted"
          >
            닫기
          </button>
        </div>
        <div className="max-h-[calc(70dvh-3.5rem)] space-y-2.5 overflow-y-auto px-4 py-4">
          {notices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">새 알림이 없어요</p>
          ) : (
            notices.map((notice) => {
              if (notice.kind === "invite") {
                const inv = notice.invite;
                return (
                  <Link
                    key={`invite-${inv.id}`}
                    href="/walls"
                    onClick={onClose}
                    className="flex gap-3 rounded-2xl border border-foreground/15 bg-foreground/[0.04] px-3.5 py-3"
                  >
                    {inv.inviterAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={inv.inviterAvatarUrl}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/20 text-sm font-semibold text-foreground">
                        {inv.inviterName.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[12.5px] leading-snug text-foreground">
                        <span className="font-semibold">{inv.inviterName}</span>님이{" "}
                        <span className="font-semibold">{inv.wallTitle}</span> 공동 벽에
                        초대했어요
                      </p>
                      <p className="mt-1 text-[10px] text-muted">공동 벽에서 수락할 수 있어요</p>
                    </div>
                  </Link>
                );
              }

              if (notice.kind === "wall_activity") {
                const act = notice.activity;
                return (
                  <Link
                    key={`act-${act.id}`}
                    href={`/shared/${act.wallId}`}
                    onClick={() => {
                      onDismissActivity?.(act.id);
                      void dismissActivity(act.id);
                      onClose();
                    }}
                    className="flex gap-3 rounded-2xl border border-foreground/15 bg-foreground/[0.04] px-3.5 py-3"
                  >
                    {act.actorAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={act.actorAvatarUrl}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/20 text-sm font-semibold text-foreground">
                        {act.actorName.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[12.5px] leading-snug text-foreground">
                        <span className="font-semibold">{act.actorName}</span>님이{" "}
                        <span className="font-semibold">{act.wallTitle}</span>을(를)
                        업데이트했어요
                      </p>
                      <p className="mt-1 text-[10px] text-muted">공동 벽 열기</p>
                    </div>
                  </Link>
                );
              }

              const item = notice.item;
              return (
                <div
                  key={`ann-${item.id}`}
                  className="rounded-2xl border border-foreground/10 bg-background px-3.5 py-3"
                >
                  <p className="text-[12.5px] font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-foreground/90">
                    {item.message}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
