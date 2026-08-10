"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ensureRealtimeSocket } from "@/lib/wall-scene/realtime/ensure-realtime-socket";
import { PersonalWallLeaseSession } from "@/lib/wall-scene/realtime/personal-wall-lease";

function isCloudWallId(id: string): boolean {
  return id.length === 36 && id !== "my-wall";
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type UsePersonalWallLeaseOptions = {
  wallId: string;
  userId: string | undefined;
  /** Login + cloud sync done + ready */
  enabled?: boolean;
  onKicked?: () => void;
};

/**
 * Exclusive editor lease for personal walls (newest tab/device wins).
 * Does not sync scene content — only editing rights.
 */
export function usePersonalWallLease({
  wallId,
  userId,
  enabled = true,
  onKicked,
}: UsePersonalWallLeaseOptions) {
  const [isEditor, setIsEditor] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const sessionRef = useRef<PersonalWallLeaseSession | null>(null);
  const sessionIdRef = useRef(createSessionId());
  const onKickedRef = useRef(onKicked);
  onKickedRef.current = onKicked;

  const active =
    enabled && !!userId && isCloudWallId(wallId);

  useEffect(() => {
    if (!active || !userId) {
      setIsConnected(false);
      // Guests / no lease stay as editor (local-only).
      setIsEditor(true);
      return;
    }

    let cancelled = false;
    const session = new PersonalWallLeaseSession({
      wallId,
      userId,
      sessionId: sessionIdRef.current,
      supabase: createClient(),
      onKicked: () => {
        if (cancelled) return;
        setIsEditor(false);
        onKickedRef.current?.();
      },
      onConnected: () => {
        if (cancelled) return;
        setIsConnected(true);
        // Joining claims editorship for this session.
        setIsEditor(true);
      },
      onDisconnected: () => {
        if (cancelled) return;
        setIsConnected(false);
      },
    });
    sessionRef.current = session;

    void (async () => {
      try {
        await ensureRealtimeSocket(createClient());
        if (cancelled) return;
        await session.connect();
      } catch {
        // Realtime unavailable — fall back to OCC-only (keep editing).
        if (!cancelled) {
          setIsConnected(false);
          setIsEditor(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      sessionRef.current = null;
      void session.dispose();
    };
  }, [active, wallId, userId]);

  const reclaim = useCallback(() => {
    setIsEditor(true);
    sessionRef.current?.claim();
  }, []);

  return {
    isEditor: active ? isEditor : true,
    isConnected,
    reclaim,
  };
}
