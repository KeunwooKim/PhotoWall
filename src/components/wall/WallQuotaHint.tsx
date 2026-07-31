"use client";

import type { SceneUsage } from "@/lib/wall-quotas";
import { formatBytesShort, quotaHintDetail } from "@/lib/wall-quotas";
import type { UserPlan } from "@/lib/wall-quotas";

interface WallQuotaHintProps {
  usage: SceneUsage;
  plan: UserPlan;
}

/** Near-limit usage chip for the immersive editor chrome. */
export default function WallQuotaHint({ usage, plan }: WallQuotaHintProps) {
  if (!usage.showHint) return null;

  const critical = usage.atObjectLimit || usage.atByteLimit;
  const parts: string[] = [];

  if (usage.nearObjectLimit || usage.atObjectLimit) {
    parts.push(`${usage.objectCount}/${usage.maxObjects}`);
  }
  if (usage.nearByteLimit || usage.atByteLimit) {
    parts.push(`${formatBytesShort(usage.sceneBytes)}/${formatBytesShort(usage.maxBytes)}`);
  }

  return (
    <div
      className={`pointer-events-none max-w-[min(18rem,70vw)] rounded-full px-3 py-1.5 text-[11px] font-medium shadow-sm ring-1 ${
        critical
          ? "bg-foreground text-background ring-foreground"
          : "bg-surface text-foreground ring-foreground/15"
      }`}
      role="status"
    >
      <span className="tabular-nums">{parts.join(" · ")}</span>
      <span className="mt-0.5 block truncate font-normal opacity-90">
        {quotaHintDetail(usage, plan)}
      </span>
    </div>
  );
}
