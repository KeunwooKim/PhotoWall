import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { WallPresenceState, WallSceneObject } from "@/types/wall-scene-v2";
import { dedupePresencePeers, mergePeerPresence } from "@/lib/wall-scene/presence-utils";
import { throttle } from "@/lib/throttle";

const CHANNEL_PREFIX = "shared-wall";
const SYNC_EVENT = "wall-sync";

function channelTopic(wallId: string): string {
  return `${CHANNEL_PREFIX}:${wallId}`;
}

function isSyncPayload(value: Record<string, unknown>): value is SyncPayload {
  return (
    value.kind === "hello" ||
    value.kind === "full" ||
    (value.kind === "patch" && typeof value.id === "string" && !!value.patch)
  );
}

function unwrapBroadcastPayload<T extends SyncPayload>(message: unknown): T | null {
  if (!message || typeof message !== "object") return null;

  const queue: unknown[] = [message];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    const obj = current as Record<string, unknown>;
    if (isSyncPayload(obj)) return obj as T;

    if (obj.payload !== undefined) queue.push(obj.payload);
    if (obj.data !== undefined) queue.push(obj.data);
  }

  return null;
}

export type WallObjectPatch = Partial<
  Pick<WallSceneObject, "x" | "y" | "rotation" | "scaleX" | "scaleY" | "zIndex">
>;

type SyncPayload =
  | { kind: "hello"; sessionId: string; userId: string }
  | { kind: "full"; sessionId: string; userId: string; objects: WallSceneObject[] }
  | {
      kind: "patch";
      sessionId: string;
      userId: string;
      id: string;
      patch: WallObjectPatch;
    };

export interface WallRealtimeOptions {
  wallId: string;
  userId: string;
  sessionId: string;
  displayName: string;
  color: string;
  supabase: SupabaseClient;
  onRemoteFull: (objects: WallSceneObject[]) => void;
  onRemotePatch: (id: string, patch: WallObjectPatch) => void;
  onPresenceChange: (peers: WallPresenceState[]) => void;
  onSyncEvent?: (kind: SyncPayload["kind"]) => void;
  getLocalObjects: () => WallSceneObject[];
}

export class WallRealtimeSession {
  private channel: RealtimeChannel | null = null;
  private disposed = false;
  private reconnecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private livePeers = new Map<string, WallPresenceState>();
  private flushPresence: ReturnType<typeof throttle<(state: WallPresenceState) => void>>;

  constructor(private options: WallRealtimeOptions) {
    this.flushPresence = throttle((state: WallPresenceState) => {
      if (!this.channel || this.disposed || this.channel.state !== "joined") return;
      void this.channel.track(state);
    }, 50);
  }

  async connect(): Promise<void> {
    const { supabase, wallId } = this.options;
    const name = channelTopic(wallId);

    await this.removeStaleChannel(supabase, name);
    await this.openChannel();
  }

  announceJoin(): void {
    this.send({ kind: "hello", sessionId: this.options.sessionId, userId: this.options.userId });
  }

  broadcastPatch(id: string, patch: WallObjectPatch): void {
    this.send({
      kind: "patch",
      sessionId: this.options.sessionId,
      userId: this.options.userId,
      id,
      patch,
    });
  }

  broadcastFull(objects: WallSceneObject[]): void {
    this.sendFull(objects);
  }

  updatePresence(
    cursorX: number,
    cursorY: number,
    selectedObjectId?: string,
    isManipulating?: boolean,
    immediate = false,
  ): void {
    if (!this.channel || this.disposed) return;

    const state: WallPresenceState = {
      userId: this.options.userId,
      sessionId: this.options.sessionId,
      displayName: this.options.displayName,
      color: this.options.color,
      cursorX,
      cursorY,
      selectedObjectId: selectedObjectId || undefined,
      isManipulating: isManipulating ? true : undefined,
      updatedAt: Date.now(),
    };

    if (immediate) {
      this.flushPresence.flush();
      if (this.channel.state !== "joined") {
        this.scheduleReconnect();
        return;
      }
      void this.channel.track(state);
      return;
    }

    this.flushPresence(state);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.livePeers.clear();
    this.flushPresence.flush();

    const channel = this.channel;
    this.channel = null;

    if (channel) {
      await this.options.supabase.removeChannel(channel);
    }
  }

  private async openChannel(): Promise<RealtimeChannel> {
    const { supabase, wallId, userId, sessionId, displayName, color } = this.options;
    const name = channelTopic(wallId);

    const channel = supabase.channel(name, {
      config: {
        private: false,
        broadcast: { self: false, ack: false },
        presence: { key: `${userId}:${sessionId}` },
      },
    });

    this.channel = channel;
    this.bindHandlers(channel);

    await this.waitForSubscribe(channel, async () => {
      await channel.track({
        userId,
        sessionId,
        displayName,
        color,
        cursorX: 0,
        cursorY: 0,
        updatedAt: Date.now(),
      });
    });

    return channel;
  }

  private bindHandlers(channel: RealtimeChannel): void {
    const { sessionId } = this.options;

    const handleSyncMessage = (message: unknown) => {
      if (this.disposed) return;

      const msg = unwrapBroadcastPayload<SyncPayload>(message);
      if (!msg || msg.sessionId === sessionId) return;

      this.options.onSyncEvent?.(msg.kind);

      if (msg.kind === "hello") {
        this.sendFull(this.options.getLocalObjects());
        return;
      }

      if (msg.kind === "full") {
        this.options.onRemoteFull(msg.objects);
        return;
      }

      if (msg.kind === "patch") {
        this.options.onRemotePatch(msg.id, msg.patch);
      }
    };

    channel
      .on("broadcast", { event: SYNC_EVENT }, handleSyncMessage)
      .on("presence", { event: "sync" }, () => this.syncPeersFromChannel())
      .on("presence", { event: "join" }, () => this.syncPeersFromChannel())
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const departed = Object.values(leftPresences ?? {}).flat() as unknown as WallPresenceState[];
        for (const peer of departed) {
          if (peer?.userId) this.livePeers.delete(peer.userId);
        }
        this.emitPeers();
      });
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnecting || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.reconnect();
    }, 400);
  }

  private async reconnect(): Promise<void> {
    if (this.disposed || this.reconnecting) return;

    this.reconnecting = true;

    try {
      const old = this.channel;
      this.channel = null;
      if (old) {
        await this.options.supabase.removeChannel(old);
      }

      if (!this.options.supabase.realtime.isConnected()) {
        this.options.supabase.realtime.connect();
      }

      await this.openChannel();
    } catch {
      // Reconnect will be retried on the next CLOSED event or send.
    } finally {
      this.reconnecting = false;
    }
  }

  private async removeStaleChannel(supabase: SupabaseClient, name: string): Promise<number> {
    const topic = `realtime:${name}`;
    const stale = supabase.getChannels().filter((ch) => ch.topic === topic);
    await Promise.all(stale.map((ch) => supabase.removeChannel(ch)));
    return stale.length;
  }

  private async waitForSubscribe(
    channel: RealtimeChannel,
    onSubscribed: () => void | Promise<void>,
  ): Promise<void> {
    if (channel.state === "joined") {
      await onSubscribed();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      channel.subscribe(async (status, err) => {
        if (status === "SUBSCRIBED") {
          if (settled) return;
          try {
            await onSubscribed();
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
            return;
          }
          settled = true;
          resolve();
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (settled) return;
          const detail = err?.message ? `: ${err.message}` : "";
          reject(new Error(`Realtime channel ${status}${detail}`));
          return;
        }

        if (status === "CLOSED") {
          this.scheduleReconnect();
        }
      });
    });
  }

  private sendFull(objects: WallSceneObject[]): void {
    this.send({
      kind: "full",
      sessionId: this.options.sessionId,
      userId: this.options.userId,
      objects,
    });
  }

  private send(payload: SyncPayload): void {
    if (!this.channel || this.disposed) return;

    void this.deliverBroadcast(payload);
  }

  private async deliverBroadcast(payload: SyncPayload): Promise<void> {
    const channel = this.channel;
    if (!channel || this.disposed) return;

    const message = {
      type: "broadcast" as const,
      event: SYNC_EVENT,
      payload,
    };

    try {
      if (channel.state === "joined") {
        const result = await channel.send(message);
        if (result === "ok") return;
      }

      await channel.httpSend(SYNC_EVENT, payload);

      if (channel.state !== "joined") {
        this.scheduleReconnect();
      }
    } catch {
      this.scheduleReconnect();
    }
  }

  private syncPeersFromChannel(): void {
    if (!this.channel) return;

    const channelState = this.channel.presenceState<WallPresenceState>();

    for (const entries of Object.values(channelState)) {
      for (const peer of entries as WallPresenceState[]) {
        if (!peer?.userId || peer.sessionId === this.options.sessionId) continue;

        const existing = this.livePeers.get(peer.userId);
        this.livePeers.set(peer.userId, mergePeerPresence(existing, peer));
      }
    }

    this.emitPeers();
  }

  private emitPeers(): void {
    const peers = dedupePresencePeers([...this.livePeers.values()]).filter(
      (p) => p.sessionId !== this.options.sessionId,
    );
    this.options.onPresenceChange(peers);
  }
}
