/**
 * Fire-and-forget Discord webhook helpers.
 * Set DISCORD_WEBHOOK_URL (channel Integrations → Webhooks).
 */

function webhookUrl(): string | undefined {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  return url || undefined;
}

/** Escape Discord markdown special chars in user-controlled text. */
function escapeMd(text: string): string {
  return text.replace(/([\\*_`~|])/g, "\\$1").slice(0, 80);
}

export async function postDiscordMessage(content: string): Promise<void> {
  const url = webhookUrl();
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch {
    /* ops notify must never break the app */
  }
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

