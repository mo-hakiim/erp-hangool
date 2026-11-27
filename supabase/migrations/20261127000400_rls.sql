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
