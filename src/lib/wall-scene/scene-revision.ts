/** Best-effort revision from a persisted wall scene JSON blob. */
export function sceneRevisionFromJson(canvasJson: unknown): number {
  if (!canvasJson || typeof canvasJson !== "object") return 0;

  const root = canvasJson as {
    meta?: { revision?: unknown };
    photowallScene?: { meta?: { revision?: unknown } };
  };

  // Persisted envelope is `{ photowallScene: { meta: { revision } } }`.
  // Older / in-memory docs may expose `meta.revision` at the top level.
  const rev = root.photowallScene?.meta?.revision ?? root.meta?.revision;
  return typeof rev === "number" && Number.isFinite(rev) ? rev : 0;
}
