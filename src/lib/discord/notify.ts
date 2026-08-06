/**
 * Fire-and-forget Discord webhook helpers.
 * Set DISCORD_WEBHOOK_URL (channel Integrations → Webhooks).
 * Must also be set on Vercel for production alerts.
 */

export type DiscordPostResult = {
  ok: boolean;
  configured: boolean;
  status?: number;
  error?: string;
};

type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
};

type DiscordWebhookBody = {
  content?: string;
  embeds?: DiscordEmbed[];
};

function webhookUrl(): string | undefined {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  return url || undefined;
}

/** Escape Discord markdown special chars in user-controlled text. */
export function escapeMd(text: string): string {
  return text.replace(/([\\*_`~|])/g, "\\$1").slice(0, 80);
}

export async function postDiscordPayload(body: DiscordWebhookBody): Promise<DiscordPostResult> {
  const url = webhookUrl();
  if (!url) {
    return { ok: false, configured: false, error: "DISCORD_WEBHOOK_URL is not set" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        configured: true,
        status: res.status,
        error: text.slice(0, 200) || `HTTP ${res.status}`,
      };
    }
    return { ok: true, configured: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

export async function postDiscordMessage(content: string): Promise<DiscordPostResult> {
  return postDiscordPayload({ content });
}

export function notifyNewUser(input: {
  displayName: string;
  userId: string;
}): void {
  const name = escapeMd(input.displayName || "친구");
  const shortId = input.userId.slice(0, 8);
  void postDiscordMessage(`🆕 신규 가입 · **${name}** (\`${shortId}…\`)`);
}

export function notifyAbuseReport(input: {
  subject: string;
  wallId?: string | null;
  reporterId: string;
}): void {
  const subject = escapeMd(input.subject);
  const wall = input.wallId ? ` · wall \`${input.wallId.slice(0, 8)}…\`` : "";
  const who = input.reporterId.slice(0, 8);
  void postDiscordMessage(`🚨 신고 · **${subject}**${wall} (by \`${who}…\`)`);
}

export function notifyAccountRestricted(input: {
  userId: string;
  restricted: boolean;
  reason?: string | null;
}): void {
  const id = input.userId.slice(0, 8);
  if (input.restricted) {
    const reason = input.reason ? ` · ${escapeMd(input.reason)}` : "";
    void postDiscordMessage(`⛔ 계정 제한 · \`${id}…\`${reason}`);
  } else {
    void postDiscordMessage(`✅ 계정 제한 해제 · \`${id}…\``);
  }
}

/** True when auth user was created recently (first OAuth callback after signup). */
export function isLikelyNewAuthUser(createdAt: string | undefined, windowMs = 15 * 60 * 1000): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < windowMs;
}
