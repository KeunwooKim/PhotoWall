"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { throttle } from "@/lib/throttle";
import { ensureRealtimeSocket } from "@/lib/wall-scene/realtime/ensure-realtime-socket";
import { setActiveWallRealtimeSession } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import { rtError, rtLog, rtWarn } from "@/lib/wall-scene/realtime/wall-realtime-log";
import {
  WallRealtimeSession,
  type WallObjectPatch,
} from "@/lib/wall-scene/realtime/wall-ydoc";
import {
  applyRemoteObjectsToNodes,
  applyRemotePatchToNode,
  isAnyWallNodeDragging,
} from "@/lib/wall-scene/realtime/wall-node-sync";
import { presenceColorForUser } from "@/lib/wall-scene/presence-colors";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallPresenceState, WallSceneObject } from "@/types/wall-scene-v2";

interface UseWallRealtimeOptions {
  wallId: string;
  userId: string;
  displayName: string;
  enabled?: boolean;
}

function structuralFingerprint(objects: WallSceneObject[]): string {
  return JSON.stringify(
    objects
      .map((object) => ({
        id: object.id,
        type: object.type,
        zIndex: object.zIndex,
        src: object.type === "photo" ? object.src : undefined,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}

export function useWallRealtime({
  wallId,
  userId,
  displayName,
  enabled = true,
}: UseWallRealtimeOptions) {
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
    selectedObjectId: undefined as string | undefined,
    isManipulating: false,
  });

  const flushPresenceRef = useRef(
    throttle(() => {
      const session = sessionRef.current;
      if (!session) return;
      const { cursorX, cursorY, selectedObjectId, isManipulating } = presenceRef.current;
      session.updatePresence(cursorX, cursorY, selectedObjectId, isManipulating);
    }, 50),
  );

  useEffect(() => {
    if (!enabled || !wallId || !userId) {
      if (process.env.NODE_ENV === "development" && wallId) {
        rtLog("realtime idle", { enabled, hasUserId: !!userId, wallId: wallId.slice(0, 8) });
      }
      return;
    }

    rtLog("realtime starting", {
      wallId: wallId.slice(0, 8),
      userId: userId.slice(0, 8),
      sessionId: sessionIdRef.current.slice(0, 8),
    });

    let cancelled = false;
    let unsubStore: (() => void) | undefined;
    let session: WallRealtimeSession | null = null;

    void (async () => {
      const supabase = createClient();

      try {
        await ensureRealtimeSocket(supabase);
        rtLog("websocket ready", { connected: supabase.realtime.isConnected() });
      } catch (error) {
        rtWarn("websocket wait failed, continuing anyway", {
          error: error instanceof Error ? error.message : String(error),
        });
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
        onSyncEvent: () => {
          if (!cancelled) setRemoteSyncCount((count) => count + 1);
        },
        onRemoteFull: (objects) => {
          rtLog("applying remote full snapshot", { objectCount: objects.length });
          const localObjects = useWallSceneStore.getState().document.objects;
          if (objects.length === 0 && localObjects.length > 0) return;
          if (isAnyWallNodeDragging()) return;

          skipLocalSync.current = true;
          useWallSceneStore.getState().syncRemoteObjects(objects);
          applyRemoteObjectsToNodes(objects);
          queueMicrotask(() => {
            skipLocalSync.current = false;
          });
        },
        onRemotePatch: (id, patch) => {
          applyRemotePatchToNode(id, patch);

          skipLocalSync.current = true;
          useWallSceneStore.getState().patchObject(id, patch);
          queueMicrotask(() => {
            skipLocalSync.current = false;
          });
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
        rtLog("ready — drag a photo and watch for → send patch / ← recv patch");
      } catch (error) {
        if (cancelled) return;
        await session.dispose();
        const message = error instanceof Error ? error.message : "Realtime connect failed";
        setConnectError(message);
        setIsConnected(false);
        rtError("connect failed ✗", message);
      }

      unsubStore = useWallSceneStore.subscribe(
        (s) => structuralFingerprint(s.document.objects),
        () => {
          if (skipLocalSync.current || !sessionRef.current) return;
          sessionRef.current.broadcastFull(useWallSceneStore.getState().document.objects);
        },
      );
    })();

    return () => {
      cancelled = true;
      rtLog("realtime cleanup");
      unsubStore?.();
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
      selectedObjectId?: string,
      isManipulating = false,
      immediate = false,
    ) => {
      presenceRef.current = { cursorX, cursorY, selectedObjectId, isManipulating };

      if (immediate) {
        sessionRef.current?.updatePresence(
          cursorX,
          cursorY,
          selectedObjectId,
          isManipulating,
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

  return {
    peers,
    isConnected,
    connectError,
    remoteSyncCount,
    sessionId: sessionIdRef.current,
    updatePresence,
    broadcastObjectPatch,
  };
}
