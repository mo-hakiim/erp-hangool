# erp-hangool

Hangool Construction ERP — React + TypeScript + Supabase.

## Phase 1 progress

- [x] **Stage 1 — database + security**: `supabase/migrations/` (58 tables, RLS on every table,
  approvals engine, double-entry ledger, audit log, private storage buckets), `supabase/schema.sql`
  (all migrations in one file, safe to re-run), `supabase/seed.sql` (demo data), `docs/erd.md` (ERD),
  `tests/db/` (36 security / approval / ledger tests).
- [x] **Stage 2 — foundation**: email + password sign-in, forgot / reset / change password,
  TOTP 2FA (setup, sign-in challenge, optional company-wide requirement), app shell with a role-based
  sidebar, notifications bell (live), user menu, phone layout, role guard on every page.
- [x] **Stage 3 — owner / CEO portal**: all 16 screens. Live: Projects (+ stages), Approvals Center,
  Notifications, Staff & roles (Edge Function `admin-staff`), Audit log, Settings. The rest use sample
  data from `src/demo/ownerDemo.ts` with a "Demo data" badge. Tables are searchable, filterable,
  exportable (Excel / PDF) and turn into cards on phones.

Setup and the security model: [docs/SETUP.md](docs/SETUP.md).

```
npm install
npm run dev        # app on http://localhost:5173   (needs VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local)
npm run build      # production build into dist/ (Vercel: framework "Vite", output "dist")
npm test           # unit tests (translations, menu by role)
npm run db:apply   # build + run supabase/schema.sql   (needs SUPABASE_DB_URL in .env.local)
npm run db:seed    # demo data — test project only
npm run db:test    # 36 database tests, each rolled back
```

## Folders

```
src/
  i18n/          en.ts (all UI text) + so.ts (Somali, same keys)
  lib/           supabase client, formatting
  auth/          AuthProvider (session, roles, permissions, 2FA state), sign-in / reset / 2FA screens
  app/           AppShell (sidebar, top bar, bell, user menu), nav.ts (menu + access rules), guards
  features/      notifications (live provider)
  pages/         account, notifications, home pages
  owner/         the 16 Owner / CEO screens
  demo/          ownerDemo.ts — ALL sample data in one file
  components/    ui, blocks, DataTable (search / filter / export / phone cards), charts
supabase/        migrations, schema.sql, seed.sql, functions/admin-staff
tests/db/        database security tests
docs/            erd.md, SETUP.md, earlier ERD HTML diagrams
```

## Earlier planning files

`docs/hangool-erd.html` (and its copy `docs/erd-diagram.html`): the first interactive entity relationship
diagram. Open it in a browser (needs internet for Mermaid). The up-to-date ERD is `docs/erd.md`.
