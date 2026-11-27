# erp-hangool

Hangool Construction ERP — React + TypeScript + Supabase.

## Phase 1 progress

- [x] **Stage 1 — database + security**: `supabase/migrations/` (58 tables, RLS on every table,
  approvals engine, double-entry ledger, audit log, private storage buckets), `supabase/schema.sql`
  (all migrations in one file, safe to re-run), `supabase/seed.sql` (demo data), `docs/erd.md` (ERD),
  `tests/db/` (36 security / approval / ledger tests).
- [ ] Stage 2 — foundation (login, 2FA, app shell, role guard)
- [ ] Stage 3 — owner / CEO portal

Setup and the security model: [docs/SETUP.md](docs/SETUP.md).

```
npm install
npm run db:apply   # build + run supabase/schema.sql   (needs SUPABASE_DB_URL in .env.local)
npm run db:seed    # demo data — test project only
npm run db:test    # 36 tests, each rolled back
```

## Earlier planning files

- `index.html` and `hangool-erd.html` (the same file; `index.html` is what the live page opens): entity relationship diagram of the database. It shows all 39 tables, colour-coded by section (Access, Sales, Projects, Design, BOQ, Approvals, Procurement, Inventory, Site, Finance, HR, Client portal, Marketing), with primary keys, foreign keys, relationship lines and a notes panel listing the design assumptions.

## How to view the diagram

Live page: https://mo-hakiim.github.io/erp-hangool/

## Download

- **Diagram page (HTML):** [download hangool-erd.html](https://raw.githubusercontent.com/mo-hakiim/erp-hangool/main/hangool-erd.html) (right-click → *Save link as…*), then open it in any web browser.
- **Diagram image (SVG):** open the live page and click **Download diagram (SVG)**. It saves the diagram as shown, so pick a section first if you only want part of it.
- The live page also has a **Download page (HTML)** button.

You can also download `hangool-erd.html` and open it in any web browser. You don't need to install anything, but you do need internet, because the page loads Mermaid from a CDN to draw the diagram.

- Scroll or pinch to zoom, and drag to pan.
- Use the **Section** menu, or click a colour in the legend, to show one section and the tables linked to it.
