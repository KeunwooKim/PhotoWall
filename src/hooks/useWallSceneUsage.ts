"use client";

import { useMemo } from "react";
import type { UserPlan } from "@/lib/wall-quotas";
import {
  getDocumentSceneUsage,
  objectLimitReachedMessage,
  type SceneUsage,
} from "@/lib/wall-quotas";
import { serializeWallScene } from "@/lib/wall-scene/fabric-import";
import { useWallSceneStore } from "@/stores/wall-scene-store";

/** Client plan until billing ships — always free / 기본. */
export function useClientWallPlan(): UserPlan {
  return "free";
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
    limitMessage: objectLimitReachedMessage(usage),
  };
}
