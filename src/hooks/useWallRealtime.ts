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
  isAnyWallNodeDragging,
} from "@/lib/wall-scene/realtime/wall-node-sync";
import { runWithoutWallPersist } from "@/lib/wall-scene/realtime/wall-persist-gate";
import { panDeltaForWallLayoutChange } from "@/lib/wall-scene/viewport-stabilize";
import { hardClampObjectPositionToWall } from "@/lib/wall-scene/clamp-object-to-wall";
import { isWallSizeLocked } from "@/lib/wall-scene/wall-size-lock";
import { presenceColorForUser } from "@/lib/wall-scene/presence-colors";
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
}

function structuralFingerprint(objects: Parameters<typeof structuralSceneFingerprint>[0]): string {
  return structuralSceneFingerprint(objects);
}

function wallMetaFingerprint(meta: {
  wallBounds: { width: number; height: number };
  wallpaperOffset?: { x: number; y: number };
  wallSizeLocked?: boolean;
}): string {
  const offset = meta.wallpaperOffset ?? { x: 0, y: 0 };
  return `${meta.wallBounds.width}x${meta.wallBounds.height}:${offset.x},${offset.y}:L${meta.wallSizeLocked ? 1 : 0}`;
}

function readLocalMeta() {
  const meta = useWallSceneStore.getState().document.meta;
  return {
    wallBounds: meta.wallBounds,
    wallpaperOffset: meta.wallpaperOffset,
    wallSizeLocked: meta.wallSizeLocked,
  };
}

export function useWallRealtime({
  wallId,
  userId,
  displayName,
  enabled = true,
  onRemoteSaved,
}: UseWallRealtimeOptions) {
  const onRemoteSavedRef = useRef(onRemoteSaved);
  onRemoteSavedRef.current = onRemoteSaved;
  const [peers, setPeers] = useState<WallPresenceState[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [remoteSyncCount, setRemoteSyncCount] = useState(0);
  const sessionRef = useRef<WallRealtimeSession | null>(null);
  const sessionIdRef = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const skipLocalSync = useRef(false);
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;

  const presenceRef = useRef({
    cursorX: 0,
    cursorY: 0,
    selectedObjectIds: undefined as string[] | undefined,
    isManipulating: false,
  });

  /** Live remote drag used to patch the store every frame and re-render the whole stage (Safari crash). */
  const pendingRemotePatchesRef = useRef(new Map<string, WallObjectPatch>());
  const flushRemoteStorePatchesRef = useRef(
    throttle(() => {
      const pending = pendingRemotePatchesRef.current;
      if (pending.size === 0) return;

      const entries = [...pending.entries()];
      pending.clear();

      runWithoutWallPersist(() => {
        skipLocalSync.current = true;
        const store = useWallSceneStore.getState();
        for (const [id, patch] of entries) {
          store.patchObject(id, patch);
        }
        queueMicrotask(() => {
          skipLocalSync.current = false;
        });
      });
    }, 120),
  );

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

      const color = presenceColorForUser(userId);

      session = new WallRealtimeSession({
        wallId,
        userId,
        sessionId: sessionIdRef.current,
        displayName: displayNameRef.current,
        color,
        supabase,
        getLocalObjects: () => useWallSceneStore.getState().document.objects,
        getLocalMeta: readLocalMeta,
        onSyncEvent: () => {
          if (!cancelled) setRemoteSyncCount((count) => count + 1);
        },
        onRemoteFull: (objects, meta) => {
          const localObjects = useWallSceneStore.getState().document.objects;
          if (objects.length === 0 && localObjects.length > 0) return;
          if (isAnyWallNodeDragging()) return;

          runWithoutWallPersist(() => {
            skipLocalSync.current = true;
            const store = useWallSceneStore.getState();
            const prevMeta = {
              wallBounds: store.document.meta.wallBounds,
              wallpaperOffset: store.document.meta.wallpaperOffset,
            };
            const prevScale = store.viewportScale;

            // Apply wall meta before objects so peers share the same coordinate frame.
            if (meta?.wallBounds) {
              store.syncRemoteWallMeta(meta);
              const delta = panDeltaForWallLayoutChange(prevMeta, meta, prevScale);
              if (delta.dx !== 0 || delta.dy !== 0) {
                useWallSceneStore.getState().addPan(delta.dx, delta.dy);
              }
            }
            useWallSceneStore.getState().syncRemoteObjects(objects);
            applyRemoteObjectsToNodes(objects);
            queueMicrotask(() => {
              skipLocalSync.current = false;
            });
          });
        },
        onRemoteClear: () => {
          if (isAnyWallNodeDragging()) return;

          runWithoutWallPersist(() => {
            skipLocalSync.current = true;
            useWallSceneStore.getState().syncRemoteObjects([]);
            applyRemoteObjectsToNodes([]);
            queueMicrotask(() => {
              skipLocalSync.current = false;
            });
          });
        },
        onRemotePatch: (id, patch) => {
          applyRemotePatchToNode(id, patch);

          const pending = pendingRemotePatchesRef.current;
          pending.set(id, { ...(pending.get(id) ?? {}), ...patch });
          flushRemoteStorePatchesRef.current();
        },
        onRemoteWallLive: (live: WallLiveSync) => {
          if (isAnyWallNodeDragging()) return;

          runWithoutWallPersist(() => {
            skipLocalSync.current = true;
            const store = useWallSceneStore.getState();
            const prevMeta = {
              wallBounds: store.document.meta.wallBounds,
              wallpaperOffset: store.document.meta.wallpaperOffset,
            };
            const prevScale = store.viewportScale;
            const locked =
              isWallSizeLocked() ||
              live.wallSizeLocked === true ||
              store.document.meta.wallSizeLocked === true;

            const nextBounds = locked
              ? {
                  width: Math.min(live.wallBounds.width, prevMeta.wallBounds.width),
                  height: Math.min(live.wallBounds.height, prevMeta.wallBounds.height),
                }
              : live.wallBounds;

            store.syncRemoteWallMeta({
              wallBounds: nextBounds,
              wallpaperOffset: locked ? prevMeta.wallpaperOffset : live.wallpaperOffset,
              wallSizeLocked: live.wallSizeLocked,
            });

            if (!locked) {
              const delta = panDeltaForWallLayoutChange(
                prevMeta,
                {
                  wallBounds: nextBounds,
                  wallpaperOffset: live.wallpaperOffset,
                },
                prevScale,
              );
              if (delta.dx !== 0 || delta.dy !== 0) {
                useWallSceneStore.getState().addPan(delta.dx, delta.dy);
              }
            }

            if (live.positions?.length) {
              const nextStore = useWallSceneStore.getState();
              const wall = nextStore.document.meta.wallBounds;
              for (const pos of live.positions) {
                const object = nextStore.document.objects.find((item) => item.id === pos.id);
                let x = pos.x;
                let y = pos.y;
                if (locked && object) {
                  const clamped = hardClampObjectPositionToWall(
                    { ...object, x, y } as typeof object,
                    wall,
                  );
                  if (clamped) {
                    x = clamped.x;
                    y = clamped.y;
                  }
                }
                nextStore.patchObject(pos.id, { x, y });
                applyRemotePatchToNode(pos.id, { x, y });
              }
            }

            queueMicrotask(() => {
              skipLocalSync.current = false;
            });
          });
        },
        onRemoteSaved: (revision) => {
          onRemoteSavedRef.current?.(revision);
        },
        onPresenceChange: setPeers,
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
          });
        },
      );
    })();

    return () => {
      cancelled = true;
      unsubStore?.();
      flushRemoteStorePatchesRef.current.flush();
      pendingRemotePatchesRef.current.clear();
      setActiveWallRealtimeSession(null);
      const active = sessionRef.current;
      sessionRef.current = null;
      void active?.dispose();
      setIsConnected(false);
      setConnectError(null);
      setRemoteSyncCount(0);
      setPeers([]);
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

  const broadcastSaved = useCallback((revision: number) => {
    sessionRef.current?.broadcastSaved(revision);
  }, []);

  return {
    peers,
    isConnected,
    connectError,
    remoteSyncCount,
    sessionId: sessionIdRef.current,
    updatePresence,
    broadcastObjectPatch,
    broadcastClear,
    broadcastSaved,
  };
}
