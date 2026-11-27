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
