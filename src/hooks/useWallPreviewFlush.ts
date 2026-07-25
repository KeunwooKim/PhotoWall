"use client";

import { useCallback, useEffect, useRef } from "react";
import type Konva from "konva";
import { uploadWallPreviewFromElement } from "@/lib/storage/upload-wall-preview";

const LEAVE_FLUSH_COOLDOWN_MS = 4000;

/**
 * Upload wall preview only on leave / explicit share·invite — not on every autosave.
 * Marks dirty when the scene changes; flushes on tab hide, pagehide, unmount, or force.
 */
export function useWallPreviewFlush(args: {
  getWallId: () => string | null | undefined;
  getThemeId: () => string;
  wallStageRef: React.RefObject<HTMLDivElement | null>;
  konvaStageRef: React.RefObject<Konva.Stage | null>;
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
    if (!options?.force && !dirtyRef.current) return;

    const now = Date.now();
    if (!options?.force && now - lastFlushAtRef.current < LEAVE_FLUSH_COOLDOWN_MS) {
      return;
    }
    if (inflightRef.current) return;

    dirtyRef.current = false;
    lastFlushAtRef.current = now;
    inflightRef.current = true;
    try {
      await uploadWallPreviewFromElement(wallId, wallStageRef.current, {
        themeId: getThemeId(),
        stage: konvaStageRef.current,
      });
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
