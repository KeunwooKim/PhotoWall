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
          ? "bg-rose-50 text-rose-800 ring-rose-200/80"
          : "bg-amber-50 text-amber-900 ring-amber-200/80"
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
