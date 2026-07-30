/** Best-effort revision from a persisted wall scene JSON blob. */
export function sceneRevisionFromJson(canvasJson: unknown): number {
  if (!canvasJson || typeof canvasJson !== "object") return 0;
  const meta = (canvasJson as { meta?: { revision?: unknown } }).meta;
  const rev = meta?.revision;
  return typeof rev === "number" && Number.isFinite(rev) ? rev : 0;
}
