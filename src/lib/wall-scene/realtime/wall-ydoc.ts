import * as Y from "yjs";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { WallPresenceState, WallSceneObject } from "@/types/wall-scene-v2";
import { fingerprintSceneObjects } from "@/lib/wall-scene/scene-fingerprint";
import { dedupePresencePeers } from "@/lib/wall-scene/presence-utils";

const CHANNEL_PREFIX = "shared-wall";
const BROADCAST_EVENT = "yjs-update";
const PRESENCE_EVENT = "presence-update";
const OBJECT_PATCH_EVENT = "object-patch";

export type WallObjectPatch = Partial<
  Pick<WallSceneObject, "x" | "y" | "rotation" | "scaleX" | "scaleY" | "zIndex">
>;

export interface WallRealtimeOptions {
  wallId: string;
  userId: string;
  displayName: string;
  color: string;
  supabase: SupabaseClient;
  onRemoteObjectsChange: (objects: WallSceneObject[]) => void;
  onObjectPatch: (id: string, patch: WallObjectPatch) => void;
  onPresenceChange: (peers: WallPresenceState[]) => void;
}

/**
 * Yjs CRDT for object list + Supabase Realtime for transport & presence.
 */
export class WallRealtimeSession {
  private doc = new Y.Doc();
  private objectsMap: Y.Map<string>;
  private channel: RealtimeChannel | null = null;
  private disposed = false;
  private subscribed = false;
  private lastAppliedFingerprint = "";
  private pendingUpdates: Uint8Array[] = [];
  private suppressObjectObserver = false;
  private remoteObjectsFlush = false;
  /** Latest presence per user — fed by broadcast (fast) + channel sync (join/leave). */
  private livePeers = new Map<string, WallPresenceState>();

  constructor(private options: WallRealtimeOptions) {
    this.objectsMap = this.doc.getMap("objects");

    this.doc.on("update", (update, origin) => {
      if (origin === "remote" || this.disposed) return;
      this.enqueueBroadcast(update);
    });

    this.objectsMap.observe(() => {
      if (this.disposed || this.suppressObjectObserver) return;
      this.scheduleRemoteObjectsEmit();
    });
  }

  async connect(): Promise<void> {
    const { supabase, wallId, userId, displayName, color } = this.options;

    this.channel = supabase.channel(`${CHANNEL_PREFIX}:${wallId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: userId },
      },
    });

    this.channel
      .on("broadcast", { event: BROADCAST_EVENT }, ({ payload }) => {
        const raw = (payload as { update?: number[] })?.update;
        if (!raw) return;
        Y.applyUpdate(this.doc, Uint8Array.from(raw), "remote");
        this.lastAppliedFingerprint = fingerprintSceneObjects(this.readObjects());
        this.scheduleRemoteObjectsEmit();
      })
      .on("broadcast", { event: OBJECT_PATCH_EVENT }, ({ payload }) => {
        const body = payload as { id?: string; patch?: WallObjectPatch };
        if (!body?.id || !body.patch) return;
        this.patchYjsObject(body.id, body.patch);
        this.options.onObjectPatch(body.id, body.patch);
      })
      .on("broadcast", { event: PRESENCE_EVENT }, ({ payload }) => {
        const peer = payload as WallPresenceState;
        if (!peer?.userId || peer.userId === this.options.userId) return;
        this.livePeers.set(peer.userId, peer);
        this.emitPeers();
      })
      .on("presence", { event: "sync" }, () => this.syncPeersFromChannel())
      .on("presence", { event: "join" }, () => this.syncPeersFromChannel())
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const departed = Object.values(leftPresences ?? {}).flat() as unknown as WallPresenceState[];
        for (const peer of departed) {
          if (peer?.userId) this.livePeers.delete(peer.userId);
        }
        this.emitPeers();
      });

    await new Promise<void>((resolve, reject) => {
      if (!this.channel) {
        reject(new Error("Channel not created"));
        return;
      }

      this.channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.subscribed = true;
          this.flushPendingBroadcasts();
          void this.channel?.track({
            userId,
            displayName,
            color,
            cursorX: 0,
            cursorY: 0,
            updatedAt: Date.now(),
          });
          resolve();
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          reject(new Error(`Realtime channel ${status}`));
        }
      });
    });
  }

  readObjects(): WallSceneObject[] {
    const objects: WallSceneObject[] = [];
    this.objectsMap.forEach((value) => {
      try {
        objects.push(JSON.parse(value) as WallSceneObject);
      } catch {
        /* skip malformed */
      }
    });
    return objects.sort((a, b) => a.zIndex - b.zIndex);
  }

  getObjectCount(): number {
    return this.objectsMap.size;
  }

  applyLocalObjects(objects: WallSceneObject[]): void {
    const fingerprint = fingerprintSceneObjects(objects);
    if (fingerprint === this.lastAppliedFingerprint) return;
    this.lastAppliedFingerprint = fingerprint;

    this.suppressObjectObserver = true;
    try {
      this.doc.transact(() => {
        const nextIds = new Set(objects.map((o) => o.id));
        for (const key of this.objectsMap.keys()) {
          if (!nextIds.has(key)) this.objectsMap.delete(key);
        }
        for (const obj of objects) {
          this.objectsMap.set(obj.id, JSON.stringify(obj));
        }
      });
    } finally {
      this.suppressObjectObserver = false;
    }
  }

  /** Immediate drag/transform sync (low latency). */
  broadcastObjectPatch(id: string, patch: WallObjectPatch): void {
    if (!this.channel || this.disposed || !this.subscribed) return;

    this.patchYjsObject(id, patch);

    void this.channel.send({
      type: "broadcast",
      event: OBJECT_PATCH_EVENT,
      payload: { id, patch },
    });
  }

  private patchYjsObject(id: string, patch: WallObjectPatch): void {
    const raw = this.objectsMap.get(id);
    if (!raw) return;

    try {
      const merged = { ...(JSON.parse(raw) as WallSceneObject), ...patch };
      this.suppressObjectObserver = true;
      this.doc.transact(() => {
        this.objectsMap.set(id, JSON.stringify(merged));
      });
      this.lastAppliedFingerprint = fingerprintSceneObjects(this.readObjects());
    } catch {
      /* skip malformed */
    } finally {
      this.suppressObjectObserver = false;
    }
  }

  /** Broadcast presence immediately (selection + cursor). */
  updatePresence(
    cursorX: number,
    cursorY: number,
    selectedObjectId?: string,
    isManipulating?: boolean,
  ): void {
    if (!this.channel || this.disposed) return;

    const state: WallPresenceState = {
      userId: this.options.userId,
      displayName: this.options.displayName,
      color: this.options.color,
      cursorX,
      cursorY,
      selectedObjectId: selectedObjectId || undefined,
      isManipulating: isManipulating ? true : undefined,
      updatedAt: Date.now(),
    };

    void this.channel.send({
      type: "broadcast",
      event: PRESENCE_EVENT,
      payload: state,
    });

    void this.channel.track(state);
  }

  private scheduleRemoteObjectsEmit(): void {
    if (this.remoteObjectsFlush || this.disposed) return;
    this.remoteObjectsFlush = true;

    requestAnimationFrame(() => {
      this.remoteObjectsFlush = false;
      if (this.disposed) return;
      this.options.onRemoteObjectsChange(this.readObjects());
    });
  }

  private syncPeersFromChannel(): void {
    if (!this.channel) return;

    const channelState = this.channel.presenceState<WallPresenceState>();

    for (const entries of Object.values(channelState)) {
      for (const peer of entries as WallPresenceState[]) {
        if (!peer?.userId || peer.userId === this.options.userId) continue;

        const existing = this.livePeers.get(peer.userId);
        const merged: WallPresenceState = {
          ...(existing ?? peer),
          ...peer,
          selectedObjectId: peer.selectedObjectId ?? existing?.selectedObjectId,
          isManipulating:
            peer.updatedAt >= (existing?.updatedAt ?? 0)
              ? peer.isManipulating
              : existing?.isManipulating,
          updatedAt: Math.max(peer.updatedAt ?? 0, existing?.updatedAt ?? 0),
        };

        if (!existing || merged.updatedAt >= existing.updatedAt) {
          this.livePeers.set(peer.userId, merged);
        }
      }
    }

    this.emitPeers();
  }

  private emitPeers(): void {
    const peers = dedupePresencePeers([...this.livePeers.values()]).filter(
      (p) => p.userId !== this.options.userId,
    );
    this.options.onPresenceChange(peers);
  }

  private enqueueBroadcast(update: Uint8Array): void {
    if (!this.subscribed || !this.channel) {
      this.pendingUpdates.push(update);
      return;
    }
    this.sendBroadcast(update);
  }

  private flushPendingBroadcasts(): void {
    if (!this.channel || !this.subscribed) return;
    for (const update of this.pendingUpdates) {
      this.sendBroadcast(update);
    }
    this.pendingUpdates = [];
  }

  private sendBroadcast(update: Uint8Array): void {
    if (!this.channel || !this.subscribed) return;
    void this.channel.send({
      type: "broadcast",
      event: BROADCAST_EVENT,
      payload: { update: Array.from(update) },
    });
  }

  dispose(): void {
    this.disposed = true;
    this.subscribed = false;
    this.livePeers.clear();
    void this.channel?.unsubscribe();
    this.doc.destroy();
  }
}
