const PALETTE = ["#e85d8f", "#4a90d9", "#7bc67e", "#f5a623", "#9b59b6", "#1a1a1a"];

export function presenceColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
