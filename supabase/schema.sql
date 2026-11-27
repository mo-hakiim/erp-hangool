-- ============================================================================
-- Hangool ERP · full schema (generated from supabase/migrations by scripts/db.mjs build).
-- Do not edit by hand. Safe to re-run on the same database.
-- ============================================================================

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261127000100_core.sql
-- ============================================================================
-- Hangool ERP · 0100 · Core: roles, profiles, permissions, helpers, settings,
-- notifications, audit log.
-- Every statement is safe to re-run.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- utilities

-- Create an enum type only if it does not exist yet; add any missing values.
create or replace function public._ensure_enum(type_name text, labels text[])
returns void language plpgsql as $$
declare l text;
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = type_name) then
    execute format('create type public.%I as enum (%s)', type_name,
      (select string_agg(quote_literal(x), ', ') from unnest(labels) x));
  else
    foreach l in array labels loop
      execute format('alter type public.%I add value if not exists %L', type_name, l);
    end loop;
  end if;
end $$;

-- (Re)create a policy: drop it if it exists, then create it.
create or replace function public._policy(
  tbl text, pol text, cmd text, using_expr text default null, check_expr text default null)
returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on public.%I', pol, tbl);
  execute format('create policy %I on public.%I for %s to authenticated %s %s',
    pol, tbl, cmd,
    case when using_expr is not null then 'using (' || using_expr || ')' else '' end,
    case when check_expr is not null then 'with check (' || check_expr || ')' else '' end);
end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- enums

select public._ensure_enum('audit_action', array['create','update','delete','approve','reject','role_change']);
select public._ensure_enum('perm_scope',   array['all','assigned']);

-- ---------------------------------------------------------------- roles

create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  is_staff    boolean not null default true,
  description text,
  permissions jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into public.roles (code, name, is_staff) values
  ('owner','Owner / CEO',true),
  ('general_manager','General Manager',true),
  ('finance','Finance',true),
  ('accountant','Accountant',true),
  ('hr','Human Resources',true),
  ('procurement','Procurement',true),
  ('storekeeper','Storekeeper',true),
  ('project_manager','Project Manager',true),
  ('site_engineer','Site Engineer',true),
  ('site_supervisor','Site Supervisor',true),
  ('qs','Quantity Surveyor',true),
  ('architect','Architect',true),
  ('marketing','Marketing',true),
  ('real_estate_officer','Real Estate Officer',true),
  ('employee','Employee',true),
  ('client','Client',false)
on conflict (code) do update set name = excluded.name, is_staff = excluded.is_staff;

-- Permission matrix: which role may read / write which area, and whether for
-- all records ('all') or only projects the person is assigned to ('assigned').
-- The owner is allowed everything by is_owner() regardless of this table.
create table if not exists public.role_permissions (
  role_code text not null references public.roles(code) on update cascade on delete cascade,
  area      text not null,
  can_write boolean not null default false,
  scope     public.perm_scope not null default 'all',
  primary key (role_code, area)
);

-- Rebuild the default matrix (owner may change it later; re-running restores defaults
-- only for rows that are listed here).
insert into public.role_permissions (role_code, area, can_write, scope)
select r, a, w, s::public.perm_scope from (values
  -- general manager: everything except managing staff/settings
  ('general_manager','projects',true,'all'),('general_manager','design',true,'all'),
  ('general_manager','boq',true,'all'),('general_manager','site',true,'all'),
  ('general_manager','procurement',true,'all'),('general_manager','inventory',true,'all'),
  ('general_manager','finance',true,'all'),('general_manager','accounting',true,'all'),
  ('general_manager','payroll',true,'all'),('general_manager','hr',true,'all'),
  ('general_manager','crm',true,'all'),('general_manager','marketing',true,'all'),
  ('general_manager','real_estate',true,'all'),('general_manager','documents',true,'all'),
  ('general_manager','approvals',true,'all'),('general_manager','reports',false,'all'),
  ('general_manager','staff',false,'all'),('general_manager','audit',false,'all'),
  ('general_manager','settings',false,'all'),
  -- finance
  ('finance','finance',true,'all'),('finance','accounting',true,'all'),('finance','payroll',true,'all'),
  ('finance','projects',false,'all'),('finance','boq',false,'all'),('finance','procurement',false,'all'),
  ('finance','inventory',false,'all'),('finance','real_estate',false,'all'),('finance','crm',false,'all'),
  ('finance','reports',false,'all'),('finance','documents',true,'assigned'),('finance','approvals',false,'all'),
  -- accountant
  ('accountant','finance',true,'all'),('accountant','accounting',true,'all'),('accountant','payroll',false,'all'),
  ('accountant','projects',false,'all'),('accountant','procurement',false,'all'),
  ('accountant','reports',false,'all'),('accountant','documents',true,'assigned'),
  -- hr
  ('hr','hr',true,'all'),('hr','payroll',true,'all'),('hr','site',false,'all'),('hr','projects',false,'all'),
  ('hr','reports',false,'all'),('hr','staff',false,'all'),('hr','documents',true,'assigned'),
  -- procurement
  ('procurement','procurement',true,'all'),('procurement','inventory',false,'all'),
  ('procurement','projects',false,'all'),('procurement','boq',false,'all'),
  ('procurement','reports',false,'all'),('procurement','documents',true,'assigned'),
  -- storekeeper
  ('storekeeper','inventory',true,'all'),('storekeeper','procurement',false,'all'),
  ('storekeeper','projects',false,'all'),('storekeeper','documents',true,'assigned'),
  -- project manager (assigned projects only)
  ('project_manager','projects',true,'assigned'),('project_manager','design',true,'assigned'),
  ('project_manager','boq',true,'assigned'),('project_manager','site',true,'assigned'),
  ('project_manager','procurement',true,'assigned'),('project_manager','inventory',false,'assigned'),
  ('project_manager','finance',false,'assigned'),('project_manager','documents',true,'assigned'),
  ('project_manager','reports',false,'assigned'),
  -- site engineer
  ('site_engineer','projects',false,'assigned'),('site_engineer','site',true,'assigned'),
  ('site_engineer','procurement',true,'assigned'),('site_engineer','inventory',false,'assigned'),
  ('site_engineer','design',false,'assigned'),('site_engineer','boq',false,'assigned'),
  ('site_engineer','documents',true,'assigned'),
  -- site supervisor
  ('site_supervisor','projects',false,'assigned'),('site_supervisor','site',true,'assigned'),
  ('site_supervisor','procurement',true,'assigned'),('site_supervisor','inventory',false,'assigned'),
  ('site_supervisor','documents',true,'assigned'),
  -- quantity surveyor
  ('qs','projects',false,'assigned'),('qs','boq',true,'assigned'),('qs','design',false,'assigned'),
  ('qs','procurement',false,'assigned'),('qs','inventory',false,'assigned'),('qs','documents',true,'assigned'),
  -- architect
  ('architect','projects',false,'assigned'),('architect','design',true,'assigned'),
  ('architect','boq',false,'assigned'),('architect','documents',true,'assigned'),
  -- marketing
  ('marketing','marketing',true,'all'),('marketing','crm',true,'all'),('marketing','real_estate',false,'all'),
  ('marketing','documents',true,'assigned'),
  -- real estate officer
  ('real_estate_officer','real_estate',true,'all'),('real_estate_officer','crm',true,'all'),
  ('real_estate_officer','marketing',false,'all'),('real_estate_officer','documents',true,'assigned')
) v(r, a, w, s)
on conflict (role_code, area) do update set can_write = excluded.can_write, scope = excluded.scope;

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default '',
  email         text not null,
  phone         text,
  avatar_url    text,
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists profiles_email_key on public.profiles (lower(email));

-- New auth user -> profile row.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, coalesce(new.email, ''),
          coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1)),
          new.raw_user_meta_data->>'phone')
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role_id     uuid not null references public.roles(id),
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists user_roles_user_idx on public.user_roles (user_id);
create index if not exists user_roles_role_idx on public.user_roles (role_id);
create unique index if not exists user_roles_active_key on public.user_roles (user_id, role_id) where revoked_at is null;

-- ---------------------------------------------------------------- auth helpers
-- All helpers are SECURITY DEFINER so policies can call them without recursion.

create or replace function public.uid() returns uuid
language sql stable as $$ select auth.uid() $$;

-- 2FA: if the user has a verified TOTP factor, the session must be aal2.
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f
                     where f.user_id = auth.uid() and f.status = 'verified');
$$;

create or replace function public.has_role(role_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.revoked_at is null
      and p.is_active and r.code = role_code);
$$;

create or replace function public.has_any_role(role_codes text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.revoked_at is null
      and p.is_active and r.code = any(role_codes));
$$;

create or replace function public.is_owner() returns boolean
language sql stable as $$ select public.has_role('owner') $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.revoked_at is null and p.is_active and r.is_staff);
$$;

-- Best scope the current user has for an area ('all', 'assigned' or null).
create or replace function public.perm_scope(p_area text, p_write boolean default false)
returns public.perm_scope
language sql stable security definer set search_path = public as $$
  select case
    when public.is_owner() then 'all'::public.perm_scope
    when not public.mfa_ok() then null
    else (select min(rp.scope) -- enum order: all < assigned
          from public.role_permissions rp
          join public.roles r on r.code = rp.role_code
          join public.user_roles ur on ur.role_id = r.id and ur.revoked_at is null
          join public.profiles p on p.id = ur.user_id and p.is_active
          where ur.user_id = auth.uid() and rp.area = p_area
            and (rp.can_write or not p_write))
  end;
$$;

create or replace function public.can(p_area text, p_write boolean default false) returns boolean
language sql stable as $$ select public.perm_scope(p_area, p_write) is not null $$;

create or replace function public.can_all(p_area text, p_write boolean default false) returns boolean
language sql stable as $$ select public.perm_scope(p_area, p_write) = 'all' $$;

-- Every area the current user can use (for the menu), with write flag.
create or replace function public.my_permissions()
returns table(area text, can_write boolean, scope public.perm_scope)
language sql stable security definer set search_path = public as $$
  select rp.area, bool_or(rp.can_write), min(rp.scope)
  from public.role_permissions rp
  join public.roles r on r.code = rp.role_code
  join public.user_roles ur on ur.role_id = r.id and ur.revoked_at is null
  join public.profiles p on p.id = ur.user_id and p.is_active
  where ur.user_id = auth.uid()
  group by rp.area;
$$;

create or replace function public.my_roles() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(r.code order by r.code), '{}')
  from public.user_roles ur join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid() and ur.revoked_at is null;
$$;

-- ---------------------------------------------------------------- guards

-- Only the owner may change is_active on a profile; nobody may change their own email here.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_owner() then
    if new.is_active is distinct from old.is_active then
      raise exception 'Only the owner can activate or deactivate staff';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email is changed through the login account, not the profile';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

-- There must always be at least one active owner.
create or replace function public.active_owner_count() returns int
language sql stable security definer set search_path = public as $$
  select count(distinct ur.user_id)::int
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id and r.code = 'owner'
  join public.profiles p on p.id = ur.user_id and p.is_active
  where ur.revoked_at is null;
$$;

create or replace function public.guard_last_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.active_owner_count() >= 1 then return null; end if;
  if tg_table_name = 'user_roles' then
    if exists (select 1 from public.roles where id = old.role_id and code = 'owner')
       and old.revoked_at is null then
      raise exception 'You cannot remove or deactivate the last owner';
    end if;
  elsif tg_table_name = 'profiles' then
    if old.is_active and exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                                 where ur.user_id = old.id and r.code = 'owner' and ur.revoked_at is null) then
      raise exception 'You cannot remove or deactivate the last owner';
    end if;
  end if;
  return null;
end $$;

drop trigger if exists guard_last_owner on public.user_roles;
create constraint trigger guard_last_owner after update or delete on public.user_roles
  deferrable initially immediate for each row execute function public.guard_last_owner();

drop trigger if exists guard_last_owner_profile on public.profiles;
create constraint trigger guard_last_owner_profile after update of is_active on public.profiles
  deferrable initially immediate for each row execute function public.guard_last_owner();

-- ---------------------------------------------------------------- settings

create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value) values
  ('company', '{"name":"Hangool Construction","phone":"","email":"","address":"Hargeisa, Somaliland","tax_id":"","logo_url":null}'),
  ('payment_two_approval_threshold', '5000'),
  ('currency', '{"code":"USD","symbol":"$"}'),
  ('default_stage_names', '["foundation","columns","walls","roof","finishing"]'),
  ('require_staff_2fa', 'false')
on conflict (key) do nothing;

create or replace function public.setting_num(p_key text, p_default numeric default 0) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from public.settings where key = p_key), p_default);
$$;

-- ---------------------------------------------------------------- notifications

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  type         text not null default 'info',
  title        text not null,
  body         text,
  link         text,
  entity_table text,
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

create or replace function public.notify(
  p_user uuid, p_title text, p_body text default null, p_link text default null,
  p_type text default 'info', p_entity_table text default null, p_entity_id uuid default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, link, entity_table, entity_id)
  values (p_user, p_type, p_title, p_body, p_link, p_entity_table, p_entity_id);
$$;

-- Notify every active holder of a role, optionally skipping one person.
create or replace function public.notify_role(
  p_role text, p_title text, p_body text default null, p_link text default null,
  p_type text default 'info', p_entity_table text default null, p_entity_id uuid default null,
  p_except uuid default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, link, entity_table, entity_id)
  select distinct ur.user_id, p_type, p_title, p_body, p_link, p_entity_table, p_entity_id
  from public.user_roles ur join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.user_id and p.is_active
  where r.code = p_role and ur.revoked_at is null
    and (p_except is null or ur.user_id <> p_except);
$$;

-- Live updates for the notifications bell (Realtime respects RLS: users only get their own rows).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------- audit log

create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     public.audit_action not null,
  table_name text not null,
  record_id  text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id);
create index if not exists audit_log_record_idx on public.audit_log (table_name, record_id);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_rec text;
  v_action public.audit_action;
begin
  v_rec := coalesce(v_new->>'id', v_old->>'id', v_new->>'key', v_old->>'key',
                    v_new->>'role_code' || ':' || (v_new->>'area'), '?');
  v_action := case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end;
  if tg_table_name = 'user_roles' then
    v_action := 'role_change';
  elsif tg_table_name = 'approvals' and tg_op = 'UPDATE' then
    if v_new->>'status' = 'approved' then v_action := 'approve';
    elsif v_new->>'status' = 'rejected' then v_action := 'reject'; end if;
  end if;
  if tg_op = 'UPDATE' then
    if (v_old - 'updated_at') = (v_new - 'updated_at') then return null; end if;
  end if;
  insert into public.audit_log (actor_id, action, table_name, record_id, old_values, new_values)
  values (auth.uid(), v_action, tg_table_name, v_rec, v_old, v_new);
  return null;
end $$;

-- Attach updated_at + audit triggers to a table (idempotent).
create or replace function public._std_triggers(tbl text, with_audit boolean default true)
returns void language plpgsql as $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = tbl and column_name = 'updated_at') then
    execute format('drop trigger if exists set_updated_at on public.%I', tbl);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', tbl);
  end if;
  execute format('drop trigger if exists audit_row on public.%I', tbl);
  if with_audit then
    execute format('create trigger audit_row after insert or update or delete on public.%I
                    for each row execute function public.audit_row()', tbl);
  end if;
end $$;

select public._std_triggers(t) from unnest(array['roles','role_permissions','profiles','user_roles','settings']) t;
select public._std_triggers('notifications', false);

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261127000200_tables.sql
-- ============================================================================
-- Hangool ERP · 0200 · Business tables
-- Based on the Prisma blueprint, with the agreed fixes. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------- enums
select public._ensure_enum('lead_source',      array['whatsapp','website','walk_in','referral','facebook','phone','other']);
select public._ensure_enum('lead_status',      array['new','contacted','visiting','signed','lost']);
select public._ensure_enum('lead_interest',    array['construction','property_buy','property_rent','other']);
select public._ensure_enum('contract_status',  array['draft','signed','completed','cancelled']);
select public._ensure_enum('project_status',   array['design','boq','active','handed_over','on_hold','cancelled']);
select public._ensure_enum('stage_status',     array['pending','in_progress','done','verified']);
select public._ensure_enum('drawing_status',   array['draft','submitted','approved','superseded']);
select public._ensure_enum('change_request_status', array['open','priced','approved','rejected','applied']);
select public._ensure_enum('boq_status',       array['draft','submitted','approved','superseded']);
select public._ensure_enum('material_request_status', array['submitted','pm_approved','sourcing','ordered','delivered','issued','rejected']);
select public._ensure_enum('purchase_order_status', array['waiting','approved','ordered','delivered','cancelled','rejected']);
select public._ensure_enum('stock_direction',  array['in','out','adjust']);
select public._ensure_enum('stock_condition',  array['ok','damaged','missing']);
select public._ensure_enum('payment_method',   array['sifalo_pay','zaad','edahab','evc','cash','bank']);
select public._ensure_enum('invoice_status',   array['draft','pending','partially_paid','paid','overdue','cancelled']);
select public._ensure_enum('invoice_type',     array['deposit','milestone','extra']);
select public._ensure_enum('payment_type',     array['deposit','milestone','extra','other']);
select public._ensure_enum('payment_status',   array['pending','confirmed','cancelled']);
select public._ensure_enum('supplier_payment_status', array['pending','approved','paid','rejected','cancelled']);
select public._ensure_enum('expense_status',   array['pending','approved','paid','rejected']);
select public._ensure_enum('employee_status',  array['active','on_leave','left']);
select public._ensure_enum('leave_type',       array['annual','sick','unpaid','other']);
select public._ensure_enum('leave_status',     array['pending','approved','rejected','cancelled']);
select public._ensure_enum('payroll_status',   array['draft','approved','paid']);
select public._ensure_enum('complaint_status', array['open','in_progress','resolved','closed']);
select public._ensure_enum('warranty_status',  array['open','inspected','fixed','rejected']);
select public._ensure_enum('property_status',  array['available','reserved','rented','sold','off_market']);
select public._ensure_enum('listing_type',     array['sale','rent','both']);
select public._ensure_enum('agreement_status', array['draft','active','ended','cancelled']);
select public._ensure_enum('sale_status',      array['draft','signed','completed','cancelled']);
select public._ensure_enum('viewing_status',   array['scheduled','done','cancelled','no_show']);
select public._ensure_enum('media_type',       array['poster','video','ad','social','other']);
select public._ensure_enum('campaign_status',  array['planned','running','ended']);
select public._ensure_enum('account_type',     array['asset','liability','equity','income','expense']);
select public._ensure_enum('journal_status',   array['draft','posted','void']);

-- ================================================================ MARKETING / CRM

create table if not exists public.campaigns (
  id         uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id),
  name       text not null,
  media_type public.media_type not null default 'social',
  channel    text,
  budget     numeric(12,2),
  spent      numeric(12,2) not null default 0,
  status     public.campaign_status not null default 'planned',
  start_date date,
  end_date   date,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ================================================================ PROJECTS (needed by properties / leads)

create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references public.profiles(id) on delete set null, -- portal login
  lead_id    uuid unique,                                                    -- fk added below
  name       text not null,
  phone      text,
  email      text,
  address    text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id),
  manager_id     uuid references public.profiles(id),
  code           text not null unique,
  name           text not null,
  location       text,
  description    text,
  profit_pct     numeric(5,2),
  contract_value numeric(14,2) not null default 0,
  budget         numeric(14,2) not null default 0,
  status         public.project_status not null default 'design',
  start_date     date,
  end_date       date,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists projects_client_idx on public.projects (client_id);
create index if not exists projects_manager_idx on public.projects (manager_id);

create table if not exists public.stages (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  name             text not null,           -- free text; defaults in settings.default_stage_names
  seq              int not null,
  planned_start    date,
  planned_end      date,
  actual_start     date,
  completed_at     date,
  budget_amount    numeric(14,2) not null default 0,
  milestone_amount numeric(14,2) not null default 0,
  progress_pct     int not null default 0 check (progress_pct between 0 and 100),
  status           public.stage_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (project_id, seq)
);

create table if not exists public.project_members (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role_id     uuid not null references public.roles(id),
  assigned_at date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (project_id, user_id, role_id)
);
create index if not exists project_members_user_idx on public.project_members (user_id);

-- ================================================================ REAL ESTATE

create table if not exists public.properties (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id), -- if built by Hangool
  title         text not null,
  property_type text not null default 'house',       -- house, apartment_block, land, shop, office
  listing_type  public.listing_type not null default 'sale',
  location      text,
  description   text,
  price         numeric(14,2),
  rent_amount   numeric(12,2),
  photo_urls    text[] not null default '{}',
  status        public.property_status not null default 'available',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.property_units (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_no     text not null,
  floor       int,
  bedrooms    int,
  size_sqm    numeric(10,2),
  price       numeric(14,2),
  rent_amount numeric(12,2),
  status      public.property_status not null default 'available',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (property_id, unit_no)
);

create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references public.profiles(id) on delete set null,
  name       text not null,
  phone      text,
  email      text,
  id_number  text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buyers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references public.profiles(id) on delete set null,
  client_id  uuid references public.clients(id),
  name       text not null,
  phone      text,
  email      text,
  id_number  text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rental_agreements (
  id           uuid primary key default gen_random_uuid(),
  agreement_no text not null unique,
  property_id  uuid not null references public.properties(id),
  unit_id      uuid references public.property_units(id),
  tenant_id    uuid not null references public.tenants(id),
  start_date   date not null,
  end_date     date,
  monthly_rent numeric(12,2) not null,
  deposit      numeric(12,2) not null default 0,
  due_day      int not null default 1 check (due_day between 1 and 28),
  status       public.agreement_status not null default 'draft',
  file_url     text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.sale_agreements (
  id           uuid primary key default gen_random_uuid(),
  agreement_no text not null unique,
  property_id  uuid not null references public.properties(id),
  unit_id      uuid references public.property_units(id),
  buyer_id     uuid not null references public.buyers(id),
  sale_price   numeric(14,2) not null,
  deposit      numeric(14,2) not null default 0,
  amount_paid  numeric(14,2) not null default 0,
  signed_at    date,
  status       public.sale_status not null default 'draft',
  file_url     text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.viewings (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id),
  unit_id       uuid references public.property_units(id),
  lead_id       uuid,                                  -- fk added below
  visitor_name  text not null,
  visitor_phone text,
  scheduled_at  timestamptz not null,
  agent_id      uuid references public.profiles(id),
  status        public.viewing_status not null default 'scheduled',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ================================================================ LEADS

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  source      public.lead_source not null default 'whatsapp',
  status      public.lead_status not null default 'new',
  interest    public.lead_interest not null default 'construction',
  budget      numeric(14,2),
  message     text,
  lost_reason text,
  assigned_to uuid references public.profiles(id),
  campaign_id uuid references public.campaigns(id),
  property_id uuid references public.properties(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists leads_assigned_idx on public.leads (assigned_to);
create index if not exists leads_status_idx on public.leads (status);

do $$ begin
  alter table public.clients add constraint clients_lead_id_fkey foreign key (lead_id) references public.leads(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.viewings add constraint viewings_lead_id_fkey foreign key (lead_id) references public.leads(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.follow_ups (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id),
  due_at      timestamptz not null,
  note        text,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.contracts (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id),
  project_id     uuid not null references public.projects(id),
  contract_no    text not null unique,
  contract_value numeric(14,2) not null,
  signed_at      date,
  file_url       text,
  status         public.contract_status not null default 'draft',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists contracts_project_idx on public.contracts (project_id);

-- ================================================================ DESIGN / BOQ

create table if not exists public.drawings (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  previous_version_id uuid unique references public.drawings(id),
  uploaded_by         uuid not null references public.profiles(id),
  title               text not null,
  discipline          text,                 -- architectural, structural, mep
  version_no          int not null default 1,
  storage_path        text not null,        -- path inside the 'drawings' bucket
  status              public.drawing_status not null default 'draft',
  is_final            boolean not null default false,
  locked_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists drawings_project_idx on public.drawings (project_id);

create table if not exists public.change_requests (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  drawing_id   uuid references public.drawings(id),
  requested_by uuid not null references public.profiles(id),
  title        text not null default '',
  description  text not null,
  cost_impact  numeric(14,2),
  days_impact  int,
  status       public.change_request_status not null default 'open',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.boq_items (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  stage_id          uuid not null references public.stages(id) on delete cascade,
  inventory_item_id uuid,                     -- fk added below; null for labour
  change_request_id uuid references public.change_requests(id),
  prepared_by       uuid not null references public.profiles(id),
  description       text not null,
  unit              text not null,
  quantity          numeric(14,3) not null check (quantity >= 0),
  unit_price        numeric(12,2) not null check (unit_price >= 0),
  amount            numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  boq_version       int not null default 1,
  status            public.boq_status not null default 'draft',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists boq_items_project_idx on public.boq_items (project_id, boq_version);
create index if not exists boq_items_stage_idx on public.boq_items (stage_id);

-- ================================================================ PROCUREMENT / INVENTORY

create table if not exists public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  phone         text,
  email         text,
  address       text,
  category      text,
  payment_terms text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id            uuid primary key default gen_random_uuid(),
  sku           text not null unique,
  name          text not null,
  category      text,
  unit          text not null,
  location      text,
  unit_cost     numeric(12,2) not null default 0,
  qty_on_hand   numeric(14,3) not null default 0 check (qty_on_hand >= 0),
  reorder_level numeric(14,3),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $$ begin
  alter table public.boq_items add constraint boq_items_inventory_item_id_fkey
    foreign key (inventory_item_id) references public.inventory_items(id);
exception when duplicate_object then null; end $$;

create table if not exists public.material_requests (
  id            uuid primary key default gen_random_uuid(),
  request_no    text unique,
  project_id    uuid not null references public.projects(id),
  stage_id      uuid not null references public.stages(id),
  requested_by  uuid not null references public.profiles(id),
  within_budget boolean,
  needed_by     date,
  notes         text,
  status        public.material_request_status not null default 'submitted',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists material_requests_project_idx on public.material_requests (project_id);
create index if not exists material_requests_status_idx on public.material_requests (status);

create table if not exists public.request_items (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references public.material_requests(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  boq_item_id       uuid references public.boq_items(id),
  quantity          numeric(14,3) not null check (quantity > 0),
  qty_from_stock    numeric(14,3) not null default 0,
  qty_to_buy        numeric(14,3) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists request_items_request_idx on public.request_items (request_id);

create table if not exists public.quotes (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.material_requests(id) on delete cascade,
  supplier_id  uuid not null references public.suppliers(id),
  total_amount numeric(14,2) not null,
  valid_until  date,
  is_selected  boolean not null default false,
  file_url     text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists quotes_request_idx on public.quotes (request_id);

create table if not exists public.purchase_orders (
  id           uuid primary key default gen_random_uuid(),
  po_number    text not null unique,
  request_id   uuid references public.material_requests(id), -- null for direct purchases
  project_id   uuid references public.projects(id),
  quote_id     uuid unique references public.quotes(id),
  supplier_id  uuid not null references public.suppliers(id),
  created_by   uuid not null references public.profiles(id),
  total_amount numeric(14,2) not null check (total_amount >= 0),
  expected_at  date,
  status       public.purchase_order_status not null default 'waiting',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists purchase_orders_request_idx on public.purchase_orders (request_id);
create index if not exists purchase_orders_project_idx on public.purchase_orders (project_id);

create table if not exists public.stock_movements (
  id                uuid primary key default gen_random_uuid(),
  item_id           uuid not null references public.inventory_items(id),
  direction         public.stock_direction not null,
  quantity          numeric(14,3) not null,  -- > 0 for in/out; signed for adjust
  unit_cost         numeric(12,2),
  purchase_order_id uuid references public.purchase_orders(id),
  supplier_id       uuid references public.suppliers(id),
  project_id        uuid references public.projects(id),
  stage_id          uuid references public.stages(id),
  request_id        uuid references public.material_requests(id),
  recorded_by       uuid not null references public.profiles(id),
  condition         public.stock_condition not null default 'ok',
  note              text,
  moved_at          timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (direction = 'adjust' or quantity > 0),
  check (quantity <> 0)
);
create index if not exists stock_movements_item_idx on public.stock_movements (item_id, moved_at);
create index if not exists stock_movements_project_idx on public.stock_movements (project_id);

-- ================================================================ HR (before site, which references employees)

create table if not exists public.employees (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references public.profiles(id) on delete set null,
  employee_no text unique,
  full_name   text not null,
  phone       text,
  job_title   text not null,
  department  text,
  hire_date   date not null default current_date,
  base_salary numeric(12,2) not null default 0,
  status      public.employee_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type  public.leave_type not null,
  start_date  date not null,
  end_date    date not null,
  reason      text,
  status      public.leave_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.payroll (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees(id) on delete cascade,
  period_month date not null,
  gross        numeric(12,2) not null,
  allowances   numeric(12,2) not null default 0,
  deductions   numeric(12,2) not null default 0,
  net          numeric(12,2) generated always as (gross + allowances - deductions) stored,
  status       public.payroll_status not null default 'draft',
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (employee_id, period_month)
);

-- ================================================================ SITE

create table if not exists public.daily_reports (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id),
  stage_id          uuid references public.stages(id),
  author_id         uuid not null references public.profiles(id),
  reviewed_by       uuid references public.profiles(id),
  report_date       date not null,
  weather           text,
  progress          text not null,
  problems          text,
  workers_present   int not null default 0,
  photo_paths       text[] not null default '{}', -- paths in the 'project-photos' bucket
  reviewed_at       timestamptz,
  visible_to_client boolean not null default false,
  -- offline sync
  client_id         uuid unique,                  -- uuid generated on the device
  happened_at       timestamptz not null default now(),
  synced_at         timestamptz,
  device_id         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists daily_reports_project_idx on public.daily_reports (project_id, report_date);

create table if not exists public.labourers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  trade      text,
  daily_rate numeric(12,2) not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_attendance (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id),
  labourer_id    uuid references public.labourers(id),
  employee_id    uuid references public.employees(id),
  recorded_by    uuid not null references public.profiles(id),
  work_date      date not null,
  present        boolean not null default true,
  hours          numeric(4,1),
  check_in_at    timestamptz,
  check_in_lat   numeric(9,6),
  check_in_lng   numeric(9,6),
  check_out_at   timestamptz,
  check_out_lat  numeric(9,6),
  check_out_lng  numeric(9,6),
  -- offline sync
  client_id      uuid unique,
  happened_at    timestamptz not null default now(),
  synced_at      timestamptz,
  device_id      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (num_nonnulls(labourer_id, employee_id) = 1)
);
create index if not exists site_attendance_project_idx on public.site_attendance (project_id, work_date);
create index if not exists site_attendance_employee_idx on public.site_attendance (employee_id);

create table if not exists public.labour_payments (
  id           uuid primary key default gen_random_uuid(),
  labourer_id  uuid not null references public.labourers(id),
  project_id   uuid not null references public.projects(id),
  paid_by      uuid not null references public.profiles(id),
  period_start date not null,
  period_end   date not null,
  days_worked  int not null,
  amount       numeric(12,2) not null,
  method       public.payment_method not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ================================================================ ACCOUNTING

create table if not exists public.chart_of_accounts (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  type       public.account_type not null,
  parent_id  uuid references public.chart_of_accounts(id),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.chart_of_accounts (code, name, type) values
  ('1000','Cash on hand','asset'),
  ('1010','Bank accounts','asset'),
  ('1020','Mobile money (Zaad / eDahab / EVC)','asset'),
  ('1100','Accounts receivable','asset'),
  ('1200','Inventory — materials','asset'),
  ('1500','Equipment','asset'),
  ('2000','Accounts payable','liability'),
  ('2100','Client deposits received','liability'),
  ('2200','Salaries payable','liability'),
  ('2300','Tenant deposits held','liability'),
  ('3000','Owner equity','equity'),
  ('3100','Retained earnings','equity'),
  ('4000','Construction revenue','income'),
  ('4100','Rental income','income'),
  ('4200','Property sales','income'),
  ('4900','Other income','income'),
  ('5000','Materials cost','expense'),
  ('5100','Labour cost','expense'),
  ('5200','Salaries','expense'),
  ('5300','Equipment & fuel','expense'),
  ('5400','Transport','expense'),
  ('5500','Office & admin','expense'),
  ('5600','Marketing','expense'),
  ('5900','Other expenses','expense')
on conflict (code) do nothing;

create table if not exists public.bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  kind            text not null default 'bank' check (kind in ('bank','cash','mobile_money')),
  bank_name       text,
  account_no      text,
  currency        text not null default 'USD',
  opening_balance numeric(14,2) not null default 0,
  gl_account_id   uuid not null references public.chart_of_accounts(id),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id           uuid primary key default gen_random_uuid(),
  entry_no     bigint generated always as identity unique,
  entry_date   date not null default current_date,
  memo         text,
  source_table text,
  source_id    uuid,
  status       public.journal_status not null default 'draft',
  posted_at    timestamptz,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists journal_entries_source_idx on public.journal_entries (source_table, source_id);

create table if not exists public.journal_lines (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.journal_entries(id) on delete cascade,
  account_id  uuid not null references public.chart_of_accounts(id),
  project_id  uuid references public.projects(id),
  description text,
  debit       numeric(14,2) not null default 0 check (debit >= 0),
  credit      numeric(14,2) not null default 0 check (credit >= 0),
  created_at  timestamptz not null default now(),
  check ((debit > 0) <> (credit > 0))
);
create index if not exists journal_lines_entry_idx on public.journal_lines (entry_id);
create index if not exists journal_lines_account_idx on public.journal_lines (account_id);

-- ================================================================ FINANCE

create table if not exists public.invoices (
  id           uuid primary key default gen_random_uuid(),
  invoice_no   text not null unique,
  project_id   uuid not null references public.projects(id),
  stage_id     uuid references public.stages(id),         -- optional; many invoices per stage allowed
  client_id    uuid not null references public.clients(id),
  invoice_type public.invoice_type not null default 'milestone',
  description  text,
  amount       numeric(14,2) not null check (amount > 0),
  amount_paid  numeric(14,2) not null default 0,
  issue_date   date,
  due_date     date,
  status       public.invoice_status not null default 'draft',
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists invoices_project_idx on public.invoices (project_id);
create index if not exists invoices_client_idx on public.invoices (client_id);
create index if not exists invoices_status_idx on public.invoices (status);

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id),
  project_id      uuid not null references public.projects(id),
  invoice_id      uuid references public.invoices(id),
  contract_id     uuid references public.contracts(id),
  bank_account_id uuid references public.bank_accounts(id),
  recorded_by     uuid references public.profiles(id),   -- null for gateway payments
  payment_type    public.payment_type not null,
  amount          numeric(14,2) not null check (amount > 0),
  method          public.payment_method not null,
  gateway_ref     text,
  paid_at         timestamptz,
  status          public.payment_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists payments_client_idx on public.payments (client_id);
create index if not exists payments_project_idx on public.payments (project_id);
create index if not exists payments_invoice_idx on public.payments (invoice_id);

create table if not exists public.receipts (
  id         uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id),
  receipt_no text not null unique,
  issued_by  uuid not null references public.profiles(id),
  issued_at  timestamptz not null default now(),
  pdf_url    text,
  cancelled  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_payments (
  id                uuid primary key default gen_random_uuid(),
  supplier_id       uuid not null references public.suppliers(id),
  purchase_order_id uuid references public.purchase_orders(id),
  bank_account_id   uuid references public.bank_accounts(id),
  recorded_by       uuid not null references public.profiles(id),
  amount            numeric(14,2) not null check (amount > 0),
  method            public.payment_method not null,
  paid_at           timestamptz,
  status            public.supplier_payment_status not null default 'pending',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  expense_date    date not null default current_date,
  account_id      uuid not null references public.chart_of_accounts(id), -- expense account
  bank_account_id uuid references public.bank_accounts(id),
  project_id      uuid references public.projects(id),
  description     text not null,
  amount          numeric(14,2) not null check (amount > 0),
  method          public.payment_method not null default 'cash',
  status          public.expense_status not null default 'pending',
  recorded_by     uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.rent_payments (
  id                  uuid primary key default gen_random_uuid(),
  rental_agreement_id uuid not null references public.rental_agreements(id),
  bank_account_id     uuid references public.bank_accounts(id),
  period_month        date not null,
  amount              numeric(12,2) not null check (amount > 0),
  method              public.payment_method not null,
  paid_at             timestamptz,
  status              public.payment_status not null default 'pending',
  recorded_by         uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists rent_payments_agreement_idx on public.rent_payments (rental_agreement_id);

-- ================================================================ CLIENT PORTAL

create table if not exists public.messages (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  project_id     uuid references public.projects(id),
  sender_id      uuid not null references public.profiles(id),
  body           text not null,
  attachment_url text,
  sent_at        timestamptz not null default now(),
  read_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists messages_client_idx on public.messages (client_id, sent_at);

create table if not exists public.complaints (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id),
  project_id  uuid references public.projects(id),
  assigned_to uuid references public.profiles(id),
  subject     text not null,
  description text not null,
  status      public.complaint_status not null default 'open',
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.warranty_claims (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id),
  project_id  uuid not null references public.projects(id),
  assigned_to uuid references public.profiles(id),
  description text not null,
  photo_paths text[] not null default '{}',
  status      public.warranty_status not null default 'open',
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ================================================================ DOCUMENTS

create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  category        text not null default 'general', -- contract, permit, drawing, invoice, id, certificate, report, general
  description     text,
  project_id      uuid references public.projects(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete cascade,
  employee_id     uuid references public.employees(id) on delete cascade,
  supplier_id     uuid references public.suppliers(id) on delete cascade,
  property_id     uuid references public.properties(id) on delete cascade,
  current_version int not null default 0,
  expiry_date     date,
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (num_nonnulls(project_id, client_id, employee_id, supplier_id, property_id) <= 1)
);
create index if not exists documents_project_idx on public.documents (project_id);

create table if not exists public.document_versions (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references public.documents(id) on delete cascade,
  version_no     int not null,
  storage_bucket text not null default 'documents',
  storage_path   text not null,
  file_name      text not null,
  mime_type      text,
  size_bytes     bigint,
  note           text,
  uploaded_by    uuid not null references public.profiles(id),
  created_at     timestamptz not null default now(),
  unique (document_id, version_no)
);

create table if not exists public.document_access (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  role_id     uuid references public.roles(id),
  user_id     uuid references public.profiles(id) on delete cascade,
  can_edit    boolean not null default false,
  created_at  timestamptz not null default now(),
  check (num_nonnulls(role_id, user_id) = 1)
);
create index if not exists document_access_doc_idx on public.document_access (document_id);

-- ================================================================ triggers

select public._std_triggers(t) from unnest(array[
  'campaigns','clients','projects','stages','project_members','properties','property_units','tenants',
  'buyers','rental_agreements','sale_agreements','viewings','leads','follow_ups','contracts','drawings',
  'change_requests','boq_items','suppliers','inventory_items','material_requests','request_items','quotes',
  'purchase_orders','stock_movements','employees','leave_requests','payroll','daily_reports','labourers',
  'site_attendance','labour_payments','chart_of_accounts','bank_accounts','journal_entries','invoices',
  'payments','receipts','supplier_payments','expenses','rent_payments','complaints','warranty_claims',
  'documents','document_versions','document_access']) t;
-- journal_lines and messages are high-volume: audited through their parent / not audited.
select public._std_triggers('journal_lines', false);
select public._std_triggers('messages', false);

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261127000300_logic.sql
-- ============================================================================
-- Hangool ERP · 0300 · Business logic: numbering, approvals engine, stock,
-- invoices/payments, general-ledger posting, views. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------- numbering

create table if not exists public.doc_counters (
  prefix text not null,
  year   int  not null,
  last   int  not null default 0,
  primary key (prefix, year)
);

-- next_doc_no('INV') -> 'INV-2026-0001'
create or replace function public.next_doc_no(p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare v_year int := extract(year from now())::int; v_n int;
begin
  insert into public.doc_counters (prefix, year, last) values (p_prefix, v_year, 1)
  on conflict (prefix, year) do update set last = public.doc_counters.last + 1
  returning last into v_n;
  return p_prefix || '-' || v_year || '-' || lpad(v_n::text, 4, '0');
end $$;

alter table public.invoices          alter column invoice_no   set default public.next_doc_no('INV');
alter table public.receipts          alter column receipt_no   set default public.next_doc_no('RCT');
alter table public.purchase_orders   alter column po_number    set default public.next_doc_no('PO');
alter table public.contracts         alter column contract_no  set default public.next_doc_no('CON');
alter table public.material_requests alter column request_no   set default public.next_doc_no('MR');
alter table public.rental_agreements alter column agreement_no set default public.next_doc_no('RA');
alter table public.sale_agreements   alter column agreement_no set default public.next_doc_no('SA');
alter table public.projects          alter column code         set default public.next_doc_no('PRJ');
alter table public.employees         alter column employee_no  set default public.next_doc_no('EMP');

-- ---------------------------------------------------------------- project helpers

create or replace function public.is_project_member(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.projects p where p.id = p_project and p.manager_id = auth.uid()
    union all
    select 1 from public.project_members m where m.project_id = p_project and m.user_id = auth.uid());
$$;

create or replace function public.my_client_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id from public.clients c
  join public.profiles p on p.id = c.user_id and p.is_active
  where c.user_id = auth.uid();
$$;

create or replace function public.is_project_client(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects p
                 where p.id = p_project and p.client_id in (select public.my_client_ids()));
$$;

create or replace function public.my_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.employees where user_id = auth.uid();
$$;

-- Area permission for one project: 'all' scope, or 'assigned' scope + member.
create or replace function public.can_project(p_area text, p_project uuid, p_write boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select case public.perm_scope(p_area, p_write)
    when 'all' then true
    when 'assigned' then p_project is not null and public.is_project_member(p_project)
    else false end;
$$;

-- Creates the default stages (from settings) for a project that has none.
create or replace function public.create_default_stages(p_project uuid)
returns int language plpgsql security invoker set search_path = public as $$
declare v_names jsonb; n int := 0; v text;
begin
  if exists (select 1 from public.stages where project_id = p_project) then return 0; end if;
  select value into v_names from public.settings where key = 'default_stage_names';
  for v in select jsonb_array_elements_text(coalesce(v_names, '["foundation","columns","walls","roof","finishing"]')) loop
    n := n + 1;
    insert into public.stages (project_id, name, seq) values (p_project, v, n);
  end loop;
  return n;
end $$;

-- ================================================================ APPROVALS ENGINE

select public._ensure_enum('approval_type',   array['material_request','design','boq','stage_completion','change_request','payment','purchase','leave','expense']);
select public._ensure_enum('approval_status', array['pending','approved','rejected','skipped','cancelled']);

create table if not exists public.approval_rules (
  id                   uuid primary key default gen_random_uuid(),
  approval_type        public.approval_type not null,
  step_order           int not null,
  role_code            text not null references public.roles(code) on update cascade,
  only_above_threshold boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (approval_type, step_order)
);

insert into public.approval_rules (approval_type, step_order, role_code, only_above_threshold) values
  ('material_request', 1, 'project_manager', false),
  ('design',           1, 'project_manager', false),
  ('design',           2, 'owner',           false),
  ('boq',              1, 'project_manager', false),
  ('boq',              2, 'owner',           false),
  ('stage_completion', 1, 'project_manager', false),
  ('stage_completion', 2, 'owner',           false),
  ('change_request',   1, 'project_manager', false),
  ('change_request',   2, 'owner',           false),
  ('purchase',         1, 'finance',         false),
  ('purchase',         2, 'owner',           true),
  ('payment',          1, 'finance',         false),
  ('payment',          2, 'owner',           true),
  ('expense',          1, 'finance',         false),
  ('expense',          2, 'owner',           true),
  ('leave',            1, 'hr',              false)
on conflict (approval_type, step_order) do nothing;

create table if not exists public.approvals (
  id               uuid primary key default gen_random_uuid(),
  request_group    uuid not null,                 -- all steps of one request share this
  approval_type    public.approval_type not null,
  entity_table     text not null,
  entity_id        uuid not null,
  ref_version      int,
  title            text not null,
  link             text,
  step_order       int not null,
  required_role_id uuid not null references public.roles(id),
  requested_by     uuid not null references public.profiles(id),
  approver_id      uuid references public.profiles(id),
  status           public.approval_status not null default 'pending',
  amount           numeric(14,2),
  comment          text,
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (request_group, step_order),
  constraint approvals_no_self_approval check (approver_id is null or approver_id <> requested_by)
);
create index if not exists approvals_entity_idx on public.approvals (entity_table, entity_id);
create index if not exists approvals_status_role_idx on public.approvals (status, required_role_id);
create index if not exists approvals_group_idx on public.approvals (request_group);

select public._std_triggers('approval_rules');
select public._std_triggers('approvals');

create or replace function public.user_has_role(p_user uuid, p_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                 join public.profiles p on p.id = ur.user_id and p.is_active
                 where ur.user_id = p_user and ur.revoked_at is null and r.code = p_role);
$$;

-- The step that is waiting for a decision in a request group (null if finished).
create or replace function public.current_approval_step(p_group uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select a.id from public.approvals a
  where a.request_group = p_group and a.status = 'pending'
    and not exists (select 1 from public.approvals r where r.request_group = p_group and r.status = 'rejected')
  order by a.step_order limit 1;
$$;

-- Project the approved record belongs to (null if none).
create or replace function public._entity_project(p_table text, p_id uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  case p_table
    when 'boq'               then v := p_id;
    when 'stages'            then select project_id into v from public.stages where id = p_id;
    when 'drawings'          then select project_id into v from public.drawings where id = p_id;
    when 'change_requests'   then select project_id into v from public.change_requests where id = p_id;
    when 'material_requests' then select project_id into v from public.material_requests where id = p_id;
    when 'purchase_orders'   then select project_id into v from public.purchase_orders where id = p_id;
    when 'expenses'          then select project_id into v from public.expenses where id = p_id;
    when 'payments'          then select project_id into v from public.payments where id = p_id;
    else v := null;
  end case;
  return v;
end $$;

-- Roles whose approvals are limited to the projects the person works on.
create or replace function public._is_project_role(p_role text) returns boolean
language sql immutable as $$
  select p_role in ('project_manager','site_engineer','site_supervisor','qs','architect');
$$;

-- Users allowed to decide a step (active holders of the role; for project roles, only that project's team).
create or replace function public.approval_step_candidates(p_step uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  with s as (
    select a.*, r.code as role_code, public._entity_project(a.entity_table, a.entity_id) as project_id
    from public.approvals a join public.roles r on r.id = a.required_role_id where a.id = p_step)
  select distinct ur.user_id
  from s
  join public.user_roles ur on ur.role_id = s.required_role_id and ur.revoked_at is null
  join public.profiles p on p.id = ur.user_id and p.is_active
  where ur.user_id <> s.requested_by
    and (not public._is_project_role(s.role_code) or s.project_id is null
         or exists (select 1 from public.projects pr where pr.id = s.project_id and pr.manager_id = ur.user_id)
         or exists (select 1 from public.project_members m where m.project_id = s.project_id and m.user_id = ur.user_id));
$$;

create or replace function public._notify_step(p_step uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.approvals; v_user uuid;
begin
  select * into s from public.approvals where id = p_step;
  if not found then return; end if;
  for v_user in select public.approval_step_candidates(p_step) loop
    perform public.notify(v_user, 'Approval needed: ' || s.title,
      'Step ' || s.step_order || ' · ' || replace(s.approval_type::text, '_', ' '),
      '/owner/approvals?id=' || s.request_group, 'approval', 'approvals', s.request_group);
  end loop;
end $$;

-- Which tables each approval type may point at.
create or replace function public._approval_entity_ok(p_type public.approval_type, p_table text) returns boolean
language sql immutable as $$
  select p_table = any(case p_type
    when 'material_request' then array['material_requests']
    when 'design'           then array['drawings']
    when 'boq'              then array['boq']
    when 'stage_completion' then array['stages']
    when 'change_request'   then array['change_requests']
    when 'payment'          then array['supplier_payments','payments']
    when 'purchase'         then array['purchase_orders']
    when 'leave'            then array['leave_requests']
    when 'expense'          then array['expenses'] end);
$$;

-- The real amount of the record (callers cannot understate it to dodge the threshold).
create or replace function public._entity_amount(p_table text, p_id uuid) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare v numeric;
begin
  case p_table
    when 'supplier_payments' then select amount into v from public.supplier_payments where id = p_id;
    when 'payments'          then select amount into v from public.payments where id = p_id;
    when 'expenses'          then select amount into v from public.expenses where id = p_id;
    when 'purchase_orders'   then select total_amount into v from public.purchase_orders where id = p_id;
    when 'change_requests'   then select cost_impact into v from public.change_requests where id = p_id;
    when 'boq'               then select sum(amount) into v from public.boq_items where project_id = p_id;
    else v := null;
  end case;
  return v;
end $$;

create or replace function public._entity_exists(p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v boolean;
begin
  if p_table = 'boq' then
    return exists (select 1 from public.projects where id = p_id);
  end if;
  execute format('select exists (select 1 from public.%I where id = $1)', p_table) into v using p_id;
  return v;
end $$;

-- Start an approval. Returns the request group id.
-- A step whose role the requester holds is skipped (nobody approves their own request).
-- Steps marked only_above_threshold are added only when amount > payment_two_approval_threshold.
create or replace function public.request_approval(
  p_type public.approval_type, p_entity_table text, p_entity_id uuid, p_title text,
  p_amount numeric default null, p_ref_version int default null, p_link text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_group uuid := gen_random_uuid();
  v_threshold numeric := public.setting_num('payment_two_approval_threshold', 5000);
  r record; v_step int := 0; v_pending int := 0; v_fallback text;
begin
  if v_user is null then raise exception 'Not signed in'; end if;
  if not public.is_staff() and not exists (select public.my_client_ids()) then
    raise exception 'Not allowed to request approvals';
  end if;
  if not public._approval_entity_ok(p_type, p_entity_table) then
    raise exception 'A % approval cannot point at %', p_type, p_entity_table;
  end if;
  if not public._entity_exists(p_entity_table, p_entity_id) then
    raise exception 'The record to approve does not exist';
  end if;
  if exists (select 1 from public.approvals where entity_table = p_entity_table and entity_id = p_entity_id
             and coalesce(ref_version, -1) = coalesce(p_ref_version, -1) and status = 'pending') then
    raise exception 'This item is already waiting for approval';
  end if;
  if p_entity_table = 'boq' then
    p_amount := (select sum(amount) from public.boq_items where project_id = p_entity_id and boq_version = p_ref_version);
  else
    p_amount := coalesce(public._entity_amount(p_entity_table, p_entity_id), p_amount);
  end if;

  for r in select ar.*, ro.id as role_id from public.approval_rules ar
           join public.roles ro on ro.code = ar.role_code
           where ar.approval_type = p_type order by ar.step_order loop
    if r.only_above_threshold and coalesce(p_amount, 0) <= v_threshold then continue; end if;
    v_step := v_step + 1;
    if public.user_has_role(v_user, r.role_code) then
      insert into public.approvals (request_group, approval_type, entity_table, entity_id, ref_version, title, link,
                                    step_order, required_role_id, requested_by, status, amount, comment, decided_at)
      values (v_group, p_type, p_entity_table, p_entity_id, p_ref_version, p_title, p_link,
              v_step, r.role_id, v_user, 'skipped', p_amount, 'Skipped: requester holds this role', now());
    else
      insert into public.approvals (request_group, approval_type, entity_table, entity_id, ref_version, title, link,
                                    step_order, required_role_id, requested_by, amount)
      values (v_group, p_type, p_entity_table, p_entity_id, p_ref_version, p_title, p_link,
              v_step, r.role_id, v_user, p_amount);
      v_pending := v_pending + 1;
    end if;
  end loop;

  -- Every step was skipped (or no rule exists): send it to someone else at the top.
  if v_pending = 0 then
    v_fallback := case when not public.user_has_role(v_user, 'owner') then 'owner'
                       when not public.user_has_role(v_user, 'general_manager') then 'general_manager' end;
    if v_fallback is null then
      raise exception 'There is no other approver for this request';
    end if;
    insert into public.approvals (request_group, approval_type, entity_table, entity_id, ref_version, title, link,
                                  step_order, required_role_id, requested_by, amount)
    values (v_group, p_type, p_entity_table, p_entity_id, p_ref_version, p_title, p_link,
            v_step + 1, (select id from public.roles where code = v_fallback), v_user, p_amount);
  end if;

  perform public._notify_step(public.current_approval_step(v_group));
  return v_group;
end $$;

-- Apply the final result of a request to the record it is about.
create or replace function public._apply_approval_outcome(p_group uuid, p_approved boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a public.approvals;
begin
  select * into a from public.approvals where request_group = p_group order by step_order limit 1;
  perform set_config('app.approval_engine', 'on', true);
  case a.entity_table
    when 'leave_requests' then
      update public.leave_requests set status = case when p_approved then 'approved' else 'rejected' end::public.leave_status where id = a.entity_id;
    when 'change_requests' then
      update public.change_requests set status = case when p_approved then 'approved' else 'rejected' end::public.change_request_status where id = a.entity_id;
    when 'purchase_orders' then
      update public.purchase_orders set status = case when p_approved then 'approved' else 'rejected' end::public.purchase_order_status where id = a.entity_id;
    when 'supplier_payments' then
      update public.supplier_payments set status = case when p_approved then 'approved' else 'rejected' end::public.supplier_payment_status where id = a.entity_id;
    when 'expenses' then
      update public.expenses set status = case when p_approved then 'approved' else 'rejected' end::public.expense_status where id = a.entity_id;
    when 'material_requests' then
      update public.material_requests set status = case when p_approved then 'pm_approved' else 'rejected' end::public.material_request_status where id = a.entity_id;
    when 'drawings' then
      update public.drawings set status = case when p_approved then 'approved' else 'draft' end::public.drawing_status where id = a.entity_id;
    when 'payments' then
      update public.payments set status = case when p_approved then 'confirmed' else 'cancelled' end::public.payment_status where id = a.entity_id;
    when 'stages' then
      if p_approved then
        update public.stages set status = 'verified', progress_pct = 100, completed_at = coalesce(completed_at, current_date) where id = a.entity_id;
      else
        update public.stages set status = 'in_progress' where id = a.entity_id;
      end if;
    when 'boq' then -- entity_id = project id, ref_version = BOQ version
      if p_approved then
        update public.boq_items set status = 'superseded'
          where project_id = a.entity_id and status = 'approved' and boq_version <> a.ref_version;
        update public.boq_items set status = 'approved'
          where project_id = a.entity_id and boq_version = a.ref_version;
        update public.stages s set budget_amount = coalesce((select sum(b.amount) from public.boq_items b
          where b.stage_id = s.id and b.status = 'approved'), 0)
          where s.project_id = a.entity_id;
      else
        update public.boq_items set status = 'draft' where project_id = a.entity_id and boq_version = a.ref_version;
      end if;
    else null;
  end case;
  perform set_config('app.approval_engine', 'off', true);
end $$;

-- ---------------------------------------------------------------- approval-only statuses
-- These statuses can only be set by the approvals engine (decide_approval).

create or replace function public.guard_approval_status()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.approval_engine', true), 'off') = 'on' then return new; end if;
  if new.status::text = any(tg_argv)
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    raise exception 'Status "%" can only be set through the Approvals Center', new.status;
  end if;
  return new;
end $$;

-- 'paid' is only allowed after 'approved'.
create or replace function public.guard_paid_after_approved()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.approval_engine', true), 'off') = 'on' then return new; end if;
  if new.status = 'paid' and (tg_op = 'INSERT' or (old.status <> 'approved' and old.status <> 'paid')) then
    raise exception 'This must be approved before it is marked paid';
  end if;
  return new;
end $$;

do $$
declare r record;
begin
  for r in select * from (values
    ('leave_requests',    array['approved','rejected']),
    ('change_requests',   array['approved','rejected']),
    ('purchase_orders',   array['approved','rejected']),
    ('supplier_payments', array['approved','rejected']),
    ('expenses',          array['approved','rejected']),
    ('material_requests', array['pm_approved','rejected']),
    ('drawings',          array['approved']),
    ('stages',            array['verified']),
    ('boq_items',         array['approved'])
  ) v(tbl, statuses) loop
    execute format('drop trigger if exists guard_approval_status on public.%I', r.tbl);
    execute format('create trigger guard_approval_status before insert or update of status on public.%I
                    for each row execute function public.guard_approval_status(%s)', r.tbl,
                   (select string_agg(quote_literal(s), ', ') from unnest(r.statuses) s));
  end loop;
end $$;

drop trigger if exists guard_paid_after_approved on public.supplier_payments;
create trigger guard_paid_after_approved before insert or update of status on public.supplier_payments
  for each row execute function public.guard_paid_after_approved();
drop trigger if exists guard_paid_after_approved on public.expenses;
create trigger guard_paid_after_approved before insert or update of status on public.expenses
  for each row execute function public.guard_paid_after_approved();

-- Approve or reject the current step.
create or replace function public.decide_approval(p_approval uuid, p_approve boolean, p_comment text default null)
returns public.approvals language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  s public.approvals; v_role text; v_next uuid;
begin
  select * into s from public.approvals where id = p_approval for update;
  if not found then raise exception 'Approval not found'; end if;
  if s.status <> 'pending' then raise exception 'This step was already decided'; end if;
  if public.current_approval_step(s.request_group) is distinct from s.id then
    raise exception 'An earlier step must be decided first';
  end if;
  if s.requested_by = v_user then raise exception 'You cannot approve your own request'; end if;
  select code into v_role from public.roles where id = s.required_role_id;
  if not public.has_role(v_role) then raise exception 'This step needs the % role', v_role; end if;
  if not exists (select 1 from public.approval_step_candidates(s.id) c where c = v_user) then
    raise exception 'Only the % assigned to this project can decide this step', replace(v_role, '_', ' ');
  end if;
  if exists (select 1 from public.approvals where request_group = s.request_group
             and approver_id = v_user and status = 'approved') then
    raise exception 'You already approved an earlier step of this request; another person must approve this one';
  end if;
  if not p_approve and coalesce(trim(p_comment), '') = '' then
    raise exception 'Please give a reason for rejecting';
  end if;

  update public.approvals
     set status = case when p_approve then 'approved' else 'rejected' end::public.approval_status,
         approver_id = v_user, comment = nullif(trim(p_comment), ''), decided_at = now()
   where id = s.id returning * into s;

  if not p_approve then
    update public.approvals set status = 'cancelled', decided_at = now()
     where request_group = s.request_group and status = 'pending';
    perform public._apply_approval_outcome(s.request_group, false);
    perform public.notify(s.requested_by, 'Rejected: ' || s.title, s.comment,
      '/owner/approvals?id=' || s.request_group, 'approval', 'approvals', s.request_group);
  else
    v_next := public.current_approval_step(s.request_group);
    if v_next is null then
      perform public._apply_approval_outcome(s.request_group, true);
      perform public.notify(s.requested_by, 'Approved: ' || s.title, s.comment,
        '/owner/approvals?id=' || s.request_group, 'approval', 'approvals', s.request_group);
    else
      perform public._notify_step(v_next);
    end if;
  end if;
  return s;
end $$;

-- Requester can withdraw a request that is still pending.
create or replace function public.cancel_approval(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.approvals where request_group = p_group and requested_by = auth.uid()) then
    raise exception 'Only the requester can withdraw this request';
  end if;
  update public.approvals set status = 'cancelled', decided_at = now()
   where request_group = p_group and status = 'pending';
end $$;

-- One row per request with its overall status and current step.
create or replace view public.approval_requests with (security_invoker = true) as
select
  g.request_group,
  min(g.approval_type::text)::public.approval_type as approval_type,
  min(g.entity_table) as entity_table,
  (array_agg(g.entity_id))[1] as entity_id,
  min(g.title) as title,
  min(g.link) as link,
  max(g.amount) as amount,
  (array_agg(g.requested_by))[1] as requested_by,
  min(g.created_at) as created_at,
  max(g.decided_at) as last_decided_at,
  case
    when bool_or(g.status = 'rejected') then 'rejected'
    when bool_or(g.status = 'pending') then 'pending'
    when bool_and(g.status in ('approved','skipped')) then 'approved'
    else 'cancelled' end as overall_status,
  (select a.id from public.approvals a where a.request_group = g.request_group and a.status = 'pending'
     order by a.step_order limit 1) as current_step_id,
  (select r.code from public.approvals a join public.roles r on r.id = a.required_role_id
     where a.request_group = g.request_group and a.status = 'pending' order by a.step_order limit 1) as current_role,
  count(*)::int as steps
from public.approvals g
group by g.request_group;

-- ================================================================ STOCK

create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.item_id <> old.item_id or new.direction <> old.direction or new.quantity <> old.quantity then
      raise exception 'Stock movements cannot be changed; record an adjustment instead';
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    update public.inventory_items set qty_on_hand = qty_on_hand
      + case new.direction when 'in' then new.quantity when 'out' then -new.quantity else new.quantity end
      where id = new.item_id;
    return new;
  end if;
  -- DELETE: undo
  update public.inventory_items set qty_on_hand = qty_on_hand
    - case old.direction when 'in' then old.quantity when 'out' then -old.quantity else old.quantity end
    where id = old.item_id;
  return old;
end $$;

drop trigger if exists apply_stock_movement on public.stock_movements;
create trigger apply_stock_movement after insert or update or delete on public.stock_movements
  for each row execute function public.apply_stock_movement();

create or replace view public.low_stock_items with (security_invoker = true) as
select i.* from public.inventory_items i
where i.reorder_level is not null and i.qty_on_hand <= i.reorder_level;

-- ================================================================ OFFLINE SYNC

create or replace function public.stamp_synced_at()
returns trigger language plpgsql as $$
begin
  if new.client_id is not null and new.synced_at is null then new.synced_at := now(); end if;
  return new;
end $$;

drop trigger if exists stamp_synced_at on public.daily_reports;
create trigger stamp_synced_at before insert on public.daily_reports
  for each row execute function public.stamp_synced_at();
drop trigger if exists stamp_synced_at on public.site_attendance;
create trigger stamp_synced_at before insert on public.site_attendance
  for each row execute function public.stamp_synced_at();

-- ================================================================ GENERAL LEDGER

create or replace function public.acct(p_code text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.chart_of_accounts where code = p_code;
$$;

-- GL account behind a bank account, or a default by payment method.
create or replace function public.money_account(p_bank uuid, p_method public.payment_method) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select gl_account_id from public.bank_accounts where id = p_bank),
    public.acct(case p_method when 'cash' then '1000' when 'bank' then '1010' else '1020' end));
$$;

-- Lines must balance before an entry can be posted; posted lines are locked.
create or replace function public.check_journal_balance()
returns trigger language plpgsql as $$
declare d numeric; c numeric;
begin
  if new.status = 'posted' and old.status is distinct from 'posted' then
    select coalesce(sum(debit),0), coalesce(sum(credit),0) into d, c
      from public.journal_lines where entry_id = new.id;
    if d = 0 or d <> c then
      raise exception 'Journal entry does not balance (debits %, credits %)', d, c;
    end if;
    new.posted_at := now();
  end if;
  if old.status = 'posted' and new.status = 'draft' then
    raise exception 'A posted entry cannot go back to draft; void it instead';
  end if;
  if old.status = 'void' and new.status <> 'void' then
    raise exception 'A void entry cannot be reopened';
  end if;
  return new;
end $$;

drop trigger if exists check_journal_balance on public.journal_entries;
create trigger check_journal_balance before update on public.journal_entries
  for each row execute function public.check_journal_balance();

create or replace function public.lock_posted_lines()
returns trigger language plpgsql as $$
declare v_status public.journal_status;
begin
  select status into v_status from public.journal_entries
   where id = coalesce(new.entry_id, old.entry_id);
  if v_status in ('posted','void') then
    raise exception 'Lines of a posted or void entry cannot be changed';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists lock_posted_lines on public.journal_lines;
create trigger lock_posted_lines before insert or update or delete on public.journal_lines
  for each row execute function public.lock_posted_lines();

-- p_lines: [{"account": uuid, "debit": n, "credit": n, "project_id": uuid?, "description": text?}, ...]
create or replace function public.post_journal(
  p_date date, p_memo text, p_source_table text, p_source_id uuid, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; l jsonb;
begin
  insert into public.journal_entries (entry_date, memo, source_table, source_id, created_by)
  values (coalesce(p_date, current_date), p_memo, p_source_table, p_source_id, auth.uid())
  returning id into v_id;
  for l in select * from jsonb_array_elements(p_lines) loop
    insert into public.journal_lines (entry_id, account_id, project_id, description, debit, credit)
    values (v_id, (l->>'account')::uuid, nullif(l->>'project_id','')::uuid, l->>'description',
            coalesce((l->>'debit')::numeric, 0), coalesce((l->>'credit')::numeric, 0));
  end loop;
  update public.journal_entries set status = 'posted' where id = v_id;
  return v_id;
end $$;

create or replace function public.void_journal_for(p_source_table text, p_source_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.journal_entries set status = 'void'
   where source_table = p_source_table and source_id = p_source_id and status = 'posted';
$$;

create or replace function public._jl(p_account uuid, p_debit numeric, p_credit numeric, p_project uuid default null)
returns jsonb language sql immutable as $$
  select jsonb_build_object('account', p_account, 'debit', p_debit, 'credit', p_credit, 'project_id', p_project);
$$;

-- ---------------------------------------------------------------- invoices

create or replace function public.refresh_invoice(p_invoice uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_paid numeric; inv public.invoices;
begin
  select * into inv from public.invoices where id = p_invoice for update;
  if not found then return; end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments
   where invoice_id = p_invoice and status = 'confirmed';
  update public.invoices set amount_paid = v_paid,
    status = case
      when inv.status in ('draft','cancelled') then inv.status
      when v_paid >= inv.amount then 'paid'
      when inv.due_date is not null and inv.due_date < current_date then 'overdue'
      when v_paid > 0 then 'partially_paid'
      else 'pending' end::public.invoice_status
   where id = p_invoice;
end $$;

create or replace function public.on_invoice_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Issued: Dr receivable / Cr revenue (deposit invoices: Cr client deposits)
  if new.status not in ('draft','cancelled') and (tg_op = 'INSERT' or old.status in ('draft')) then
    if new.issue_date is null then
      update public.invoices set issue_date = current_date where id = new.id;
    end if;
    perform public.post_journal(coalesce(new.issue_date, current_date), 'Invoice ' || new.invoice_no,
      'invoices', new.id, jsonb_build_array(
        public._jl(public.acct('1100'), new.amount, 0, new.project_id),
        public._jl(public.acct(case new.invoice_type when 'deposit' then '2100' else '4000' end), 0, new.amount, new.project_id)));
  elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status <> 'cancelled' then
    perform public.void_journal_for('invoices', new.id);
  end if;
  return null;
end $$;

drop trigger if exists on_invoice_change on public.invoices;
create trigger on_invoice_change after insert or update of status on public.invoices
  for each row execute function public.on_invoice_change();

-- ---------------------------------------------------------------- client payments

create or replace function public.on_payment_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.payments := coalesce(new, old);
begin
  if tg_op <> 'DELETE' and new.status = 'confirmed' and (tg_op = 'INSERT' or old.status <> 'confirmed') then
    if new.paid_at is null then update public.payments set paid_at = now() where id = new.id; end if;
    perform public.post_journal(coalesce(new.paid_at, now())::date, 'Client payment',
      'payments', new.id, jsonb_build_array(
        public._jl(public.money_account(new.bank_account_id, new.method), new.amount, 0, new.project_id),
        public._jl(public.acct(case when new.invoice_id is null then '2100' else '1100' end), 0, new.amount, new.project_id)));
  elsif tg_op = 'UPDATE' and old.status = 'confirmed' and new.status <> 'confirmed' then
    perform public.void_journal_for('payments', new.id);
  end if;
  if r.invoice_id is not null then perform public.refresh_invoice(r.invoice_id); end if;
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id and old.invoice_id is not null then
    perform public.refresh_invoice(old.invoice_id);
  end if;
  return null;
end $$;

drop trigger if exists on_payment_change on public.payments;
create trigger on_payment_change after insert or update or delete on public.payments
  for each row execute function public.on_payment_change();

-- ---------------------------------------------------------------- suppliers, expenses, rent, payroll

-- Purchase order delivered: Dr materials cost / Cr accounts payable
create or replace function public.on_po_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'delivered' and old.status <> 'delivered' then
    perform public.post_journal(current_date, 'PO ' || new.po_number || ' delivered', 'purchase_orders', new.id,
      jsonb_build_array(public._jl(public.acct('5000'), new.total_amount, 0, new.project_id),
                        public._jl(public.acct('2000'), 0, new.total_amount, new.project_id)));
  elsif new.status = 'cancelled' and old.status = 'delivered' then
    perform public.void_journal_for('purchase_orders', new.id);
  end if;
  return null;
end $$;
drop trigger if exists on_po_change on public.purchase_orders;
create trigger on_po_change after update of status on public.purchase_orders
  for each row execute function public.on_po_change();

-- Supplier paid: Dr accounts payable / Cr cash-bank
create or replace function public.on_supplier_payment_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_project uuid;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status <> 'paid') then
    select project_id into v_project from public.purchase_orders where id = new.purchase_order_id;
    if new.paid_at is null then update public.supplier_payments set paid_at = now() where id = new.id; end if;
    perform public.post_journal(coalesce(new.paid_at, now())::date, 'Supplier payment', 'supplier_payments', new.id,
      jsonb_build_array(public._jl(public.acct('2000'), new.amount, 0, v_project),
                        public._jl(public.money_account(new.bank_account_id, new.method), 0, new.amount, v_project)));
  elsif tg_op = 'UPDATE' and old.status = 'paid' and new.status <> 'paid' then
    perform public.void_journal_for('supplier_payments', new.id);
  end if;
  return null;
end $$;
drop trigger if exists on_supplier_payment_change on public.supplier_payments;
create trigger on_supplier_payment_change after insert or update of status on public.supplier_payments
  for each row execute function public.on_supplier_payment_change();

-- Expense paid: Dr expense account / Cr cash-bank
create or replace function public.on_expense_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status <> 'paid') then
    perform public.post_journal(new.expense_date, new.description, 'expenses', new.id,
      jsonb_build_array(public._jl(new.account_id, new.amount, 0, new.project_id),
                        public._jl(public.money_account(new.bank_account_id, new.method), 0, new.amount, new.project_id)));
  elsif tg_op = 'UPDATE' and old.status = 'paid' and new.status <> 'paid' then
    perform public.void_journal_for('expenses', new.id);
  end if;
  return null;
end $$;
drop trigger if exists on_expense_change on public.expenses;
create trigger on_expense_change after insert or update of status on public.expenses
  for each row execute function public.on_expense_change();

-- Rent received: Dr cash-bank / Cr rental income
create or replace function public.on_rent_payment_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status <> 'confirmed') then
    if new.paid_at is null then update public.rent_payments set paid_at = now() where id = new.id; end if;
    perform public.post_journal(coalesce(new.paid_at, now())::date, 'Rent ' || to_char(new.period_month, 'Mon YYYY'),
      'rent_payments', new.id,
      jsonb_build_array(public._jl(public.money_account(new.bank_account_id, new.method), new.amount, 0),
                        public._jl(public.acct('4100'), 0, new.amount)));
  elsif tg_op = 'UPDATE' and old.status = 'confirmed' and new.status <> 'confirmed' then
    perform public.void_journal_for('rent_payments', new.id);
  end if;
  return null;
end $$;
drop trigger if exists on_rent_payment_change on public.rent_payments;
create trigger on_rent_payment_change after insert or update of status on public.rent_payments
  for each row execute function public.on_rent_payment_change();

-- Payroll paid: Dr salaries / Cr bank
create or replace function public.on_payroll_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status <> 'paid') then
    if new.paid_at is null then update public.payroll set paid_at = now() where id = new.id; end if;
    perform public.post_journal(current_date, 'Payroll ' || to_char(new.period_month, 'Mon YYYY'), 'payroll', new.id,
      jsonb_build_array(public._jl(public.acct('5200'), new.net, 0),
                        public._jl(public.acct('1010'), 0, new.net)));
  end if;
  return null;
end $$;
drop trigger if exists on_payroll_change on public.payroll;
create trigger on_payroll_change after insert or update of status on public.payroll
  for each row execute function public.on_payroll_change();

-- ---------------------------------------------------------------- overdue invoices (daily)

create or replace function public.mark_overdue_invoices() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.invoices set status = 'overdue'
   where status in ('pending','partially_paid') and amount_paid < amount
     and due_date is not null and due_date < current_date;
  get diagnostics n = row_count;
  return n;
end $$;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('mark-overdue-invoices', '0 0 * * *', 'select public.mark_overdue_invoices()');
exception when others then
  raise notice 'pg_cron not available (%). Enable it in Supabase > Database > Extensions to mark overdue invoices daily.', sqlerrm;
end $$;

-- ================================================================ REPORTING VIEWS

-- Ledger balance per account (posted entries only).
create or replace view public.account_balances with (security_invoker = true) as
select a.id as account_id, a.code, a.name, a.type,
       coalesce(sum(l.debit), 0) as debit, coalesce(sum(l.credit), 0) as credit,
       case when a.type in ('asset','expense') then coalesce(sum(l.debit - l.credit), 0)
            else coalesce(sum(l.credit - l.debit), 0) end as balance
from public.chart_of_accounts a
left join public.journal_lines l on l.account_id = a.id
  and exists (select 1 from public.journal_entries e where e.id = l.entry_id and e.status = 'posted')
group by a.id;

-- Per-project progress and money.
create or replace view public.project_summary with (security_invoker = true) as
select p.id as project_id, p.code, p.name, p.status, p.client_id, p.manager_id, p.start_date, p.end_date,
       p.contract_value, p.budget,
       (select count(*) from public.stages s where s.project_id = p.id)::int as stage_count,
       (select coalesce(round(avg(s.progress_pct)), 0) from public.stages s where s.project_id = p.id)::int as progress_pct,
       (select coalesce(sum(s.budget_amount), 0) from public.stages s where s.project_id = p.id) as stage_budget,
       (select coalesce(sum(i.amount), 0) from public.invoices i where i.project_id = p.id and i.status <> 'cancelled') as invoiced,
       (select coalesce(sum(i.amount_paid), 0) from public.invoices i where i.project_id = p.id and i.status <> 'cancelled') as collected,
       (select coalesce(sum(l.debit), 0) from public.journal_lines l
          join public.chart_of_accounts a on a.id = l.account_id and a.type = 'expense'
          join public.journal_entries e on e.id = l.entry_id and e.status = 'posted'
         where l.project_id = p.id) as actual_cost,
       (p.end_date is not null and p.end_date < current_date and p.status in ('design','boq','active')) as is_delayed
from public.projects p;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261127000400_rls.sql
-- ============================================================================
-- Hangool ERP · 0400 · Row Level Security on every table. Safe to re-run.
--
-- Model:
--   * Owner sees and changes everything (is_owner() short-circuits perm_scope).
--   * Other staff: role_permissions decides per area (read/write, all/assigned).
--     'assigned' = only projects where the person is manager or a project member.
--   * Clients: only their own client row, their projects and what is shared with them.
--   * Employees: their own employee, leave, payroll and attendance records.
--   * anon (not signed in): nothing. All policies are "to authenticated".
-- ============================================================================

-- ---------------------------------------------------------------- extra helpers

create or replace function public.is_management() returns boolean
language sql stable as $$ select public.has_any_role(array['owner','general_manager']) $$;

create or replace function public.can_see_approval_group(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_all('approvals') or (public.mfa_ok() and exists (
    select 1 from public.approvals a
    where a.request_group = p_group
      and (a.requested_by = auth.uid() or a.approver_id = auth.uid()
           or exists (select 1 from public.approval_step_candidates(a.id) c where c = auth.uid()))));
$$;

create or replace function public.can_see_document(p_doc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documents d
    where d.id = p_doc and (
         public.can_all('documents')
      or d.created_by = auth.uid()
      or (d.project_id is not null and public.can_project('documents', d.project_id))
      or (d.employee_id is not null and d.employee_id = public.my_employee_id())
      or exists (select 1 from public.document_access x where x.document_id = d.id and x.user_id = auth.uid())
      or exists (select 1 from public.document_access x join public.roles r on r.id = x.role_id
                 where x.document_id = d.id and public.has_role(r.code)
                   and (r.is_staff
                        or (d.project_id is not null and public.is_project_client(d.project_id))
                        or (d.client_id is not null and d.client_id in (select public.my_client_ids()))))
    ));
$$;

create or replace function public.can_edit_document(p_doc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documents d
    where d.id = p_doc and (
         public.can_all('documents', true)
      or (d.created_by = auth.uid() and public.is_staff())
      or (d.project_id is not null and public.can_project('documents', d.project_id, true))
      or exists (select 1 from public.document_access x where x.document_id = d.id and x.can_edit
                 and (x.user_id = auth.uid()
                      or exists (select 1 from public.roles r where r.id = x.role_id and r.is_staff and public.has_role(r.code))))
    ));
$$;

-- Keep documents.current_version in step with the newest version.
create or replace function public.bump_document_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.documents set current_version = greatest(current_version, new.version_no), updated_at = now()
   where id = new.document_id;
  return null;
end $$;
drop trigger if exists bump_document_version on public.document_versions;
create trigger bump_document_version after insert on public.document_versions
  for each row execute function public.bump_document_version();

-- Staff directory without salaries (employees table itself is HR-only).
create or replace view public.employee_directory as
select e.id, e.user_id, e.employee_no, e.full_name, e.phone, e.job_title, e.department, e.status
from public.employees e
where public.is_staff();
revoke all on public.employee_directory from anon;
grant select on public.employee_directory to authenticated;

-- ---------------------------------------------------------------- enable RLS everywhere

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
-- RLS is not forced: the table owner (postgres) runs the SECURITY DEFINER helpers,
-- triggers, migrations and seed. service_role bypasses RLS too, so it stays server-side only.

-- ---------------------------------------------------------------- ACCESS / CORE

select public._policy('roles','roles_select','select','true');
select public._policy('roles','roles_write','all','public.is_owner()','public.is_owner()');

select public._policy('role_permissions','rp_select','select','true');
select public._policy('role_permissions','rp_write','all','public.is_owner()','public.is_owner()');

select public._policy('profiles','profiles_select','select',
  'id = auth.uid() or public.is_staff()
   or exists (select 1 from public.projects p where p.manager_id = profiles.id and public.is_project_client(p.id))
   or exists (select 1 from public.project_members m where m.user_id = profiles.id and public.is_project_client(m.project_id))
   or exists (select 1 from public.messages g where g.sender_id = profiles.id and g.client_id in (select public.my_client_ids()))');
select public._policy('profiles','profiles_update','update',
  'id = auth.uid() or public.is_owner()', 'id = auth.uid() or public.is_owner()');
select public._policy('profiles','profiles_insert','insert', null, 'public.is_owner()');
select public._policy('profiles','profiles_delete','delete','public.is_owner() and id <> auth.uid()');

select public._policy('user_roles','user_roles_select','select','user_id = auth.uid() or public.can(''staff'')');
select public._policy('user_roles','user_roles_write','all','public.is_owner()','public.is_owner()');

select public._policy('settings','settings_select','select','public.is_staff() or key in (''company'',''currency'')');
select public._policy('settings','settings_write','all','public.is_owner()','public.is_owner()');

select public._policy('notifications','notifications_select','select','user_id = auth.uid()');
select public._policy('notifications','notifications_update','update','user_id = auth.uid()','user_id = auth.uid()');
select public._policy('notifications','notifications_delete','delete','user_id = auth.uid()');

select public._policy('audit_log','audit_select','select','public.can(''audit'')');
-- no insert/update/delete policies: rows are written only by the audit trigger.

-- doc_counters: no policies (only next_doc_no, a definer function, touches it).

select public._policy('approval_rules','approval_rules_select','select','public.is_staff()');
select public._policy('approval_rules','approval_rules_write','all','public.is_owner()','public.is_owner()');

select public._policy('approvals','approvals_select','select','public.can_see_approval_group(request_group)');
-- no write policies: request_approval / decide_approval / cancel_approval do the writes.

-- ---------------------------------------------------------------- MARKETING / CRM

select public._policy('campaigns','campaigns_select','select','public.can(''marketing'')');
select public._policy('campaigns','campaigns_write','all','public.can(''marketing'', true)','public.can(''marketing'', true)');

select public._policy('leads','leads_select','select','public.can(''crm'') or assigned_to = auth.uid()');
select public._policy('leads','leads_insert','insert', null, 'public.can(''crm'', true)');
select public._policy('leads','leads_update','update','public.can(''crm'', true) or assigned_to = auth.uid()','public.can(''crm'', true) or assigned_to = auth.uid()');
select public._policy('leads','leads_delete','delete','public.is_management()');

select public._policy('follow_ups','follow_ups_select','select','public.can(''crm'') or assigned_to = auth.uid()');
select public._policy('follow_ups','follow_ups_insert','insert', null, 'public.can(''crm'', true)');
select public._policy('follow_ups','follow_ups_update','update','public.can(''crm'', true) or assigned_to = auth.uid()','public.can(''crm'', true) or assigned_to = auth.uid()');
select public._policy('follow_ups','follow_ups_delete','delete','public.can(''crm'', true)');

select public._policy('clients','clients_select','select',
  'public.can(''crm'') or public.can_all(''finance'') or id in (select public.my_client_ids())
   or exists (select 1 from public.projects p where p.client_id = clients.id and public.can_project(''projects'', p.id))');
select public._policy('clients','clients_insert','insert', null, 'public.can(''crm'', true)');
select public._policy('clients','clients_update','update','public.can(''crm'', true)','public.can(''crm'', true)');
select public._policy('clients','clients_delete','delete','public.is_management()');

select public._policy('contracts','contracts_select','select',
  'public.can_project(''finance'', project_id) or public.can(''crm'') or public.is_project_client(project_id)');
select public._policy('contracts','contracts_insert','insert', null, 'public.can_all(''finance'', true) or public.can(''crm'', true)');
select public._policy('contracts','contracts_update','update','public.can_all(''finance'', true) or public.can(''crm'', true)','public.can_all(''finance'', true) or public.can(''crm'', true)');
select public._policy('contracts','contracts_delete','delete','public.is_management()');

select public._policy('messages','messages_select','select',
  'client_id in (select public.my_client_ids()) or public.can(''crm'')
   or (project_id is not null and public.is_project_member(project_id))');
select public._policy('messages','messages_insert','insert', null,
  'sender_id = auth.uid() and (
     (client_id in (select public.my_client_ids()) and (project_id is null or public.is_project_client(project_id)))
     or public.can(''crm'', true)
     or (project_id is not null and public.is_project_member(project_id)))');
select public._policy('messages','messages_update','update',
  'sender_id = auth.uid() or client_id in (select public.my_client_ids()) or public.can(''crm'', true)',
  'sender_id = auth.uid() or client_id in (select public.my_client_ids()) or public.can(''crm'', true)');

do $$ declare t text; begin
  foreach t in array array['complaints','warranty_claims'] loop
    perform public._policy(t, t||'_select','select',
      'client_id in (select public.my_client_ids()) or public.can(''crm'') or assigned_to = auth.uid()
       or (project_id is not null and public.can_project(''projects'', project_id))');
    perform public._policy(t, t||'_insert','insert', null,
      '(client_id in (select public.my_client_ids()) and (project_id is null or public.is_project_client(project_id)))
       or public.can(''crm'', true)');
    perform public._policy(t, t||'_update','update',
      'public.can(''crm'', true) or assigned_to = auth.uid() or (project_id is not null and public.can_project(''projects'', project_id, true))',
      'public.can(''crm'', true) or assigned_to = auth.uid() or (project_id is not null and public.can_project(''projects'', project_id, true))');
    perform public._policy(t, t||'_delete','delete','public.is_management()');
  end loop;
end $$;

-- ---------------------------------------------------------------- PROJECTS

select public._policy('projects','projects_select','select','public.can_project(''projects'', id) or public.is_project_client(id)');
select public._policy('projects','projects_insert','insert', null, 'public.can_all(''projects'', true)');
select public._policy('projects','projects_update','update','public.can_project(''projects'', id, true)','public.can_project(''projects'', id, true)');
select public._policy('projects','projects_delete','delete','public.is_owner()');

select public._policy('stages','stages_select','select','public.can_project(''projects'', project_id) or public.is_project_client(project_id)');
select public._policy('stages','stages_insert','insert', null, 'public.can_project(''projects'', project_id, true)');
select public._policy('stages','stages_update','update','public.can_project(''projects'', project_id, true)','public.can_project(''projects'', project_id, true)');
select public._policy('stages','stages_delete','delete','public.can_project(''projects'', project_id, true)');

select public._policy('project_members','pm_select','select','public.can_project(''projects'', project_id) or user_id = auth.uid()');
select public._policy('project_members','pm_write','all',
  'public.can_all(''projects'', true) or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = auth.uid())',
  'public.can_all(''projects'', true) or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = auth.uid())');

select public._policy('drawings','drawings_select','select',
  'public.can_project(''design'', project_id)
   or (public.is_project_client(project_id) and status in (''submitted'',''approved''))');
select public._policy('drawings','drawings_insert','insert', null, 'public.can_project(''design'', project_id, true) and uploaded_by = auth.uid()');
select public._policy('drawings','drawings_update','update',
  'public.can_project(''design'', project_id, true) and (locked_at is null or public.is_owner())',
  'public.can_project(''design'', project_id, true)');
select public._policy('drawings','drawings_delete','delete','public.is_management()');

select public._policy('change_requests','cr_select','select',
  'public.can_project(''design'', project_id) or public.can_project(''boq'', project_id)
   or public.can_project(''projects'', project_id) or public.is_project_client(project_id)');
select public._policy('change_requests','cr_insert','insert', null,
  'requested_by = auth.uid() and (public.can_project(''design'', project_id, true)
   or public.can_project(''projects'', project_id, true) or public.is_project_client(project_id))');
select public._policy('change_requests','cr_update','update',
  'public.can_project(''design'', project_id, true) or public.can_project(''boq'', project_id, true)',
  'public.can_project(''design'', project_id, true) or public.can_project(''boq'', project_id, true)');
select public._policy('change_requests','cr_delete','delete','public.is_management()');

select public._policy('boq_items','boq_select','select','public.can_project(''boq'', project_id)');
select public._policy('boq_items','boq_insert','insert', null, 'public.can_project(''boq'', project_id, true) and prepared_by = auth.uid()');
select public._policy('boq_items','boq_update','update','public.can_project(''boq'', project_id, true) and status <> ''approved''','public.can_project(''boq'', project_id, true)');
select public._policy('boq_items','boq_delete','delete','public.can_project(''boq'', project_id, true) and status = ''draft''');

-- ---------------------------------------------------------------- PROCUREMENT

select public._policy('suppliers','suppliers_select','select','public.can(''procurement'') or public.can(''finance'') or public.can(''inventory'')');
select public._policy('suppliers','suppliers_insert','insert', null, 'public.can_all(''procurement'', true)');
select public._policy('suppliers','suppliers_update','update','public.can_all(''procurement'', true)','public.can_all(''procurement'', true)');
select public._policy('suppliers','suppliers_delete','delete','public.is_management()');

select public._policy('material_requests','mr_select','select',
  'public.can_project(''procurement'', project_id) or public.can_project(''site'', project_id) or public.can_all(''inventory'')');
select public._policy('material_requests','mr_insert','insert', null,
  'requested_by = auth.uid() and (public.can_project(''procurement'', project_id, true) or public.can_project(''site'', project_id, true))');
select public._policy('material_requests','mr_update','update',
  'public.can_project(''procurement'', project_id, true) or public.can_all(''inventory'', true)',
  'public.can_project(''procurement'', project_id, true) or public.can_all(''inventory'', true)');
select public._policy('material_requests','mr_delete','delete',
  'public.is_management() or (requested_by = auth.uid() and status = ''submitted'')');

select public._policy('request_items','ri_select','select',
  'exists (select 1 from public.material_requests mr where mr.id = request_id)');
select public._policy('request_items','ri_write','all',
  'exists (select 1 from public.material_requests mr where mr.id = request_id and (
     public.can_project(''procurement'', mr.project_id, true) or public.can_all(''inventory'', true)
     or (mr.requested_by = auth.uid() and mr.status = ''submitted'')))',
  'exists (select 1 from public.material_requests mr where mr.id = request_id and (
     public.can_project(''procurement'', mr.project_id, true) or public.can_all(''inventory'', true)
     or (mr.requested_by = auth.uid() and mr.status = ''submitted'')))');

select public._policy('quotes','quotes_select','select',
  'public.can_all(''procurement'') or public.can(''finance'')
   or exists (select 1 from public.material_requests mr where mr.id = request_id and public.can_project(''procurement'', mr.project_id))');
select public._policy('quotes','quotes_write','all','public.can_all(''procurement'', true)','public.can_all(''procurement'', true)');

select public._policy('purchase_orders','po_select','select',
  'public.can_all(''procurement'') or public.can(''finance'') or public.can_all(''inventory'')
   or (project_id is not null and public.can_project(''procurement'', project_id))');
select public._policy('purchase_orders','po_insert','insert', null, 'public.can_all(''procurement'', true) and created_by = auth.uid()');
select public._policy('purchase_orders','po_update','update',
  'public.can_all(''procurement'', true) or public.can_all(''inventory'', true)',
  'public.can_all(''procurement'', true) or public.can_all(''inventory'', true)');
select public._policy('purchase_orders','po_delete','delete','public.is_management()');

select public._policy('supplier_payments','sp_select','select','public.can(''finance'') or public.can_all(''procurement'')');
select public._policy('supplier_payments','sp_insert','insert', null, 'public.can_all(''finance'', true) and recorded_by = auth.uid()');
select public._policy('supplier_payments','sp_update','update','public.can_all(''finance'', true)','public.can_all(''finance'', true)');
select public._policy('supplier_payments','sp_delete','delete','public.is_owner()');

-- ---------------------------------------------------------------- INVENTORY

select public._policy('inventory_items','inv_select','select','public.can(''inventory'') or public.can(''procurement'') or public.can(''boq'')');
select public._policy('inventory_items','inv_insert','insert', null, 'public.can_all(''inventory'', true) or public.can_all(''procurement'', true)');
select public._policy('inventory_items','inv_update','update','public.can_all(''inventory'', true) or public.can_all(''procurement'', true)','public.can_all(''inventory'', true) or public.can_all(''procurement'', true)');
select public._policy('inventory_items','inv_delete','delete','public.is_management()');

select public._policy('stock_movements','sm_select','select',
  'public.can_all(''inventory'') or public.can_all(''procurement'') or public.can(''finance'')
   or (project_id is not null and (public.can_project(''inventory'', project_id) or public.can_project(''site'', project_id)))');
select public._policy('stock_movements','sm_insert','insert', null, 'public.can_all(''inventory'', true) and recorded_by = auth.uid()');
select public._policy('stock_movements','sm_update','update','public.can_all(''inventory'', true)','public.can_all(''inventory'', true)');
select public._policy('stock_movements','sm_delete','delete','public.is_owner()');

-- ---------------------------------------------------------------- SITE

select public._policy('daily_reports','dr_select','select',
  'public.can_project(''site'', project_id) or public.can_project(''projects'', project_id)
   or (visible_to_client and public.is_project_client(project_id))');
select public._policy('daily_reports','dr_insert','insert', null, 'author_id = auth.uid() and public.can_project(''site'', project_id, true)');
select public._policy('daily_reports','dr_update','update','public.can_project(''site'', project_id, true)','public.can_project(''site'', project_id, true)');
select public._policy('daily_reports','dr_delete','delete','public.is_management()');

select public._policy('labourers','lab_select','select','public.can(''site'') or public.can(''hr'') or public.can(''finance'')');
select public._policy('labourers','lab_write','all','public.can(''site'', true) or public.can_all(''hr'', true)','public.can(''site'', true) or public.can_all(''hr'', true)');

select public._policy('site_attendance','att_select','select',
  'public.can_project(''site'', project_id) or public.can_all(''hr'')
   or (employee_id is not null and employee_id = public.my_employee_id())');
select public._policy('site_attendance','att_insert','insert', null,
  'recorded_by = auth.uid() and (public.can_project(''site'', project_id, true)
   or (employee_id is not null and employee_id = public.my_employee_id()))');
select public._policy('site_attendance','att_update','update',
  'public.can_project(''site'', project_id, true) or public.can_all(''hr'', true)
   or (employee_id = public.my_employee_id() and recorded_by = auth.uid() and work_date = current_date)',
  'public.can_project(''site'', project_id, true) or public.can_all(''hr'', true)
   or (employee_id = public.my_employee_id() and recorded_by = auth.uid() and work_date = current_date)');
select public._policy('site_attendance','att_delete','delete','public.is_management()');

select public._policy('labour_payments','lp_select','select',
  'public.can_project(''site'', project_id) or public.can(''finance'') or public.can_all(''hr'')');
select public._policy('labour_payments','lp_insert','insert', null,
  'paid_by = auth.uid() and (public.can_all(''finance'', true) or public.can_project(''site'', project_id, true))');
select public._policy('labour_payments','lp_update','update','public.can_all(''finance'', true)','public.can_all(''finance'', true)');
select public._policy('labour_payments','lp_delete','delete','public.is_management()');

-- ---------------------------------------------------------------- HR

select public._policy('employees','emp_select','select','public.can(''hr'') or public.can(''payroll'') or user_id = auth.uid()');
select public._policy('employees','emp_insert','insert', null, 'public.can_all(''hr'', true)');
select public._policy('employees','emp_update','update','public.can_all(''hr'', true)','public.can_all(''hr'', true)');
select public._policy('employees','emp_delete','delete','public.is_owner()');

select public._policy('leave_requests','leave_select','select','public.can(''hr'') or employee_id = public.my_employee_id()');
select public._policy('leave_requests','leave_insert','insert', null,
  'public.can_all(''hr'', true) or (employee_id = public.my_employee_id() and status = ''pending'')');
select public._policy('leave_requests','leave_update','update',
  'public.can_all(''hr'', true) or (employee_id = public.my_employee_id() and status = ''pending'')',
  'public.can_all(''hr'', true) or (employee_id = public.my_employee_id() and status in (''pending'',''cancelled''))');
select public._policy('leave_requests','leave_delete','delete','public.is_management()');

select public._policy('payroll','payroll_select','select','public.can(''payroll'') or employee_id = public.my_employee_id()');
select public._policy('payroll','payroll_write','all','public.can_all(''payroll'', true)','public.can_all(''payroll'', true)');

-- ---------------------------------------------------------------- ACCOUNTING

select public._policy('chart_of_accounts','coa_select','select','public.can(''accounting'') or public.can(''finance'')');
select public._policy('chart_of_accounts','coa_write','all','public.can_all(''accounting'', true)','public.can_all(''accounting'', true)');

select public._policy('bank_accounts','bank_select','select','public.can(''accounting'') or public.can_all(''finance'')');
select public._policy('bank_accounts','bank_write','all','public.can_all(''accounting'', true)','public.can_all(''accounting'', true)');

select public._policy('journal_entries','je_select','select','public.can(''accounting'')');
select public._policy('journal_entries','je_insert','insert', null, 'public.can_all(''accounting'', true)');
select public._policy('journal_entries','je_update','update','public.can_all(''accounting'', true)','public.can_all(''accounting'', true)');
select public._policy('journal_entries','je_delete','delete','public.is_owner() and status = ''draft''');

select public._policy('journal_lines','jl_select','select','public.can(''accounting'')');
select public._policy('journal_lines','jl_write','all','public.can_all(''accounting'', true)','public.can_all(''accounting'', true)');

-- ---------------------------------------------------------------- FINANCE

select public._policy('invoices','inv_select','select',
  'public.can_project(''finance'', project_id) or (client_id in (select public.my_client_ids()) and status <> ''draft'')');
select public._policy('invoices','inv_insert','insert', null, 'public.can_all(''finance'', true)');
select public._policy('invoices','inv_update','update','public.can_all(''finance'', true)','public.can_all(''finance'', true)');
select public._policy('invoices','inv_delete','delete','public.is_owner() and status = ''draft''');

select public._policy('payments','pay_select','select',
  'public.can_project(''finance'', project_id) or client_id in (select public.my_client_ids())');
select public._policy('payments','pay_insert','insert', null, 'public.can_all(''finance'', true)');
select public._policy('payments','pay_update','update','public.can_all(''finance'', true)','public.can_all(''finance'', true)');
select public._policy('payments','pay_delete','delete','public.is_owner() and status = ''pending''');

select public._policy('receipts','rct_select','select',
  'public.can(''finance'') or exists (select 1 from public.payments p where p.id = payment_id and p.client_id in (select public.my_client_ids()))');
select public._policy('receipts','rct_insert','insert', null, 'public.can_all(''finance'', true) and issued_by = auth.uid()');
select public._policy('receipts','rct_update','update','public.is_owner()','public.is_owner()');

select public._policy('expenses','exp_select','select',
  'public.can(''accounting'') or public.can_all(''finance'') or (project_id is not null and public.can_project(''finance'', project_id))
   or recorded_by = auth.uid()');
select public._policy('expenses','exp_insert','insert', null,
  'recorded_by = auth.uid() and (public.can(''accounting'', true)
   or (project_id is not null and public.can_project(''site'', project_id, true)))');
select public._policy('expenses','exp_update','update','public.can_all(''finance'', true)','public.can_all(''finance'', true)');
select public._policy('expenses','exp_delete','delete','public.is_management() or (recorded_by = auth.uid() and status = ''pending'')');

select public._policy('rent_payments','rent_select','select','public.can(''real_estate'') or public.can(''finance'')
   or exists (select 1 from public.rental_agreements ra join public.tenants t on t.id = ra.tenant_id
              where ra.id = rental_agreement_id and t.user_id = auth.uid())');
select public._policy('rent_payments','rent_write','all',
  'public.can_all(''real_estate'', true) or public.can_all(''finance'', true)',
  'public.can_all(''real_estate'', true) or public.can_all(''finance'', true)');

-- ---------------------------------------------------------------- REAL ESTATE

do $$ declare t text; begin
  foreach t in array array['properties','property_units'] loop
    perform public._policy(t, t||'_select','select','public.can(''real_estate'') or public.can(''marketing'') or public.can(''crm'')');
    perform public._policy(t, t||'_write','all','public.can_all(''real_estate'', true)','public.can_all(''real_estate'', true)');
  end loop;
  foreach t in array array['tenants','buyers'] loop
    perform public._policy(t, t||'_select','select','public.can(''real_estate'') or public.can_all(''finance'') or user_id = auth.uid()');
    perform public._policy(t, t||'_write','all','public.can_all(''real_estate'', true)','public.can_all(''real_estate'', true)');
  end loop;
end $$;

select public._policy('rental_agreements','ra_select','select',
  'public.can(''real_estate'') or public.can_all(''finance'')
   or exists (select 1 from public.tenants t where t.id = tenant_id and t.user_id = auth.uid())');
select public._policy('rental_agreements','ra_write','all','public.can_all(''real_estate'', true)','public.can_all(''real_estate'', true)');

select public._policy('sale_agreements','sa_select','select',
  'public.can(''real_estate'') or public.can_all(''finance'')
   or exists (select 1 from public.buyers b where b.id = buyer_id and b.user_id = auth.uid())');
select public._policy('sale_agreements','sa_write','all','public.can_all(''real_estate'', true)','public.can_all(''real_estate'', true)');

select public._policy('viewings','view_select','select','public.can(''real_estate'') or public.can(''crm'') or agent_id = auth.uid()');
select public._policy('viewings','view_write','all',
  'public.can(''real_estate'', true) or public.can(''crm'', true) or agent_id = auth.uid()',
  'public.can(''real_estate'', true) or public.can(''crm'', true) or agent_id = auth.uid()');

-- ---------------------------------------------------------------- DOCUMENTS

select public._policy('documents','doc_select','select','public.can_see_document(id)');
select public._policy('documents','doc_insert','insert', null,
  'created_by = auth.uid() and public.can(''documents'', true)
   and (project_id is null or public.can_project(''documents'', project_id, true))');
select public._policy('documents','doc_update','update','public.can_edit_document(id)','public.can_edit_document(id)');
select public._policy('documents','doc_delete','delete','public.is_management() or (created_by = auth.uid() and public.is_staff())');

select public._policy('document_versions','dv_select','select','public.can_see_document(document_id)');
select public._policy('document_versions','dv_insert','insert', null, 'uploaded_by = auth.uid() and public.can_edit_document(document_id)');
select public._policy('document_versions','dv_delete','delete','public.is_management()');

select public._policy('document_access','da_select','select','public.can_see_document(document_id)');
select public._policy('document_access','da_write','all','public.can_edit_document(document_id)','public.can_edit_document(document_id)');

-- ---------------------------------------------------------------- function privileges
-- Internal functions must not be callable from the browser (PostgREST /rpc).

do $$
declare f text;
begin
  foreach f in array array[
    'public._ensure_enum(text, text[])',
    'public._policy(text, text, text, text, text)',
    'public._std_triggers(text, boolean)',
    'public.handle_new_auth_user()',
    'public.notify(uuid, text, text, text, text, text, uuid)',
    'public.notify_role(text, text, text, text, text, text, uuid, uuid)',
    'public._notify_step(uuid)',
    'public._apply_approval_outcome(uuid, boolean)',
    'public._entity_amount(text, uuid)',
    'public._entity_exists(text, uuid)',
    'public._entity_project(text, uuid)',
    'public.approval_step_candidates(uuid)',
    'public.post_journal(date, text, text, uuid, jsonb)',
    'public.void_journal_for(text, uuid)',
    'public.refresh_invoice(uuid)',
    'public.mark_overdue_invoices()',
    'public.user_has_role(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- Views: invoker views follow the RLS of their tables; keep anon out entirely.
revoke all on public.approval_requests, public.low_stock_items, public.account_balances, public.project_summary from anon;
grant select on public.approval_requests, public.low_stock_items, public.account_balances, public.project_summary to authenticated;

-- Make sure the signed-in role has table privileges (RLS then filters rows).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.doc_counters from authenticated, anon;
revoke insert, update, delete on public.audit_log from authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261127000500_storage.sql
-- ============================================================================
-- Hangool ERP · 0500 · Storage buckets (all private) and their access rules.
--
-- Path conventions (first folder decides access):
--   drawings/<project_id>/<file>                 -> design area of that project
--   project-photos/<project_id>/<file>           -> site / projects area of that project
--   documents/<document_id>/<version>-<file>     -> whoever can see / edit that document
-- Files are served with signed URLs only. Safe to re-run.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800),
       ('project-photos', 'project-photos', false, 20971520),
       ('drawings', 'drawings', false, 104857600)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create or replace function public.try_uuid(p text) returns uuid
language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

create or replace function public.storage_first_folder(p_name text) returns uuid
language sql immutable as $$ select public.try_uuid(split_part(p_name, '/', 1)) $$;

create or replace function public._storage_policy(pol text, cmd text, using_expr text, check_expr text)
returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on storage.objects', pol);
  execute format('create policy %I on storage.objects for %s to authenticated %s %s', pol, cmd,
    case when using_expr is not null then 'using (' || using_expr || ')' else '' end,
    case when check_expr is not null then 'with check (' || check_expr || ')' else '' end);
end $$;

-- drawings
select public._storage_policy('erp_drawings_read', 'select',
  $p$bucket_id = 'drawings' and (
     public.can_project('design', public.storage_first_folder(name))
     or exists (select 1 from public.drawings d
                where d.storage_path = storage.objects.name and d.status in ('submitted','approved')
                  and public.is_project_client(d.project_id)))$p$, null);
select public._storage_policy('erp_drawings_insert', 'insert', null,
  $p$bucket_id = 'drawings' and public.can_project('design', public.storage_first_folder(name), true)$p$);
select public._storage_policy('erp_drawings_delete', 'delete',
  $p$bucket_id = 'drawings' and public.is_management()$p$, null);

-- project photos
select public._storage_policy('erp_photos_read', 'select',
  $p$bucket_id = 'project-photos' and (
     public.can_project('site', public.storage_first_folder(name))
     or public.can_project('projects', public.storage_first_folder(name))
     or exists (select 1 from public.daily_reports r
                where r.visible_to_client and storage.objects.name = any(r.photo_paths)
                  and public.is_project_client(r.project_id)))$p$, null);
select public._storage_policy('erp_photos_insert', 'insert', null,
  $p$bucket_id = 'project-photos' and (
     public.can_project('site', public.storage_first_folder(name), true)
     or public.can_project('projects', public.storage_first_folder(name), true))$p$);
select public._storage_policy('erp_photos_delete', 'delete',
  $p$bucket_id = 'project-photos' and public.is_management()$p$, null);

-- documents
select public._storage_policy('erp_documents_read', 'select',
  $p$bucket_id = 'documents' and public.can_see_document(public.storage_first_folder(name))$p$, null);
select public._storage_policy('erp_documents_insert', 'insert', null,
  $p$bucket_id = 'documents' and public.can_edit_document(public.storage_first_folder(name))$p$);
select public._storage_policy('erp_documents_delete', 'delete',
  $p$bucket_id = 'documents' and public.is_management()$p$, null);

revoke all on function public._storage_policy(text, text, text, text) from public, anon, authenticated;
