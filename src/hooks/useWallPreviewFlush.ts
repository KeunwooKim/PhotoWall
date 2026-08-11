"use client";

import { useCallback, useEffect, useRef } from "react";
import type { WallStageExportHandle } from "@/components/wall/pixi/PixiWallStage";
import {
  clearPendingWallPreviewDirty,
  isPendingWallPreviewDirty,
  markPendingWallPreviewDirty,
  peekPendingWallPreviewWallId,
  stashPendingWallPreviewCapture,
  takePendingWallPreviewCapture,
  type PendingWallPreviewCapture,
} from "@/lib/storage/pending-wall-preview";
import {
  composeWallPreviewJpeg,
  exportStageSceneDataUrl,
} from "@/lib/storage/wall-preview";
import { uploadWallPreviewBlob, uploadWallPreviewFromElement } from "@/lib/storage/upload-wall-preview";
import { getWallTheme } from "@/lib/wall-themes";

const LEAVE_FLUSH_COOLDOWN_MS = 4000;

/**
 * Upload wall preview only on leave / explicit share·invite — not on every autosave.
 *
 * SPA leave destroys the stage before this hook's cleanup. The stage stashes a sync
 * scene snapshot first. Flush must prefer that snapshot over a live stage handle that
 * may already be cleared mid-await (that path used to upload a blank/stale preview and
 * discard the good stash).
 */
export function useWallPreviewFlush(args: {
  getWallId: () => string | null | undefined;
  getThemeId: () => string;
  wallStageRef: React.RefObject<HTMLDivElement | null>;
  konvaStageRef: React.RefObject<WallStageExportHandle | null>;
  /** Typically: user is logged in */
  isEnabled: () => boolean;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const dirtyRef = useRef(false);
  const lastFlushAtRef = useRef(0);
  const inflightRef = useRef(false);

  const markPreviewDirty = useCallback(() => {
    dirtyRef.current = true;
    markPendingWallPreviewDirty();
  }, []);

  const flushPreview = useCallback(async (options?: { force?: boolean; wallId?: string }) => {
    const {
      getWallId,
      getThemeId,
      wallStageRef,
      konvaStageRef,
      isEnabled,
    } = argsRef.current;

    if (!isEnabled()) return;
    const wallId = options?.wallId ?? getWallId();
    if (!wallId) return;

    const hasPending = peekPendingWallPreviewWallId() === wallId;
    if (
      !options?.force &&
      !dirtyRef.current &&
      !isPendingWallPreviewDirty() &&
      !hasPending
    ) {
      return;
    }

    const now = Date.now();
    if (
      !options?.force &&
      !hasPending &&
      now - lastFlushAtRef.current < LEAVE_FLUSH_COOLDOWN_MS
    ) {
      return;
    }
    if (inflightRef.current) return;

    inflightRef.current = true;
    try {
      const themeId = getThemeId();

      // 1) Prefer SPA-leave snapshot whenever present. A concurrent live capture
      // from pagehide can race with destroy and upload a cleared WebGL frame.
      const pendingFirst = takePendingWallPreviewCapture(wallId);
      if (pendingFirst) {
        const uploaded = await uploadPendingCapture(wallId, pendingFirst);
        if (uploaded) {
          dirtyRef.current = false;
          clearPendingWallPreviewDirty();
          lastFlushAtRef.current = Date.now();
          return;
        }
        stashPendingWallPreviewCapture(pendingFirst);
      }

      // 2) Live stage still mounted
      const element = wallStageRef.current;
      const stage = konvaStageRef.current;
      if (element && stage) {
        try {
          await stage.prepareFullExport?.();
        } catch {
          // continue with whatever is currently drawn
        }

        // Destroy may have stashed a better snapshot while we prepared.
        const raced = takePendingWallPreviewCapture(wallId);
        if (raced) {
          const uploaded = await uploadPendingCapture(wallId, raced);
          if (uploaded) {
            dirtyRef.current = false;
            clearPendingWallPreviewDirty();
            lastFlushAtRef.current = Date.now();
            return;
          }
          stashPendingWallPreviewCapture(raced);
        }

        // Stage ref cleared during await — do not capture a dead handle.
        if (konvaStageRef.current !== stage) {
          return;
        }

        const path = await uploadWallPreviewFromElement(wallId, element, {
          themeId,
          stage,
        });
        // If destroy stashed during upload, prefer that over a possibly blank live result.
        const racedAfter = takePendingWallPreviewCapture(wallId);
        if (racedAfter) {
          const uploaded = await uploadPendingCapture(wallId, racedAfter);
          if (uploaded) {
            dirtyRef.current = false;
            clearPendingWallPreviewDirty();
            lastFlushAtRef.current = Date.now();
            return;
          }
          stashPendingWallPreviewCapture(racedAfter);
        }
        if (path) {
          dirtyRef.current = false;
          clearPendingWallPreviewDirty();
          lastFlushAtRef.current = Date.now();
        }
        return;
      }

      // 3) Do NOT fall back to element-only capture after Pixi teardown — the
      // cleared WebGL canvas paints over wallpaper and uploads a blank preview.
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void flushPreview();
      }
    };
    const onPageHide = () => {
      void flushPreview();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      void flushPreview();
    };
  }, [flushPreview]);

  return { markPreviewDirty, flushPreview };
}

async function uploadPendingCapture(
  wallId: string,
  pending: PendingWallPreviewCapture,
): Promise<boolean> {
  try {
    const blob = await composeWallPreviewJpeg({
      wallpaperSrc: getWallTheme(pending.themeId).background,
      sceneDataUrl: pending.sceneDataUrl,
      wallWidth: pending.wallWidth,
      wallHeight: pending.wallHeight,
    });
    const path = await uploadWallPreviewBlob(wallId, blob);
    return !!path;
  } catch {
    return false;
  }
}

/** Call from stage teardown (sync) before destroying the renderer. */
export function stashWallPreviewFromStage(args: {
  wallId?: string | null;
  themeId: string;
  stage: WallStageExportHandle | null | undefined;
}): void {
  if (!args.wallId || !args.stage) return;
  try {
    stashPendingWallPreviewCapture({
      wallId: args.wallId,
      themeId: args.themeId,
      sceneDataUrl: exportStageSceneDataUrl(args.stage),
      wallWidth: args.stage.width(),
      wallHeight: args.stage.height(),
    });
    // Ensure leave flush runs even if the scene was not marked dirty
    // (e.g. refresh a previously blank uploaded preview).
    markPendingWallPreviewDirty();
  } catch {
    // leave without snapshot — flush may no-op
  }
}
