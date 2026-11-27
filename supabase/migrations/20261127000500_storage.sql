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
