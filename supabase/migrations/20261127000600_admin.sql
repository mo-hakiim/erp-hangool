-- ============================================================================
-- Hangool ERP · 0600 · Owner admin helpers (Staff & Roles screen). Safe to re-run.
-- ============================================================================

-- Everyone with a login, their active roles, 2FA and sign-in info. Owner only.
create or replace function public.admin_staff_list()
returns table (
  id uuid, full_name text, email text, phone text, is_active boolean,
  created_at timestamptz, last_sign_in_at timestamptz, invited_at timestamptz,
  roles text[], has_2fa boolean, client_id uuid, client_name text
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can manage staff';
  end if;
  return query
  select p.id, p.full_name, p.email, p.phone, p.is_active, p.created_at,
         u.last_sign_in_at, u.invited_at,
         coalesce((select array_agg(r.code order by r.code) from public.user_roles ur
                   join public.roles r on r.id = ur.role_id
                   where ur.user_id = p.id and ur.revoked_at is null), '{}'),
         exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified'),
         c.id, c.name
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.clients c on c.user_id = p.id
  order by p.full_name;
end $$;

revoke all on function public.admin_staff_list() from public, anon;
grant execute on function public.admin_staff_list() to authenticated;

-- Give or remove one role (owner only; audit records the owner as actor).
create or replace function public.admin_set_role(p_user uuid, p_role text, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_role uuid;
begin
  if not public.is_owner() then raise exception 'Only the owner can change roles'; end if;
  select id into v_role from public.roles where code = p_role;
  if v_role is null then raise exception 'Unknown role %', p_role; end if;
  if p_on then
    insert into public.user_roles (user_id, role_id, assigned_by)
    select p_user, v_role, auth.uid()
    where not exists (select 1 from public.user_roles where user_id = p_user and role_id = v_role and revoked_at is null);
  else
    update public.user_roles set revoked_at = now()
     where user_id = p_user and role_id = v_role and revoked_at is null;
  end if;
end $$;

revoke all on function public.admin_set_role(uuid, text, boolean) from public, anon;
grant execute on function public.admin_set_role(uuid, text, boolean) to authenticated;
