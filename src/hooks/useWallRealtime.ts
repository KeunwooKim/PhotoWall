"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { throttle } from "@/lib/throttle";
import {
  WallRealtimeSession,
  type WallObjectPatch,
} from "@/lib/wall-scene/realtime/wall-ydoc";
import { sceneObjectsEqual } from "@/lib/wall-scene/scene-fingerprint";
import { presenceColorForUser } from "@/lib/wall-scene/presence-colors";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallPresenceState } from "@/types/wall-scene-v2";

interface UseWallRealtimeOptions {
  wallId: string;
  userId: string;
  displayName: string;
  enabled?: boolean;
}

export function useWallRealtime({
  wallId,
  userId,
  displayName,
  enabled = true,
}: UseWallRealtimeOptions) {
  const [peers, setPeers] = useState<WallPresenceState[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const sessionRef = useRef<WallRealtimeSession | null>(null);
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
    }, 32),
  );

  useEffect(() => {
    if (!enabled || !wallId || !userId) return;

    const supabase = createClient();
    const color = presenceColorForUser(userId);

    const session = new WallRealtimeSession({
      wallId,
      userId,
      displayName: displayNameRef.current,
      color,
      supabase,
      onRemoteObjectsChange: (objects) => {
        const localObjects = useWallSceneStore.getState().document.objects;
        if (objects.length === 0 && localObjects.length > 0) return;
        if (sceneObjectsEqual(objects, localObjects)) return;

        skipLocalSync.current = true;
        const doc = useWallSceneStore.getState().document;
        useWallSceneStore.getState().loadDocument({
          ...doc,
          objects,
        });
        skipLocalSync.current = false;
      },
      onObjectPatch: (id, patch) => {
        skipLocalSync.current = true;
        useWallSceneStore.getState().patchObject(id, patch);
        skipLocalSync.current = false;
      },
      onPresenceChange: setPeers,
    });

    sessionRef.current = session;

    void session.connect().then(() => {
      setIsConnected(true);
      const localObjects = useWallSceneStore.getState().document.objects;
      if (session.getObjectCount() === 0 && localObjects.length > 0) {
        session.applyLocalObjects(localObjects);
      } else if (session.getObjectCount() > 0) {
        skipLocalSync.current = true;
        const doc = useWallSceneStore.getState().document;
        useWallSceneStore.getState().loadDocument({
          ...doc,
          objects: session.readObjects(),
        });
        skipLocalSync.current = false;
      }
    });

    const unsub = useWallSceneStore.subscribe(
      (s) => s.document.objects,
      (objects) => {
        if (skipLocalSync.current || !sessionRef.current) return;
        if (sceneObjectsEqual(objects, sessionRef.current.readObjects())) return;
        sessionRef.current.applyLocalObjects(objects);
      },
    );

    return () => {
      unsub();
      session.dispose();
      sessionRef.current = null;
      setIsConnected(false);
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
    skipLocalSync.current = true;
    useWallSceneStore.getState().patchObject(id, patch);
    skipLocalSync.current = false;
    sessionRef.current?.broadcastObjectPatch(id, patch);
  }, []);

  return { peers, isConnected, updatePresence, broadcastObjectPatch };
}
