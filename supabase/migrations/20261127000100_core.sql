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
  ('default_stage_names', '["foundation","columns","walls","roof","finishing"]')
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
