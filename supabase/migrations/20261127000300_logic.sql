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
