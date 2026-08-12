"use client";

import { useEffect, useMemo, useState } from "react";
import type { UserPlan } from "@/lib/wall-quotas";
import {
  getDocumentSceneUsage,
  objectLimitReachedMessage,
  type SceneUsage,
} from "@/lib/wall-quotas";
import { serializeWallScene } from "@/lib/wall-scene/fabric-import";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import { authFetch } from "@/lib/auth/api-fetch";
import type { Profile } from "@/types/profile";

/** Client plan from profile; defaults to free until loaded. */
export function useClientWallPlan(): UserPlan {
  const [plan, setPlan] = useState<UserPlan>("free");

  useEffect(() => {
    let cancelled = false;
    authFetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Profile | null) => {
        if (cancelled || !data) return;
        setPlan(data.plan === "premium" ? "premium" : "free");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return plan;
}

export function useWallSceneUsage(plan: UserPlan): SceneUsage {
  const objectCount = useWallSceneStore((s) => s.document.objects.length);
  const revision = useWallSceneStore((s) => s.document.meta.revision);

  return useMemo(() => {
    const document = useWallSceneStore.getState().document;
    return getDocumentSceneUsage(document, serializeWallScene, plan);
  }, [plan, revision, objectCount]);
}

export function useGuardWallObjectAdd(plan: UserPlan) {
  const usage = useWallSceneUsage(plan);

  const guardAdd = (count = 1): boolean => {
    if (usage.objectCount + count > usage.maxObjects) {
      return false;
    }
    return true;
  };

  return {
    usage,
    guardAdd,
    limitMessage: objectLimitReachedMessage(usage, plan),
  };
}
