# Hangool ERP — setup

## 1. Database (Supabase)

You need a Supabase project (`hangool-erp`). Everything below uses only the SQL editor or the
`scripts/db.mjs` helper on your computer.

### Option A — SQL editor (no tools needed)
1. Supabase dashboard → **SQL editor** → New query.
2. Paste all of `supabase/schema.sql` → **Run**. It is safe to run again later (after updates).
3. Test project only: paste `supabase/seed.sql` → **Run** to load demo data and demo logins.
4. Optional but recommended: **Database → Extensions → pg_cron** on, then run `schema.sql` once more
   so the daily "mark overdue invoices" job is scheduled.

### Option B — from your computer
1. Copy `.env.example` to `.env.local` and set `SUPABASE_DB_URL`
   (dashboard → **Connect** → *Session pooler* → URI, with your database password).
   `.env.local` is git-ignored — never commit it.
2. `npm install`
3. `npm run db:apply` — builds `supabase/schema.sql` from `supabase/migrations/` and runs it.
4. `npm run db:seed` — demo data (test project only).
5. `npm run db:test` — security and approval tests. Each test runs in a transaction that is rolled back,
   so nothing is left behind. They need the seed data.

### Auth settings (dashboard → Authentication)
- **Providers → Email**: enabled. Turn **off** "Allow new users to sign up" — staff and clients are
  invited by the owner only.
- **Multi-Factor**: enable **TOTP**. Once a staff member has verified a TOTP factor, the database
  refuses their data until they sign in with the code (session `aal2`).
- **URL configuration**: set the Site URL to the app address and add `/reset-password` as a redirect URL.

- **Require 2FA for all staff** (optional): set `require_staff_2fa` to `true` in the `settings`
  table (the Settings screen in stage 3 has a switch). Staff without 2FA are then sent to the setup
  screen right after signing in. Clients are never forced.

## 2. App (React + Vite)

1. `.env.local` (git-ignored) needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (dashboard → Project Settings → API; the publishable / anon key is meant for browsers).
2. `npm install` then `npm run dev` → http://localhost:5173
3. Supabase → Authentication → URL configuration: add `http://localhost:5173/reset-password`
   and, later, `https://<your-vercel-domain>/reset-password` to the redirect URLs so password-reset
   emails land on the reset screen.
4. **Vercel**: import the repo, framework "Vite", build `npm run build`, output `dist`, and add the two
   `VITE_…` variables in Project → Settings → Environment Variables. `vercel.json` sends every route
   to the app.

## 3. Edge Function `admin-staff` (Staff & roles: invite, switch off / on)

The function uses the `service_role` key, which Supabase gives to every Edge Function automatically
(`SUPABASE_SERVICE_ROLE_KEY`). You do **not** add it anywhere — not in `.env.local`, not in the repo,
not in Vercel. The function first checks that the caller is the owner, and does every database write
as the owner (so RLS and the audit log still apply). Only the Auth admin calls (invite, ban) use the key.

Deploy it once (either way works):

- **Dashboard**: Edge Functions → *Deploy a new function* → *Via editor* → name it `admin-staff` →
  paste `supabase/functions/admin-staff/index.ts` → *Deploy*. Keep "Verify JWT" **on**.
- **CLI** (from the repo folder):
  ```
  npx supabase login
  npx supabase functions deploy admin-staff --project-ref <your-project-ref>
  ```

Then, in Authentication → URL configuration, make sure `/reset-password` on your app address is an
allowed redirect URL — invite emails send people there to choose their password.
For real use, set up your own SMTP under Authentication → Emails (Supabase's built-in sender is
rate-limited and meant for testing).

Until the function is deployed, the Staff & roles screen still lists people and changes roles
(those go through the database directly); inviting and switching accounts off show a clear message.

## 4. What is live and what is sample data (Owner portal)

| Screen | Data |
|---|---|
| Projects (list, create, detail, stages add / edit / delete / request completion, BOQ, reports, documents, financials) | **Live** |
| Approvals Center (pending, history, approve, reject with reason) | **Live** |
| Notifications (bell, page, mark as read, live updates) | **Live** |
| Staff & roles (list, roles, invite, switch off / on) | **Live** (invite / switch off need the Edge Function) |
| Audit log (filters, before / after) | **Live** |
| Settings (company, two-approval limit, currency, require 2FA, default stages) | **Live** |
| Overview | Sample data, except *Pending approvals* and *Latest notifications* (live) |
| Finance, Clients & CRM, Procurement, Inventory, HR & Attendance, Real estate, Marketing, Reports, Documents | Sample data |

Every sample card or page shows a purple **Demo data** badge. All sample values live in one file,
`src/demo/ownerDemo.ts`; to make a screen live, replace its import from that file with a Supabase
query that returns the same shape (the tables already exist — see `docs/erd.md`).

### Demo staff accounts (@hangooldevelopment.com)
`node scripts/create-demo-staff.mjs` creates or refreshes 7 confirmed staff accounts (Owner, General
manager, Site engineer, Quantity surveyor, Architect, Marketing, Finance) without sending any email.
Their shared password is `DEMO_STAFF_PASSWORD` in `.env.local` (git-ignored, never commit it).

### Demo logins (seed only)
All demo users share the test password written at the top of `supabase/seed.sql`.
Emails are `owner@demo.hangool.test`, `finance@demo.hangool.test`, `client.a@demo.hangool.test`, etc.
Delete these users (Authentication → Users) before real use.

### Making the first real owner
1. Authentication → Users → **Invite user** with the owner's email.
2. SQL editor:
   ```sql
   insert into public.user_roles (user_id, role_id)
   select u.id, r.id from auth.users u, public.roles r
   where u.email = 'OWNER-EMAIL-HERE' and r.code = 'owner';
   ```
After that, the owner adds everyone else from **Staff & Roles** in the app.

## Security model (short)
- Row Level Security is on for every table. Policies use `role_permissions`
  (role × area → read/write, all/assigned projects). The owner can do everything.
- Project roles (PM, engineers, supervisor, QS, architect) only see projects where they are the manager
  or a project member. Clients only see their own client record, projects and what is shared with them.
- Approval-only statuses (approved/verified/rejected …) can only be set by `decide_approval`.
  Nobody can approve their own request: that step is skipped and the next approver decides; if every
  step is skipped, the owner (or the general manager, if the requester is the owner) decides.
  Payments, purchases and expenses above `payment_two_approval_threshold` need finance **and** owner,
  and one person cannot approve two steps of the same request.
- The `service_role` key is never used in the app or stored in the repo. It exists only as a
  Supabase Edge Function secret (stage 2/3, Staff & Roles invitations).
