import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

const CHANNEL_PREFIX = "personal-wall";
const TAKEOVER_EVENT = "editor-takeover";

export type TakeoverPayload = {
  sessionId: string;
  userId: string;
  claimedAt: number;
};

export type PersonalWallLeaseOptions = {
  wallId: string;
  userId: string;
  sessionId: string;
  supabase: SupabaseClient;
  onKicked: (from: TakeoverPayload) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
};

function channelTopic(wallId: string): string {
  return `${CHANNEL_PREFIX}:${wallId}`;
}

function isTakeoverPayload(value: Record<string, unknown>): value is TakeoverPayload {
  return (
    typeof value.sessionId === "string" &&
    typeof value.userId === "string" &&
    typeof value.claimedAt === "number"
  );
}

function unwrapPayload(message: unknown): TakeoverPayload | null {
  if (!message || typeof message !== "object") return null;
  const queue: unknown[] = [message];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    const obj = current as Record<string, unknown>;
    if (isTakeoverPayload(obj)) return obj;
    if (obj.payload !== undefined) queue.push(obj.payload);
    if (obj.data !== undefined) queue.push(obj.data);
  }
  return null;
}

type PresenceRoster = {
  userId: string;
  sessionId: string;
  claimedAt: number;
};

/**
 * Lightweight exclusive-editor lease for personal walls.
 * Newest session wins via broadcast takeover — no scene sync.
 */
export class PersonalWallLeaseSession {
  private channel: RealtimeChannel | null = null;
  private disposed = false;

  constructor(private options: PersonalWallLeaseOptions) {}

  async connect(): Promise<void> {
    const { supabase, wallId } = this.options;
    const name = channelTopic(wallId);

    await this.removeStaleChannel(supabase, name);
    await this.openChannel();
  }

  /** Claim editor for this tab and kick older same-user sessions. */
  claim(): void {
    if (!this.channel || this.disposed) return;
    const payload: TakeoverPayload = {
      sessionId: this.options.sessionId,
      userId: this.options.userId,
      claimedAt: Date.now(),
    };
    void this.channel.send({
      type: "broadcast",
      event: TAKEOVER_EVENT,
      payload,
    });
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    const channel = this.channel;
    this.channel = null;
    this.options.onDisconnected?.();
    if (channel) {
      await this.options.supabase.removeChannel(channel);
    }
  }

  private async openChannel(): Promise<void> {
    const { supabase, wallId, userId, sessionId } = this.options;
    const name = channelTopic(wallId);

    const channel = supabase.channel(name, {
      config: {
        private: false,
        broadcast: { self: false, ack: false },
        presence: { key: `${userId}:${sessionId}` },
      },
    });

    this.channel = channel;

    channel.on("broadcast", { event: TAKEOVER_EVENT }, (message) => {
      if (this.disposed) return;
      const payload = unwrapPayload(message);
      if (!payload) return;
      if (payload.userId !== this.options.userId) return;
      if (payload.sessionId === this.options.sessionId) return;
      this.options.onKicked(payload);
    });

    channel.on("presence", { event: "join" }, () => {
      // Another tab of the same user joined — re-assert claim so they get kicked if we are older.
      // Newest join will also broadcast claim after subscribe; this covers late joiners seeing us.
    });

    await this.waitForSubscribe(channel, async () => {
      const roster: PresenceRoster = {
        userId,
        sessionId,
        claimedAt: Date.now(),
      };
      await channel.track(roster);
      // Always claim on join — newest session wins.
      this.claim();
      this.options.onConnected?.();
    });
  }

  private async removeStaleChannel(supabase: SupabaseClient, name: string): Promise<void> {
    const topic = `realtime:${name}`;
    const stale = supabase.getChannels().filter((ch) => ch.topic === topic);
    await Promise.all(stale.map((ch) => supabase.removeChannel(ch)));
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
        }
      });
    });
  }
}
