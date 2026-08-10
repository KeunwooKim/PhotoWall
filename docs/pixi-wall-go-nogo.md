# PixiJS Wall Editor — Phase 0 Go/No-Go

Date: 2026-08-08  
Spike route: `/dev/pixi-wall`  
Default renderer: `NEXT_PUBLIC_WALL_RENDERER=pixi` (rollback: `konva`)

## Decision: **GO (provisional)**

Proceed with Pixi as the default wall renderer behind production wiring, with Konva retained as rollback.

### Evidence from spike / architecture

| Criterion | Result |
|-----------|--------|
| Viewport-sized WebGL canvas (not wall-sized Canvas2D) | Implemented in `PixiWallEngine` |
| DIY transform handles (scale + rotate) | Implemented |
| Display texture LOD (`loadDisplayBitmap` + max edge) | Implemented |
| `resolution` cap (`pixi-device`) | Implemented |
| Extract / preview path | `getExportAdapter().toDataURL` + `wall-preview` StageLike |
| Node registry abstracted (`WallDisplayNode`) | Shared + shared walls live patch compatible |
| Object types photo / sticker / emoji / text / tape / path | Pixi builders present |
| Pen hit fat stroke | Invisible wide hit stroke on paths |

### Manual QA still required (iPhone Safari)

- [ ] Open `/dev/pixi-wall` on iPhone Safari — pan/zoom/drag 3–5 min with 24 photos on ≥2217×1700 world
- [ ] Confirm no “문제 반복” / tab kill
- [ ] Open `/wall/edit` with default Pixi — load real wall, drag, pen, shared 2-browser
- [ ] Preview/share JPEG still uploads
- [ ] Rollback: set `NEXT_PUBLIC_WALL_RENDERER=konva`, rebuild, confirm Konva path

### Known gaps (tracked, not blockers for GO)

- Full Konva `PhotoCropOverlay` parity (blur/clip/nested transformer) — crop entry selects photo; toolbar crop still Konva-era UX incomplete on Pixi
- Presence cursors use Pixi viewport mapping (separate overlay)
- Marquee multi-select not yet in Pixi stage (Shift+click additive works)
- Snap guides UI lines not drawn in Pixi overlay yet (snap math still applies on drag)
- Export of full huge walls should keep capped `pixelRatio` (preview already caps)

### No-Go would have been

- Jetsam with LOD on max wall during spike, or transform UX unusable, or extract/CORS blocked.

---

**Rollback:** `NEXT_PUBLIC_WALL_RENDERER=konva` then rebuild/restart.
