# AGENTS.md

## Cursor Cloud specific instructions

PhotoWall is a single Next.js 15 app (React 19 + Konva/Pixi canvas + Supabase). There is no monorepo and no local database/Docker service — Supabase is a hosted cloud backend configured via env vars, not something you run locally.

### Running the app
- Dev server: `npm run dev` → http://localhost:3000 (Node 22; matches `.github/workflows/audit-gate.yml`).
- The app runs in **guest mode without Supabase**: with `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` blank (or absent), walls persist to `localStorage` and sharing falls back to base64 URL-encoding. A `.env.local` with those two vars left blank is enough to boot and test the core editor.
- Core guest smoke test (no login): open `/wall/edit` and add a text/tape/sticker element. This is the canonical "does it work" flow.
- Supabase-dependent features are **disabled** without real creds: Google login, cloud save + multi-device sync, `/shared/[id]` realtime collaboration, public DB walls `/wall/[id]`, social (likes/comments/guestbook), Storage uploads, and `/admin/*`. To exercise these, put a real Supabase project's URL + anon key (and `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_IDS`) in `.env.local` and run the `supabase/*.sql` migrations in the Supabase dashboard (order is in `.env.example`).

### Lint / typecheck / build
- Standard commands live in `package.json` scripts: `npm run lint`, `npm run typecheck`, `npm run build`.
- `npm run lint` reports ~40 warnings but **0 errors** — that is the expected clean state, not a regression.

### Verify scripts (gotchas)
- `npm run verify:wall-omni` runs fully offline (pure canvas math smoke test).
- `npm run verify:wall-realtime` and `npm run verify:supabase` require **live Supabase credentials** in `.env.local` and will fail without them — skip these when running guest-only.
- `npm run audit:gate` chains build + verify + `npm audit` + supabase verify; only run the full gate when Supabase creds are present.

### Not applicable in this environment
- `ecosystem.config.cjs` (PM2) and `scripts/start-production.sh` are for the production host (hardcoded `cwd: /home/kim/PhotoWall`) and require a prior `npm run build`; do not use them for dev.
