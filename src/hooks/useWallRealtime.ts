"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { throttle } from "@/lib/throttle";
import { ensureRealtimeSocket } from "@/lib/wall-scene/realtime/ensure-realtime-socket";
import { setActiveWallRealtimeSession } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import {
  WallRealtimeSession,
  type WallObjectPatch,
  type WallLiveSync,
} from "@/lib/wall-scene/realtime/wall-ydoc";
import {
  applyRemoteObjectsToNodes,
  applyRemotePatchToNode,
  applyRemotePatchesToNodes,
  isAnyWallNodeDragging,
  isWallNodeDragging,
  removeRemoteWallNodes,
} from "@/lib/wall-scene/realtime/wall-node-sync";
import { runWithoutWallPersist } from "@/lib/wall-scene/realtime/wall-persist-gate";
import {
  applyRemoteWallLivePreview,
  clearRemoteWallLivePreview,
  refreshWallLayoutFromStore,
} from "@/lib/wall-scene/wall-drag-expand";
import { hardClampObjectPositionToWall } from "@/lib/wall-scene/clamp-object-to-wall";
import { isWallSizeLocked } from "@/lib/wall-scene/wall-size-lock";
import { presenceColorForUser } from "@/lib/wall-scene/presence-colors";
import {
  clearWallPresencePeers,
  setWallPresencePeersWithColors,
} from "@/lib/wall-scene/realtime/wall-presence-store";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import { structuralSceneFingerprint } from "@/lib/wall-scene/scene-fingerprint";
import type { WallPresenceState } from "@/types/wall-scene-v2";

interface UseWallRealtimeOptions {
  wallId: string;
  userId: string;
  displayName: string;
  enabled?: boolean;
  /** Peer completed a DB save — keep local OCC baseRevision in sync. */
  onRemoteSaved?: (revision: number) => void;
  /** Remote scene applied to the store — skip echo autosave/toast. */
  onRemoteSceneApplied?: () => void;
  /** Current wallpaper theme for hello/full sync. */
  getThemeId?: () => string;
  /** Peer changed wallpaper — apply locally without waiting for reload. */
  onRemoteTheme?: (themeId: string) => void;
}

function structuralFingerprint(objects: Parameters<typeof structuralSceneFingerprint>[0]): string {
  return structuralSceneFingerprint(objects);
}

function wallMetaFingerprint(meta: {
  wallBounds: { width: number; height: number };
  wallpaperOffset?: { x: number; y: number };
  wallSizeLocked?: boolean;
  wallShrinkEnabled?: boolean;
}): string {
  const offset = meta.wallpaperOffset ?? { x: 0, y: 0 };
  return `${meta.wallBounds.width}x${meta.wallBounds.height}:${offset.x},${offset.y}:L${meta.wallSizeLocked ? 1 : 0}:S${meta.wallShrinkEnabled ? 1 : 0}`;
}

function readLocalMeta(themeId?: string) {
  const meta = useWallSceneStore.getState().document.meta;
  return {
    wallBounds: meta.wallBounds,
    wallpaperOffset: meta.wallpaperOffset,
    wallSizeLocked: meta.wallSizeLocked,
    wallShrinkEnabled: meta.wallShrinkEnabled,
    themeId,
  };
}

/**
 * Apply live peer transforms to Konva only — never touch Zustand mid-drag.
 * Store updates re-render the full Stage; at max wall size Safari reloads:
 * "A problem repeatedly occurred on this webpage".
 */
function applyLivePositionsToNodes(
  positions: Array<{ id: string; x: number; y: number }>,
  options?: { clampToWall?: boolean },
): void {
  const store = useWallSceneStore.getState();
  const wall = store.document.meta.wallBounds;
  const clamp = options?.clampToWall === true;

  const patches = positions.map((pos) => {
    let x = pos.x;
    let y = pos.y;
    if (clamp) {
      const object = store.document.objects.find((item) => item.id === pos.id);
      if (object) {
        const clamped = hardClampObjectPositionToWall(
          { ...object, x, y } as typeof object,
          wall,
        );
        if (clamped) {
          x = clamped.x;
          y = clamped.y;
        }
      }
    }
    return { id: pos.id, patch: { x, y } };
  });

  applyRemotePatchesToNodes(patches);
}

export function useWallRealtime({
  wallId,
  userId,
  displayName,
  enabled = true,
  onRemoteSaved,
  onRemoteSceneApplied,
  getThemeId,
  onRemoteTheme,
}: UseWallRealtimeOptions) {
  const onRemoteSavedRef = useRef(onRemoteSaved);
  onRemoteSavedRef.current = onRemoteSaved;
  const onRemoteSceneAppliedRef = useRef(onRemoteSceneApplied);
  onRemoteSceneAppliedRef.current = onRemoteSceneApplied;
  const getThemeIdRef = useRef(getThemeId);
  getThemeIdRef.current = getThemeId;
  const onRemoteThemeRef = useRef(onRemoteTheme);
  onRemoteThemeRef.current = onRemoteTheme;
  const [isConnected, setIsConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const sessionRef = useRef<WallRealtimeSession | null>(null);
  const sessionIdRef = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const skipLocalSync = useRef(false);
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;
  const presencePeersRaf = useRef<WallPresenceState[]>([]);
  const presenceFlushTimer = useRef<number | null>(null);

  const presenceRef = useRef({
    cursorX: 0,
    cursorY: 0,
    selectedObjectIds: undefined as string[] | undefined,
    isManipulating: false,
  });

  const flushPresenceRef = useRef(
    throttle(() => {
      const session = sessionRef.current;
      if (!session) return;
      const { cursorX, cursorY, selectedObjectIds, isManipulating } = presenceRef.current;
      session.updatePresence(cursorX, cursorY, selectedObjectIds, isManipulating);
    }, 50),
  );

  useEffect(() => {
    if (!enabled || !wallId || !userId) return;

    let cancelled = false;
    let unsubStore: (() => void) | undefined;
    let session: WallRealtimeSession | null = null;

    void (async () => {
      const supabase = createClient();

      try {
        await ensureRealtimeSocket(supabase);
      } catch {
        // Continue; channel may still connect or fall back to httpSend.
      }

      const color = presenceColorForUser(userId, sessionIdRef.current);

      session = new WallRealtimeSession({
        wallId,
        userId,
        sessionId: sessionIdRef.current,
        displayName: displayNameRef.current,
        color,
        supabase,
        getLocalObjects: () => useWallSceneStore.getState().document.objects,
        getLocalMeta: () => readLocalMeta(getThemeIdRef.current?.()),
        // Do NOT setState on every sync event — that re-renders max-size Konva and crashes Safari.
        onRemoteFull: (objects, meta) => {
          const localObjects = useWallSceneStore.getState().document.objects;
          if (objects.length === 0 && localObjects.length > 0) return;
          if (isAnyWallNodeDragging()) return;

          clearRemoteWallLivePreview();
          runWithoutWallPersist(() => {
            skipLocalSync.current = true;
            const store = useWallSceneStore.getState();

            if (meta?.wallBounds) {
              store.syncRemoteWallMeta(meta);
              // World-locked camera: do not addPan when remote wall AABB changes.
            }
            useWallSceneStore.getState().syncRemoteObjects(objects);
            applyRemoteObjectsToNodes(objects);
            queueMicrotask(() => {
              skipLocalSync.current = false;
            });
          });
          refreshWallLayoutFromStore();
          onRemoteSceneAppliedRef.current?.();
        },
        onRemoteClear: () => {
          if (isAnyWallNodeDragging()) return;

          clearRemoteWallLivePreview();
          runWithoutWallPersist(() => {
            skipLocalSync.current = true;
            useWallSceneStore.getState().syncRemoteObjects([]);
            applyRemoteObjectsToNodes([]);
            queueMicrotask(() => {
              skipLocalSync.current = false;
            });
          });
          refreshWallLayoutFromStore();
          onRemoteSceneAppliedRef.current?.();
        },
        onRemoteRemove: (ids) => {
          // Removals always apply — full sync can be skipped while dragging or
          // dropped when the scene payload is large. Skip ids the local user is dragging.
          const removable = ids.filter((id) => !isWallNodeDragging(id));
          if (removable.length === 0) return;

          runWithoutWallPersist(() => {
            skipLocalSync.current = true;
            const store = useWallSceneStore.getState();
            const remove = new Set(removable);
            const next = store.document.objects.filter((object) => !remove.has(object.id));
            if (next.length !== store.document.objects.length) {
              store.syncRemoteObjects(next);
            }
            removeRemoteWallNodes(removable);
            const selected = store.selectedIds.filter((id) => !remove.has(id));
            if (selected.length !== store.selectedIds.length) {
              store.setSelectedIds(selected);
            }
            queueMicrotask(() => {
              skipLocalSync.current = false;
            });
          });
          onRemoteSceneAppliedRef.current?.();
        },
        onRemotePatch: (id, patch) => {
          // Nodes only while live — store catches up on full/saved.
          applyRemotePatchToNode(id, patch);
        },
        onRemoteWallLive: (live: WallLiveSync) => {
          if (isAnyWallNodeDragging()) return;
          // Imperative wall size (no Zustand) so peers see expand without Safari crash.
          if (live.wallBounds) {
            applyRemoteWallLivePreview(live);
          }
          if (!live.positions?.length) return;
          const locked =
            isWallSizeLocked() ||
            live.wallSizeLocked === true ||
            useWallSceneStore.getState().document.meta.wallSizeLocked === true;
          applyLivePositionsToNodes(live.positions, { clampToWall: locked });
        },
        onRemoteSaved: (revision) => {
          clearRemoteWallLivePreview();
          refreshWallLayoutFromStore();
          onRemoteSavedRef.current?.(revision);
          onRemoteSceneAppliedRef.current?.();
        },
        onRemoteTheme: (themeId) => {
          onRemoteThemeRef.current?.(themeId);
        },
        onPresenceChange: (nextPeers) => {
          // Publish to presence store (cursors / avatars). Selection-only
          // subscribers on the Konva Stage ignore cursor-only churn.
          if (cancelled) return;
          presencePeersRaf.current = nextPeers;
          if (presenceFlushTimer.current != null) return;
          presenceFlushTimer.current = window.setTimeout(() => {
            presenceFlushTimer.current = null;
            if (cancelled) return;
            const snapshot = presencePeersRaf.current;
            setWallPresencePeersWithColors(snapshot, {
              userId,
              sessionId: sessionIdRef.current,
            });
          }, 150);
        },
      });

      try {
        await session.connect();
        if (cancelled) {
          await session.dispose();
          return;
        }

        sessionRef.current = session;
        setActiveWallRealtimeSession(session);
        setIsConnected(true);
        setConnectError(null);
        session.announceJoin();
      } catch (error) {
        if (cancelled) return;
        await session.dispose();
        const message = error instanceof Error ? error.message : "Realtime connect failed";
        setConnectError(message);
        setIsConnected(false);
      }

      unsubStore = useWallSceneStore.subscribe(
        (s) =>
          `${structuralFingerprint(s.document.objects)}|${wallMetaFingerprint(s.document.meta)}`,
        () => {
          if (skipLocalSync.current || !sessionRef.current) return;
          const state = useWallSceneStore.getState();
          sessionRef.current.broadcastFull(state.document.objects, {
            wallBounds: state.document.meta.wallBounds,
            wallpaperOffset: state.document.meta.wallpaperOffset,
            wallSizeLocked: state.document.meta.wallSizeLocked,
            wallShrinkEnabled: state.document.meta.wallShrinkEnabled,
            themeId: getThemeIdRef.current?.(),
          });
        },
      );
    })();

    return () => {
      cancelled = true;
      if (presenceFlushTimer.current != null) {
        window.clearTimeout(presenceFlushTimer.current);
        presenceFlushTimer.current = null;
      }
      unsubStore?.();
      setActiveWallRealtimeSession(null);
      const active = sessionRef.current;
      sessionRef.current = null;
      void active?.dispose();
      setIsConnected(false);
      setConnectError(null);
      clearWallPresencePeers();
    };
  }, [wallId, userId, enabled]);

  const updatePresence = useCallback(
    (
      cursorX: number,
      cursorY: number,
      selectedObjectIds?: string[],
      isManipulating = false,
      immediate = false,
    ) => {
      const prev = presenceRef.current;
      const staleZero =
        cursorX === 0 &&
        cursorY === 0 &&
        (prev.cursorX !== 0 || prev.cursorY !== 0);
      const x = staleZero ? prev.cursorX : cursorX;
      const y = staleZero ? prev.cursorY : cursorY;
      const ids =
        selectedObjectIds !== undefined
          ? selectedObjectIds
          : prev.selectedObjectIds;

      presenceRef.current = { cursorX: x, cursorY: y, selectedObjectIds: ids, isManipulating };

      if (immediate) {
        sessionRef.current?.updatePresence(
          x,
          y,
          ids,
          isManipulating,
          true,
        );
        return;
      }

      flushPresenceRef.current();
    },
    [],
  );

  const broadcastObjectPatch = useCallback((id: string, patch: WallObjectPatch) => {
    sessionRef.current?.broadcastPatch(id, patch);
  }, []);

  const broadcastClear = useCallback(() => {
    sessionRef.current?.broadcastClear();
  }, []);

  const broadcastRemove = useCallback((ids: string[]) => {
    sessionRef.current?.broadcastRemove(ids);
  }, []);

  const broadcastTheme = useCallback((themeId: string) => {
    sessionRef.current?.broadcastTheme(themeId);
  }, []);

  const broadcastSaved = useCallback((revision: number) => {
    sessionRef.current?.broadcastSaved(revision);
  }, []);

  return {
    isConnected,
    connectError,
    sessionId: sessionIdRef.current,
    updatePresence,
    broadcastObjectPatch,
    broadcastClear,
    broadcastRemove,
    broadcastTheme,
    broadcastSaved,
  };
}
