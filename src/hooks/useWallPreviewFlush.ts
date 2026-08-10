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
 * scene snapshot first. Flush must prefer that snapshot over a live DOM element whose
 * WebGL canvas is already cleared (that path used to upload a blank preview and discard
 * the good stash).
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
      const element = wallStageRef.current;
      const stage = konvaStageRef.current;

      // 1) Live stage + host still mounted
      if (element && stage) {
        const path = await uploadWallPreviewFromElement(wallId, element, {
          themeId,
          stage,
        });
        if (path) {
          dirtyRef.current = false;
          clearPendingWallPreviewDirty();
          takePendingWallPreviewCapture(wallId);
          lastFlushAtRef.current = Date.now();
          return;
        }
      }

      // 2) SPA-leave snapshot (stage already destroyed; host may still exist)
      const pending = takePendingWallPreviewCapture(wallId);
      if (pending) {
        const uploaded = await uploadPendingCapture(wallId, pending);
        if (uploaded) {
          dirtyRef.current = false;
          clearPendingWallPreviewDirty();
          lastFlushAtRef.current = Date.now();
          return;
        }
        // Keep snapshot for a later retry (e.g. next visibility flush)
        stashPendingWallPreviewCapture(pending);
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
