/**
 * Fire-and-forget Discord webhook helpers.
 * - DISCORD_WEBHOOK_URL — 운영 알림 (가입, 오류 등)
 * - DISCORD_INQUIRY_WEBHOOK_URL — 문의·신고 전용 (없으면 DISCORD_WEBHOOK_URL 사용)
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
  url?: string;
};

type DiscordWebhookBody = {
  content?: string;
  embeds?: DiscordEmbed[];
};

function opsWebhookUrl(): string | undefined {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  return url || undefined;
}

function inquiryWebhookUrl(): string | undefined {
  const inquiry = process.env.DISCORD_INQUIRY_WEBHOOK_URL?.trim();
  if (inquiry) return inquiry;
  return opsWebhookUrl();
}

/** Escape Discord markdown special chars in user-controlled text. */
export function escapeMd(text: string): string {
  return text.replace(/([\\*_`~|])/g, "\\$1").slice(0, 80);
}

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function embedBodyBlock(text: string, max = 900): string {
  const safe = text.replace(/```/g, "'''").trim();
  return `\`\`\`\n${clip(safe, max)}\n\`\`\``;
}

async function postToWebhook(
  url: string | undefined,
  body: DiscordWebhookBody,
): Promise<DiscordPostResult> {
  if (!url) {
    return { ok: false, configured: false, error: "Discord webhook URL is not set" };
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

export async function postDiscordPayload(body: DiscordWebhookBody): Promise<DiscordPostResult> {
  return postToWebhook(opsWebhookUrl(), body);
}

export async function postInquiryDiscordPayload(body: DiscordWebhookBody): Promise<DiscordPostResult> {
  return postToWebhook(inquiryWebhookUrl(), body);
}

export async function postDiscordMessage(content: string): Promise<DiscordPostResult> {
  return postDiscordPayload({ content });
}

export function isInquiryWebhookConfigured(): boolean {
  return Boolean(inquiryWebhookUrl());
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

export function notifyBusinessInquiry(input: {
  subject: string;
  userId: string;
  email?: string | null;
}): void {
  const subject = escapeMd(input.subject);
  const who = input.userId.slice(0, 8);
  const email = input.email ? ` · ${escapeMd(input.email)}` : "";
  void postDiscordMessage(`💼 Plus·제휴 문의 · **${subject}** (by \`${who}…\`${email})`);
}

const INQUIRY_EMBED_COLOR: Record<string, number> = {
  general: 0x3b82f6,
  bug: 0xf59e0b,
  feature: 0x8b5cf6,
  abuse: 0xef4444,
  business: 0x10b981,
};

const INQUIRY_EMBED_EMOJI: Record<string, string> = {
  general: "💬",
  bug: "🐛",
  feature: "💡",
  abuse: "🚨",
  business: "💼",
};

export function notifyInquiry(input: {
  id: string;
  category: string;
  categoryLabel: string;
  subject: string;
  body: string;
  userId: string;
  email?: string | null;
  relatedWallId?: string | null;
  adminUrl: string;
}): void {
  const emoji = INQUIRY_EMBED_EMOJI[input.category] ?? "📩";
  const color = INQUIRY_EMBED_COLOR[input.category] ?? 0x6b7280;
  const shortUser = input.userId.slice(0, 8);

  const fields: DiscordEmbed["fields"] = [
    { name: "유형", value: input.categoryLabel, inline: true },
    { name: "유저", value: `\`${shortUser}…\``, inline: true },
  ];

  if (input.email) {
    fields.push({ name: "이메일", value: clip(input.email, 200), inline: true });
  }
  if (input.relatedWallId) {
    fields.push({
      name: "관련 벽",
      value: `\`${input.relatedWallId.slice(0, 8)}…\``,
      inline: true,
    });
  }

  fields.push({ name: "내용", value: embedBodyBlock(input.body) });

  void postInquiryDiscordPayload({
    content: `${emoji} **새 문의** · ${escapeMd(input.subject)}`,
    embeds: [
      {
        title: clip(input.subject, 200),
        color,
        fields,
        url: input.adminUrl,
        footer: { text: `문의 ID ${input.id.slice(0, 8)}… · 관리자에서 열기` },
      },
    ],
  });
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
