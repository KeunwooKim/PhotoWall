export async function createWallInvite(wallId: string): Promise<{ code: string; url: string }> {
  const res = await fetch("/api/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallId }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "초대 링크 생성에 실패했어요");
  }

  const invite = (await res.json()) as { code: string };
  const url = `${window.location.origin}/invite/${invite.code}`;
  return { code: invite.code, url };
}
