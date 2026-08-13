import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { WallBounds } from "@/lib/wall-bounds";
import type { PhotoDecoration, WallPresenceState, WallSceneObject } from "@/types/wall-scene-v2";
import { dedupePresencePeers, mergePeerPresence, presencePeerKey } from "@/lib/wall-scene/presence-utils";
import { throttle } from "@/lib/throttle";

const CHANNEL_PREFIX = "shared-wall";
const SYNC_EVENT = "wall-sync";
const PRESENCE_LIVE_EVENT = "wall-presence-live";

export type WallSyncMeta = {
  wallBounds: WallBounds;
  wallpaperOffset?: { x: number; y: number };
  wallSizeLocked?: boolean;
  wallShrinkEnabled?: boolean;
  /** Wallpaper theme — not part of canvas JSON; synced separately for live peers. */
  themeId?: string;
};

/** Live wall grow/shrink while a peer is dragging (not yet committed to store on sender). */
export type WallLiveSync = WallSyncMeta & {
  positions?: Array<{ id: string; x: number; y: number }>;
};

function channelTopic(wallId: string): string {
  return `${CHANNEL_PREFIX}:${wallId}`;
}

function isSyncPayload(value: Record<string, unknown>): boolean {
  return (
    value.kind === "hello" ||
    value.kind === "full" ||
    value.kind === "clear" ||
    value.kind === "saved" ||
    value.kind === "wall-live" ||
    value.kind === "theme" ||
    (value.kind === "remove" && Array.isArray(value.ids)) ||
    (value.kind === "patch" && typeof value.id === "string" && !!value.patch)
  );
}

function isPresenceLivePayload(value: Record<string, unknown>): boolean {
  return (
    typeof value.userId === "string" &&
    typeof value.displayName === "string" &&
    typeof value.color === "string" &&
    typeof value.cursorX === "number" &&
    typeof value.cursorY === "number" &&
    typeof value.updatedAt === "number"
  );
}

function unwrapBroadcastPayload<T>(
  message: unknown,
  guard: (value: Record<string, unknown>) => boolean,
): T | null {
  if (!message || typeof message !== "object") return null;

  const queue: unknown[] = [message];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    const obj = current as Record<string, unknown>;
    if (guard(obj)) return obj as T;

    if (obj.payload !== undefined) queue.push(obj.payload);
    if (obj.data !== undefined) queue.push(obj.data);
  }

  return null;
}

export type WallObjectPatch = Partial<
  Pick<WallSceneObject, "x" | "y" | "rotation" | "scaleX" | "scaleY" | "zIndex">
> & {
  /** Set to null to remove group membership on peers */
  groupId?: string | null;
  /** Text wrap width (baked from horizontal resize). */
  width?: number;
  /** Text / emoji font size (baked from vertical or uniform resize). */
  fontSize?: number;
  /** Photo frame catalog id. null clears. */
  frameId?: string | null;
  /** Photo corner decorations. null clears. */
  decorations?: PhotoDecoration[] | null;
};

type SyncPayload =
  | { kind: "hello"; sessionId: string; userId: string }
  | {
      kind: "full";
      sessionId: string;
      userId: string;
      objects: WallSceneObject[];
      wallBounds?: WallBounds;
      wallpaperOffset?: { x: number; y: number };
      wallSizeLocked?: boolean;
      wallShrinkEnabled?: boolean;
      themeId?: string;
    }
  | { kind: "clear"; sessionId: string; userId: string }
  | {
      kind: "remove";
      sessionId: string;
      userId: string;
      ids: string[];
    }
  | {
      kind: "theme";
      sessionId: string;
      userId: string;
      themeId: string;
    }
  | {
      kind: "saved";
      sessionId: string;
      userId: string;
      revision: number;
    }
  | {
      kind: "wall-live";
      sessionId: string;
      userId: string;
      wallBounds: WallBounds;
      wallpaperOffset?: { x: number; y: number };
      wallSizeLocked?: boolean;
      wallShrinkEnabled?: boolean;
      positions?: Array<{ id: string; x: number; y: number }>;
    }
  | {
      kind: "patch";
      sessionId: string;
      userId: string;
      id: string;
      patch: WallObjectPatch;
    };

/** Identity-only presence track — cursor/selection travel on broadcast. */
type PresenceRosterState = Pick<
  WallPresenceState,
  "userId" | "sessionId" | "displayName" | "color" | "updatedAt"
>;

export interface WallRealtimeOptions {
  wallId: string;
  userId: string;
  sessionId: string;
  displayName: string;
  color: string;
  supabase: SupabaseClient;
  onRemoteFull: (objects: WallSceneObject[], meta?: WallSyncMeta) => void;
  onRemoteClear: () => void;
  onRemoteRemove?: (ids: string[]) => void;
  onRemoteTheme?: (themeId: string) => void;
  onRemotePatch: (id: string, patch: WallObjectPatch) => void;
  /** Peer is live-expanding the wall while dragging. */
  onRemoteWallLive?: (live: WallLiveSync) => void;
  /** Peer persisted successfully — keep OCC baseRevision in sync without reloading. */
  onRemoteSaved?: (revision: number) => void;
  onPresenceChange: (peers: WallPresenceState[]) => void;
  onSyncEvent?: (kind: SyncPayload["kind"]) => void;
  getLocalObjects: () => WallSceneObject[];
  getLocalMeta: () => WallSyncMeta;
}

export class WallRealtimeSession {
  private channel: RealtimeChannel | null = null;
  private disposed = false;
  private reconnecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private livePeers = new Map<string, WallPresenceState>();
  private lastLivePresence: WallPresenceState | null = null;
  private flushPresenceLive: ReturnType<typeof throttle<(state: WallPresenceState) => void>>;

  constructor(private options: WallRealtimeOptions) {
    this.flushPresenceLive = throttle((state: WallPresenceState) => {
      void this.deliverPresenceLive(state);
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

  broadcastFull(objects: WallSceneObject[], meta?: WallSyncMeta): void {
    this.sendFull(objects, meta ?? this.options.getLocalMeta());
  }

  broadcastClear(): void {
    this.send({
      kind: "clear",
      sessionId: this.options.sessionId,
      userId: this.options.userId,
    });
  }

  /** Lightweight delete sync — full scene broadcast can drop on Realtime size limits. */
  broadcastRemove(ids: string[]): void {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return;
    this.send({
      kind: "remove",
      sessionId: this.options.sessionId,
      userId: this.options.userId,
      ids: unique,
    });
  }

  /** Wallpaper / theme change — not in canvas JSON, so needs its own sync. */
  broadcastTheme(themeId: string): void {
    const id = themeId.trim();
    if (!id) return;
    this.send({
      kind: "theme",
      sessionId: this.options.sessionId,
      userId: this.options.userId,
      themeId: id,
    });
  }

  /** Tell peers the DB revision advanced so their OCC base stays fresh. */
  broadcastSaved(revision: number): void {
    if (!Number.isFinite(revision)) return;
    this.send({
      kind: "saved",
      sessionId: this.options.sessionId,
      userId: this.options.userId,
      revision,
    });
  }

  /** Live wall bounds while dragging — peers see smooth expand before commit. */
  broadcastWallLive(live: WallLiveSync): void {
    this.send({
      kind: "wall-live",
      sessionId: this.options.sessionId,
      userId: this.options.userId,
      wallBounds: live.wallBounds,
      wallpaperOffset: live.wallpaperOffset,
      wallSizeLocked: live.wallSizeLocked,
      wallShrinkEnabled: live.wallShrinkEnabled,
      positions: live.positions,
    });
  }

  updatePresence(
    cursorX: number,
    cursorY: number,
    selectedObjectIds?: string[],
    isManipulating?: boolean,
    immediate = false,
  ): void {
    if (!this.channel || this.disposed) return;

    const ids = selectedObjectIds?.filter(Boolean) ?? [];

    const state: WallPresenceState = {
      userId: this.options.userId,
      sessionId: this.options.sessionId,
      displayName: this.options.displayName,
      color: this.options.color,
      cursorX,
      cursorY,
      selectedObjectIds: ids.length > 0 ? ids : undefined,
      selectedObjectId: ids.length > 0 ? ids[ids.length - 1] : undefined,
      isManipulating: isManipulating ? true : undefined,
      updatedAt: Date.now(),
    };
    this.lastLivePresence = state;

    if (immediate) {
      this.flushPresenceLive.flush();
      void this.deliverPresenceLive(state);
      return;
    }

    this.flushPresenceLive(state);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.livePeers.clear();
    this.flushPresenceLive.flush();

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
      const roster: PresenceRosterState = {
        userId,
        sessionId,
        displayName,
        color,
        updatedAt: Date.now(),
      };
      await channel.track(roster);
    });

    return channel;
  }

  private bindHandlers(channel: RealtimeChannel): void {
    const { sessionId } = this.options;

    const handleSyncMessage = (message: unknown) => {
      if (this.disposed) return;

      const msg = unwrapBroadcastPayload<SyncPayload>(message, isSyncPayload);
      if (!msg || msg.sessionId === sessionId) return;

      this.options.onSyncEvent?.(msg.kind);

      if (msg.kind === "hello") {
        this.sendFull(this.options.getLocalObjects(), this.options.getLocalMeta());
        if (this.lastLivePresence) {
          void this.deliverPresenceLive({
            ...this.lastLivePresence,
            updatedAt: Date.now(),
          });
        }
        return;
      }

      if (msg.kind === "full") {
        const meta =
          msg.wallBounds != null
            ? {
                wallBounds: msg.wallBounds,
                wallpaperOffset: msg.wallpaperOffset,
                wallSizeLocked: msg.wallSizeLocked,
                wallShrinkEnabled: msg.wallShrinkEnabled,
                themeId: msg.themeId,
              }
            : undefined;
        this.options.onRemoteFull(msg.objects, meta);
        if (typeof msg.themeId === "string" && msg.themeId) {
          this.options.onRemoteTheme?.(msg.themeId);
        }
        return;
      }

      if (msg.kind === "clear") {
        this.options.onRemoteClear();
        return;
      }

      if (msg.kind === "remove") {
        const ids = Array.isArray(msg.ids)
          ? msg.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
          : [];
        if (ids.length > 0) this.options.onRemoteRemove?.(ids);
        return;
      }

      if (msg.kind === "theme") {
        if (typeof msg.themeId === "string" && msg.themeId) {
          this.options.onRemoteTheme?.(msg.themeId);
        }
        return;
      }

      if (msg.kind === "saved") {
        if (typeof msg.revision === "number" && Number.isFinite(msg.revision)) {
          this.options.onRemoteSaved?.(msg.revision);
        }
        return;
      }

      if (msg.kind === "wall-live") {
        this.options.onRemoteWallLive?.({
          wallBounds: msg.wallBounds,
          wallpaperOffset: msg.wallpaperOffset,
          wallSizeLocked: msg.wallSizeLocked,
          wallShrinkEnabled: msg.wallShrinkEnabled,
          positions: msg.positions,
        });
        return;
      }

      if (msg.kind === "patch") {
        this.options.onRemotePatch(msg.id, msg.patch);
      }
    };

    const handlePresenceLive = (message: unknown) => {
      if (this.disposed) return;

      const peer = unwrapBroadcastPayload<WallPresenceState>(message, isPresenceLivePayload);
      if (!peer?.userId || peer.sessionId === sessionId) return;

      const key = presencePeerKey(peer);
      const existing = this.livePeers.get(key);
      this.livePeers.set(key, mergePeerPresence(existing, peer));
      this.emitPeers();
    };

    channel
      .on("broadcast", { event: SYNC_EVENT }, handleSyncMessage)
      .on("broadcast", { event: PRESENCE_LIVE_EVENT }, handlePresenceLive)
      .on("presence", { event: "sync" }, () => this.syncPeersFromChannel())
      .on("presence", { event: "join" }, () => this.syncPeersFromChannel())
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const departed = Object.values(leftPresences ?? {}).flat() as unknown as PresenceRosterState[];
        for (const peer of departed) {
          if (!peer?.userId) continue;
          this.livePeers.delete(presencePeerKey(peer));
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

  private sendFull(objects: WallSceneObject[], meta: WallSyncMeta): void {
    this.send({
      kind: "full",
      sessionId: this.options.sessionId,
      userId: this.options.userId,
      objects,
      wallBounds: meta.wallBounds,
      wallpaperOffset: meta.wallpaperOffset,
      wallSizeLocked: meta.wallSizeLocked,
      wallShrinkEnabled: meta.wallShrinkEnabled,
      themeId: meta.themeId,
    });
  }

  private send(payload: SyncPayload): void {
    if (!this.channel || this.disposed) return;

    void this.deliverBroadcast(SYNC_EVENT, payload);
  }

  private async deliverPresenceLive(state: WallPresenceState): Promise<void> {
    if (!this.channel || this.disposed) return;

    if (this.channel.state !== "joined") {
      this.scheduleReconnect();
      return;
    }

    await this.deliverBroadcast(PRESENCE_LIVE_EVENT, state);
  }

  private async deliverBroadcast(event: string, payload: object): Promise<void> {
    const channel = this.channel;
    if (!channel || this.disposed) return;

    const message = {
      type: "broadcast" as const,
      event,
      payload,
    };

    try {
      if (channel.state === "joined") {
        const result = await channel.send(message);
        if (result === "ok") return;
      }

      await channel.httpSend(event, payload);

      if (channel.state !== "joined") {
        this.scheduleReconnect();
      }
    } catch {
      this.scheduleReconnect();
    }
  }

  /** Presence = who is online. Cursor/selection come from broadcast live updates. */
  private syncPeersFromChannel(): void {
    if (!this.channel) return;

    const channelState = this.channel.presenceState<PresenceRosterState>();
    const onlineKeys = new Set<string>();

    for (const entries of Object.values(channelState)) {
      for (const peer of entries as PresenceRosterState[]) {
        if (!peer?.userId || peer.sessionId === this.options.sessionId) continue;

        const key = presencePeerKey(peer);
        onlineKeys.add(key);
        const existing = this.livePeers.get(key);
        this.livePeers.set(key, {
          userId: peer.userId,
          sessionId: peer.sessionId,
          displayName: peer.displayName,
          color: peer.color,
          cursorX: existing?.cursorX ?? 0,
          cursorY: existing?.cursorY ?? 0,
          selectedObjectIds: existing?.selectedObjectIds,
          selectedObjectId: existing?.selectedObjectId,
          isManipulating: existing?.isManipulating,
          updatedAt: existing?.updatedAt ?? peer.updatedAt ?? Date.now(),
        });
      }
    }

    for (const key of [...this.livePeers.keys()]) {
      if (!onlineKeys.has(key)) {
        this.livePeers.delete(key);
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
