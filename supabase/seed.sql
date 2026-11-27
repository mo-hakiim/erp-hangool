-- ============================================================================
-- Hangool ERP · DEMO seed data. For the test project only — never run on production.
-- Safe to re-run (fixed ids + on conflict do nothing).
--
-- Demo logins (all share one test password, change or delete these users before go-live):
--   password: HangoolDemo-2026
--   owner@demo.hangool.test, gm@…, finance@…, accountant@…, hr@…, procurement@…, store@…,
--   pm@…, engineer@…, supervisor@…, qs@…, architect@…, marketing@…, realestate@…,
--   employee@…, client.a@…, client.b@…, pm2@…, engineer2@…
-- ============================================================================

-- Statuses that normally need the Approvals Center are allowed while seeding.
select set_config('app.approval_engine', 'on', false);

-- ---------------------------------------------------------------- users
create temp table _u (n int, id uuid, email text, full_name text, role text, phone text) on commit drop;
insert into _u values
  ( 1,'00000000-0000-4000-8000-000000000001','owner@demo.hangool.test','Cabdiraxmaan Owner (demo)','owner','+252 63 400 0001'),
  ( 2,'00000000-0000-4000-8000-000000000002','gm@demo.hangool.test','Hodan GM (demo)','general_manager','+252 63 400 0002'),
  ( 3,'00000000-0000-4000-8000-000000000003','finance@demo.hangool.test','Faarax Finance (demo)','finance','+252 63 400 0003'),
  ( 4,'00000000-0000-4000-8000-000000000004','accountant@demo.hangool.test','Ayaan Accountant (demo)','accountant','+252 63 400 0004'),
  ( 5,'00000000-0000-4000-8000-000000000005','hr@demo.hangool.test','Sahra HR (demo)','hr','+252 63 400 0005'),
  ( 6,'00000000-0000-4000-8000-000000000006','procurement@demo.hangool.test','Jaamac Procurement (demo)','procurement','+252 63 400 0006'),
  ( 7,'00000000-0000-4000-8000-000000000007','store@demo.hangool.test','Cumar Store (demo)','storekeeper','+252 63 400 0007'),
  ( 8,'00000000-0000-4000-8000-000000000008','pm@demo.hangool.test','Maxamed PM (demo)','project_manager','+252 63 400 0008'),
  ( 9,'00000000-0000-4000-8000-000000000009','engineer@demo.hangool.test','Xasan Engineer (demo)','site_engineer','+252 63 400 0009'),
  (10,'00000000-0000-4000-8000-000000000010','supervisor@demo.hangool.test','Yuusuf Supervisor (demo)','site_supervisor','+252 63 400 0010'),
  (11,'00000000-0000-4000-8000-000000000011','qs@demo.hangool.test','Nimco QS (demo)','qs','+252 63 400 0011'),
  (12,'00000000-0000-4000-8000-000000000012','architect@demo.hangool.test','Ilhaan Architect (demo)','architect','+252 63 400 0012'),
  (13,'00000000-0000-4000-8000-000000000013','marketing@demo.hangool.test','Deeqa Marketing (demo)','marketing','+252 63 400 0013'),
  (14,'00000000-0000-4000-8000-000000000014','realestate@demo.hangool.test','Bashiir Real Estate (demo)','real_estate_officer','+252 63 400 0014'),
  (15,'00000000-0000-4000-8000-000000000015','employee@demo.hangool.test','Cali Employee (demo)','employee','+252 63 400 0015'),
  (16,'00000000-0000-4000-8000-000000000016','client.a@demo.hangool.test','Client A — Axmed (demo)','client','+252 63 400 0016'),
  (17,'00000000-0000-4000-8000-000000000017','client.b@demo.hangool.test','Client B — Khadra (demo)','client','+252 63 400 0017'),
  (18,'00000000-0000-4000-8000-000000000018','pm2@demo.hangool.test','Saciid PM2 (demo)','project_manager','+252 63 400 0018'),
  (19,'00000000-0000-4000-8000-000000000019','engineer2@demo.hangool.test','Muna Engineer2 (demo)','site_engineer','+252 63 400 0019');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       crypt('HangoolDemo-2026', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name, 'phone', u.phone),
       now(), now(), '', '', '', '', '', '', '', ''
from _u u
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
from _u u
where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

update public.profiles p set full_name = u.full_name, phone = u.phone from _u u where p.id = u.id;

insert into public.user_roles (user_id, role_id, assigned_by)
select u.id, r.id, '00000000-0000-4000-8000-000000000001'
from _u u join public.roles r on r.code = u.role
where not exists (select 1 from public.user_roles x where x.user_id = u.id and x.role_id = r.id and x.revoked_at is null);

-- The general manager is also an employee; the PM also holds QS (for self-approval demos).
insert into public.user_roles (user_id, role_id, assigned_by)
select '00000000-0000-4000-8000-000000000008', r.id, '00000000-0000-4000-8000-000000000001'
from public.roles r where r.code = 'qs'
  and not exists (select 1 from public.user_roles x where x.user_id = '00000000-0000-4000-8000-000000000008' and x.role_id = r.id and x.revoked_at is null);

-- ---------------------------------------------------------------- settings
update public.settings set value = '{"name":"Hangool Construction (demo)","phone":"+252 63 400 0000","email":"info@demo.hangool.test","address":"Hargeisa, Somaliland","tax_id":"DEMO-001","logo_url":null}'
 where key = 'company';

-- ---------------------------------------------------------------- CRM
insert into public.campaigns (id, created_by, name, media_type, channel, budget, spent, status, start_date, end_date) values
  ('c0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000013','Ramadan villa offer','social','Facebook + TikTok',1500,920,'running', current_date - 20, current_date + 10),
  ('c0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000013','Apartments for rent — Jigjiga Yar','poster','Street posters',400,400,'ended', current_date - 90, current_date - 30)
on conflict (id) do nothing;

insert into public.leads (id, name, phone, source, status, interest, budget, message, assigned_to, campaign_id) values
  ('d0000000-0000-4000-8000-000000000001','Axmed Cali','+252 63 410 0001','whatsapp','signed','construction',85000,'Wants a 2-storey villa','00000000-0000-4000-8000-000000000013','c0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000002','Khadra Xuseen','+252 63 410 0002','referral','signed','construction',140000,'Commercial building','00000000-0000-4000-8000-000000000013',null),
  ('d0000000-0000-4000-8000-000000000003','Ismaaciil Faarax','+252 63 410 0003','website','new','construction',60000,'Asked for a price list','00000000-0000-4000-8000-000000000013','c0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000004','Fadumo Jaamac','+252 63 410 0004','whatsapp','contacted','property_rent',null,'Looking for a 2-bed apartment','00000000-0000-4000-8000-000000000014','c0000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000005','Mustafe Cabdi','+252 63 410 0005','walk_in','visiting','property_buy',95000,'Viewing the townhouse','00000000-0000-4000-8000-000000000014',null),
  ('d0000000-0000-4000-8000-000000000006','Hibo Maxamuud','+252 63 410 0006','facebook','lost','construction',30000,'Budget too low','00000000-0000-4000-8000-000000000013','c0000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;
update public.leads set lost_reason = 'Budget too low' where id = 'd0000000-0000-4000-8000-000000000006';

insert into public.follow_ups (lead_id, assigned_to, due_at, note)
select 'd0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000013', now() + interval '1 day', 'Send BOQ example'
where not exists (select 1 from public.follow_ups where lead_id = 'd0000000-0000-4000-8000-000000000003');

insert into public.clients (id, user_id, lead_id, name, phone, email, address) values
  ('e0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000016','d0000000-0000-4000-8000-000000000001','Axmed Cali (demo)','+252 63 410 0001','client.a@demo.hangool.test','Masalaha, Hargeisa'),
  ('e0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000017','d0000000-0000-4000-8000-000000000002','Khadra Xuseen (demo)','+252 63 410 0002','client.b@demo.hangool.test','Shacab, Hargeisa'),
  ('e0000000-0000-4000-8000-000000000003',null,null,'Hargeisa Schools Trust (demo)','+252 63 410 0009',null,'26 June, Hargeisa')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- projects
insert into public.projects (id, client_id, manager_id, code, name, location, profit_pct, contract_value, budget, status, start_date, end_date, created_by) values
  ('f0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000008','PRJ-DEMO-001','Axmed family villa','Masalaha, Hargeisa',15,85000,73900,'active', current_date - 120, current_date + 90,'00000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000018','PRJ-DEMO-002','Khadra commercial block','Shacab, Hargeisa',18,140000,118600,'active', current_date - 60, current_date + 200,'00000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000008','PRJ-DEMO-003','Primary school extension','26 June, Hargeisa',12,62000,55300,'active', current_date - 200, current_date - 10,'00000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000008','PRJ-DEMO-004','Axmed boundary wall','Masalaha, Hargeisa',10,9000,8100,'handed_over', current_date - 300, current_date - 240,'00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.project_members (project_id, user_id, role_id)
select m.p::uuid, m.u::uuid, r.id from (values
  ('f0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000009','site_engineer'),
  ('f0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010','site_supervisor'),
  ('f0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','qs'),
  ('f0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000012','architect'),
  ('f0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000019','site_engineer'),
  ('f0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000009','site_engineer')
) m(p, u, role) join public.roles r on r.code = m.role
on conflict do nothing;

-- stages
insert into public.stages (project_id, name, seq, planned_start, planned_end, milestone_amount, progress_pct, status, completed_at)
select p::uuid, n, s, current_date + ps, current_date + pe, ma, pr, st::public.stage_status, case when st in ('done','verified') then current_date + pe end
from (values
  ('f0000000-0000-4000-8000-000000000001','foundation',1,-120,-90,17000,100,'verified'),
  ('f0000000-0000-4000-8000-000000000001','columns',   2, -90,-50,17000,100,'done'),
  ('f0000000-0000-4000-8000-000000000001','walls',     3, -50,  0,17000, 60,'in_progress'),
  ('f0000000-0000-4000-8000-000000000001','roof',      4,   0, 40,17000,  0,'pending'),
  ('f0000000-0000-4000-8000-000000000001','finishing', 5,  40, 90,17000,  0,'pending'),
  ('f0000000-0000-4000-8000-000000000002','foundation',1, -60,-10,28000,100,'done'),
  ('f0000000-0000-4000-8000-000000000002','columns',   2, -10, 50,28000, 35,'in_progress'),
  ('f0000000-0000-4000-8000-000000000002','walls',     3,  50,110,28000,  0,'pending'),
  ('f0000000-0000-4000-8000-000000000002','roof',      4, 110,160,28000,  0,'pending'),
  ('f0000000-0000-4000-8000-000000000002','finishing', 5, 160,200,28000,  0,'pending'),
  ('f0000000-0000-4000-8000-000000000003','foundation',1,-200,-160,12400,100,'verified'),
  ('f0000000-0000-4000-8000-000000000003','columns',   2,-160,-110,12400,100,'verified'),
  ('f0000000-0000-4000-8000-000000000003','walls',     3,-110, -60,12400,100,'verified'),
  ('f0000000-0000-4000-8000-000000000003','roof',      4, -60, -25,12400, 80,'in_progress'),
  ('f0000000-0000-4000-8000-000000000003','finishing', 5, -25, -10,12400,  0,'pending'),
  ('f0000000-0000-4000-8000-000000000004','boundary wall',1,-300,-240,9000,100,'verified')
) v(p, n, s, ps, pe, ma, pr, st)
on conflict (project_id, seq) do nothing;

-- inventory + suppliers
insert into public.suppliers (id, name, contact_name, phone, category, payment_terms) values
  ('a1000000-0000-4000-8000-000000000001','Berbera Cement Traders (demo)','Cabdi','+252 63 420 0001','Cement','30 days'),
  ('a1000000-0000-4000-8000-000000000002','Hargeisa Steel & Iron (demo)','Warsame','+252 63 420 0002','Steel','On delivery'),
  ('a1000000-0000-4000-8000-000000000003','Gacan Libaax Blocks (demo)','Nuur','+252 63 420 0003','Blocks','15 days')
on conflict (id) do nothing;

insert into public.inventory_items (id, sku, name, category, unit, location, unit_cost, reorder_level) values
  ('a2000000-0000-4000-8000-000000000001','CEM-425','Cement 42.5N','Cement','bag','Main yard',7.5,200),
  ('a2000000-0000-4000-8000-000000000002','STL-12','Rebar 12 mm','Steel','bar','Main yard',9.8,150),
  ('a2000000-0000-4000-8000-000000000003','STL-16','Rebar 16 mm','Steel','bar','Main yard',16.5,80),
  ('a2000000-0000-4000-8000-000000000004','BLK-20','Concrete block 20 cm','Blocks','pcs','Main yard',0.65,2000),
  ('a2000000-0000-4000-8000-000000000005','SND-01','Sand','Aggregates','m3','Main yard',18,20),
  ('a2000000-0000-4000-8000-000000000006','PNT-WH','Paint white 20 L','Finishing','bucket','Store room',38,15)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from public.stock_movements) then
    insert into public.stock_movements (item_id, direction, quantity, unit_cost, supplier_id, recorded_by, moved_at, note) values
      ('a2000000-0000-4000-8000-000000000001','in',900,7.5,'a1000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000007', now() - interval '40 days','Opening stock'),
      ('a2000000-0000-4000-8000-000000000002','in',400,9.8,'a1000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000007', now() - interval '40 days','Opening stock'),
      ('a2000000-0000-4000-8000-000000000003','in',120,16.5,'a1000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000007', now() - interval '40 days','Opening stock'),
      ('a2000000-0000-4000-8000-000000000004','in',9000,0.65,'a1000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000007', now() - interval '40 days','Opening stock'),
      ('a2000000-0000-4000-8000-000000000005','in',60,18,null,'00000000-0000-4000-8000-000000000007', now() - interval '40 days','Opening stock'),
      ('a2000000-0000-4000-8000-000000000006','in',20,38,null,'00000000-0000-4000-8000-000000000007', now() - interval '40 days','Opening stock');
    insert into public.stock_movements (item_id, direction, quantity, unit_cost, project_id, stage_id, recorded_by, moved_at, condition, note)
    select i, 'out', q, c, p::uuid, (select id from public.stages where project_id = p::uuid and seq = s), '00000000-0000-4000-8000-000000000007', now() - (d || ' days')::interval, cond::public.stock_condition, nt
    from (values
      ('a2000000-0000-4000-8000-000000000001'::uuid, 520, 7.5, 'f0000000-0000-4000-8000-000000000001', 3, 12, 'ok', 'Walls'),
      ('a2000000-0000-4000-8000-000000000004'::uuid, 7600, 0.65, 'f0000000-0000-4000-8000-000000000001', 3, 10, 'ok', 'Walls'),
      ('a2000000-0000-4000-8000-000000000002'::uuid, 310, 9.8, 'f0000000-0000-4000-8000-000000000002', 2, 6, 'ok', 'Columns'),
      ('a2000000-0000-4000-8000-000000000005'::uuid, 45, 18, 'f0000000-0000-4000-8000-000000000003', 4, 4, 'ok', 'Roof slab'),
      ('a2000000-0000-4000-8000-000000000001'::uuid, 12, 7.5, 'f0000000-0000-4000-8000-000000000001', 3, 3, 'damaged', 'Wet bags'),
      ('a2000000-0000-4000-8000-000000000006'::uuid, 2, 38, null, null, 2, 'missing', 'Not found at count')
    ) v(i, q, c, p, s, d, cond, nt);
  end if;
end $$;

-- BOQ (version 1 approved for project 1, version 1 draft for project 2)
insert into public.boq_items (project_id, stage_id, inventory_item_id, prepared_by, description, unit, quantity, unit_price, boq_version, status)
select 'f0000000-0000-4000-8000-000000000001', s.id, b.item, '00000000-0000-4000-8000-000000000011', b.d, b.u, b.q, b.p, 1, 'approved'
from (values
  (1, 'a2000000-0000-4000-8000-000000000001'::uuid, 'Cement for footings', 'bag', 600, 7.5),
  (1, null::uuid, 'Excavation labour', 'm3', 180, 12),
  (2, 'a2000000-0000-4000-8000-000000000002'::uuid, 'Rebar for columns', 'bar', 420, 9.8),
  (3, 'a2000000-0000-4000-8000-000000000004'::uuid, 'Blocks for walls', 'pcs', 14000, 0.65),
  (3, 'a2000000-0000-4000-8000-000000000001'::uuid, 'Mortar cement', 'bag', 700, 7.5),
  (4, null::uuid, 'Roof slab (concrete + labour)', 'm2', 220, 48),
  (5, 'a2000000-0000-4000-8000-000000000006'::uuid, 'Paint', 'bucket', 60, 38)
) b(seq, item, d, u, q, p)
join public.stages s on s.project_id = 'f0000000-0000-4000-8000-000000000001' and s.seq = b.seq
where not exists (select 1 from public.boq_items where project_id = 'f0000000-0000-4000-8000-000000000001');

update public.stages s set budget_amount = coalesce((select sum(amount) from public.boq_items b where b.stage_id = s.id and b.status = 'approved'), 0)
 where s.project_id = 'f0000000-0000-4000-8000-000000000001';

insert into public.boq_items (project_id, stage_id, inventory_item_id, prepared_by, description, unit, quantity, unit_price, boq_version, status)
select 'f0000000-0000-4000-8000-000000000002', s.id, null, '00000000-0000-4000-8000-000000000011', 'Structure — stage ' || s.name, 'lot', 1, 22000, 1, 'draft'
from public.stages s where s.project_id = 'f0000000-0000-4000-8000-000000000002'
  and not exists (select 1 from public.boq_items where project_id = 'f0000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------- accounting / finance
insert into public.bank_accounts (id, name, kind, bank_name, account_no, opening_balance, gl_account_id) values
  ('b1000000-0000-4000-8000-000000000001','Main bank account','bank','Dahabshil Bank (demo)','****4410', 25000, public.acct('1010')),
  ('b1000000-0000-4000-8000-000000000002','Office cash','cash',null,null, 1500, public.acct('1000')),
  ('b1000000-0000-4000-8000-000000000003','Zaad merchant','mobile_money','Telesom Zaad','****0090', 0, public.acct('1020'))
on conflict (id) do nothing;

-- Opening balances journal (once)
do $$ begin
  if not exists (select 1 from public.journal_entries where source_table = 'opening_balance') then
    perform public.post_journal(current_date - 180, 'Opening balances', 'opening_balance', null, jsonb_build_array(
      public._jl(public.acct('1010'), 25000, 0), public._jl(public.acct('1000'), 1500, 0),
      public._jl(public.acct('3000'), 0, 26500)));
  end if;
end $$;

insert into public.contracts (client_id, project_id, contract_no, contract_value, signed_at, status) values
  ('e0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','CON-DEMO-001',85000, current_date - 125,'signed'),
  ('e0000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000002','CON-DEMO-002',140000, current_date - 65,'signed'),
  ('e0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000003','CON-DEMO-003',62000, current_date - 205,'signed')
on conflict (contract_no) do nothing;

insert into public.invoices (id, invoice_no, project_id, stage_id, client_id, invoice_type, description, amount, issue_date, due_date, status) values
  ('a3000000-0000-4000-8000-000000000001','INV-DEMO-001','f0000000-0000-4000-8000-000000000001',null,'e0000000-0000-4000-8000-000000000001','deposit','Deposit 20%',17000, current_date - 125, current_date - 115,'pending'),
  ('a3000000-0000-4000-8000-000000000002','INV-DEMO-002','f0000000-0000-4000-8000-000000000001',(select id from public.stages where project_id='f0000000-0000-4000-8000-000000000001' and seq=1),'e0000000-0000-4000-8000-000000000001','milestone','Foundation milestone',17000, current_date - 88, current_date - 78,'pending'),
  ('a3000000-0000-4000-8000-000000000003','INV-DEMO-003','f0000000-0000-4000-8000-000000000001',(select id from public.stages where project_id='f0000000-0000-4000-8000-000000000001' and seq=2),'e0000000-0000-4000-8000-000000000001','milestone','Columns milestone',17000, current_date - 20, current_date - 5,'pending'),
  ('a3000000-0000-4000-8000-000000000004','INV-DEMO-004','f0000000-0000-4000-8000-000000000001',(select id from public.stages where project_id='f0000000-0000-4000-8000-000000000001' and seq=2),'e0000000-0000-4000-8000-000000000001','extra','Extra: bigger windows',2400, current_date - 15, current_date + 15,'pending'),
  ('a3000000-0000-4000-8000-000000000005','INV-DEMO-005','f0000000-0000-4000-8000-000000000002',null,'e0000000-0000-4000-8000-000000000002','deposit','Deposit 20%',28000, current_date - 65, current_date - 55,'pending'),
  ('a3000000-0000-4000-8000-000000000006','INV-DEMO-006','f0000000-0000-4000-8000-000000000002',(select id from public.stages where project_id='f0000000-0000-4000-8000-000000000002' and seq=1),'e0000000-0000-4000-8000-000000000002','milestone','Foundation milestone',28000, current_date - 8, current_date + 7,'pending'),
  ('a3000000-0000-4000-8000-000000000007','INV-DEMO-007','f0000000-0000-4000-8000-000000000003',(select id from public.stages where project_id='f0000000-0000-4000-8000-000000000003' and seq=3),'e0000000-0000-4000-8000-000000000003','milestone','Walls milestone',12400, current_date - 55, current_date - 40,'pending'),
  ('a3000000-0000-4000-8000-000000000008','INV-DEMO-008','f0000000-0000-4000-8000-000000000002',(select id from public.stages where project_id='f0000000-0000-4000-8000-000000000002' and seq=2),'e0000000-0000-4000-8000-000000000002','milestone','Columns milestone (draft)',28000, null, null,'draft')
on conflict (id) do nothing;

insert into public.payments (id, client_id, project_id, invoice_id, bank_account_id, recorded_by, payment_type, amount, method, paid_at, status) values
  ('a4000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','deposit',17000,'bank', now() - interval '120 days','confirmed'),
  ('a4000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003','milestone',17000,'zaad', now() - interval '80 days','confirmed'),
  ('a4000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003','milestone',8000,'zaad', now() - interval '3 days','confirmed'),
  ('a4000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000005','b1000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','deposit',28000,'bank', now() - interval '60 days','confirmed'),
  ('a4000000-0000-4000-8000-000000000005','e0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000007','b1000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','milestone',5000,'cash', now() - interval '35 days','confirmed')
on conflict (id) do nothing;

insert into public.receipts (payment_id, receipt_no, issued_by)
select p.id, 'RCT-DEMO-' || right(p.id::text, 3), '00000000-0000-4000-8000-000000000003'
from public.payments p where p.id::text like 'a4000000-%'
on conflict (payment_id) do nothing;

select public.mark_overdue_invoices();

-- Purchasing: one delivered PO (posts cost + payable), one paid supplier payment
insert into public.purchase_orders (id, po_number, project_id, supplier_id, created_by, total_amount, status) values
  ('a5000000-0000-4000-8000-000000000001','PO-DEMO-001','f0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000006',5900,'approved'),
  ('a5000000-0000-4000-8000-000000000002','PO-DEMO-002','f0000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000006',3900,'approved')
on conflict (id) do nothing;
update public.purchase_orders set status = 'delivered' where id in ('a5000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002') and status = 'approved';

insert into public.supplier_payments (id, supplier_id, purchase_order_id, bank_account_id, recorded_by, amount, method, status, paid_at) values
  ('a6000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','a5000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003',5900,'bank','paid', now() - interval '9 days')
on conflict (id) do nothing;

insert into public.expenses (id, expense_date, account_id, bank_account_id, project_id, description, amount, method, status, recorded_by) values
  ('a7000000-0000-4000-8000-000000000001', current_date - 25, public.acct('5300'), 'b1000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000001','Generator fuel',320,'cash','paid','00000000-0000-4000-8000-000000000004'),
  ('a7000000-0000-4000-8000-000000000002', current_date - 12, public.acct('5400'), 'b1000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000002','Truck hire',450,'cash','paid','00000000-0000-4000-8000-000000000004'),
  ('a7000000-0000-4000-8000-000000000003', current_date - 5, public.acct('5500'), 'b1000000-0000-4000-8000-000000000001',null,'Office rent',900,'bank','paid','00000000-0000-4000-8000-000000000004'),
  ('a7000000-0000-4000-8000-000000000004', current_date - 2, public.acct('5600'), 'b1000000-0000-4000-8000-000000000003',null,'Facebook ads',300,'zaad','paid','00000000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- HR
insert into public.employees (id, user_id, employee_no, full_name, phone, job_title, department, hire_date, base_salary)
select ('a8000000-0000-4000-8000-0000000000' || lpad(u.n::text, 2, '0'))::uuid, u.id, 'EMP-DEMO-' || lpad(u.n::text, 3, '0'),
       u.full_name, u.phone, initcap(replace(u.role, '_', ' ')),
       case when u.role in ('finance','accountant') then 'Finance' when u.role = 'hr' then 'HR'
            when u.role in ('procurement','storekeeper') then 'Supply' when u.role in ('marketing','real_estate_officer') then 'Sales'
            when u.role in ('owner','general_manager') then 'Management' else 'Construction' end,
       current_date - (200 + u.n * 30), 600 + u.n * 75
from _u u where u.role <> 'client'
on conflict (id) do nothing;

insert into public.payroll (employee_id, period_month, gross, allowances, deductions, status)
select e.id, date_trunc('month', current_date - interval '1 month')::date, e.base_salary, 50, 20, 'paid'
from public.employees e where e.employee_no like 'EMP-DEMO-%'
on conflict (employee_id, period_month) do nothing;
insert into public.payroll (employee_id, period_month, gross, allowances, deductions, status)
select e.id, date_trunc('month', current_date)::date, e.base_salary, 50, 20, 'draft'
from public.employees e where e.employee_no like 'EMP-DEMO-%'
on conflict (employee_id, period_month) do nothing;

insert into public.labourers (id, name, phone, trade, daily_rate) values
  ('a9000000-0000-4000-8000-000000000001','Guuleed (demo)','+252 63 430 0001','Mason',15),
  ('a9000000-0000-4000-8000-000000000002','Rooble (demo)','+252 63 430 0002','Helper',8),
  ('a9000000-0000-4000-8000-000000000003','Barkhad (demo)','+252 63 430 0003','Steel fixer',14),
  ('a9000000-0000-4000-8000-000000000004','Sharmaarke (demo)','+252 63 430 0004','Carpenter',14)
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from public.site_attendance where work_date = current_date) then
    insert into public.site_attendance (project_id, labourer_id, employee_id, recorded_by, work_date, present, hours, check_in_at, check_in_lat, check_in_lng, client_id, device_id)
    values
      ('f0000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001',null,'00000000-0000-4000-8000-000000000010', current_date, true, 8, current_date + time '07:05', 9.5624, 44.0770, gen_random_uuid(), 'demo-phone-1'),
      ('f0000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000002',null,'00000000-0000-4000-8000-000000000010', current_date, true, 8, current_date + time '07:10', 9.5624, 44.0771, gen_random_uuid(), 'demo-phone-1'),
      ('f0000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000003',null,'00000000-0000-4000-8000-000000000010', current_date, false, null, null, null, null, gen_random_uuid(), 'demo-phone-1'),
      ('f0000000-0000-4000-8000-000000000002','a9000000-0000-4000-8000-000000000004',null,'00000000-0000-4000-8000-000000000019', current_date, true, 8, current_date + time '07:20', 9.5580, 44.0650, gen_random_uuid(), 'demo-phone-2'),
      ('f0000000-0000-4000-8000-000000000001',null,'a8000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000009', current_date, true, null, current_date + time '06:55', 9.5625, 44.0769, gen_random_uuid(), 'demo-phone-3'),
      ('f0000000-0000-4000-8000-000000000001',null,'a8000000-0000-4000-8000-000000000015','00000000-0000-4000-8000-000000000015', current_date, true, null, current_date + time '07:30', 9.5623, 44.0772, gen_random_uuid(), 'demo-phone-4');
  end if;
end $$;

insert into public.daily_reports (project_id, stage_id, author_id, report_date, weather, progress, problems, workers_present, visible_to_client, client_id, device_id)
select 'f0000000-0000-4000-8000-000000000001', (select id from public.stages where project_id='f0000000-0000-4000-8000-000000000001' and seq=3),
       '00000000-0000-4000-8000-000000000009', current_date - d, 'Sunny', 'Block work on ' || (3 - d) || ' walls', case when d = 1 then 'Cement delivery late' end, 14 - d, d <> 0,
       ('a9100000-0000-4000-8000-00000000000' || d)::uuid, 'demo-phone-3'
from generate_series(0, 2) d
on conflict (client_id) do nothing;
insert into public.daily_reports (project_id, stage_id, author_id, report_date, progress, workers_present, visible_to_client, client_id)
values ('f0000000-0000-4000-8000-000000000002', (select id from public.stages where project_id='f0000000-0000-4000-8000-000000000002' and seq=2),
        '00000000-0000-4000-8000-000000000019', current_date, 'Column formwork level 1', 9, true, 'a9100000-0000-4000-8000-000000000009')
on conflict (client_id) do nothing;

-- ---------------------------------------------------------------- real estate
insert into public.properties (id, project_id, title, property_type, listing_type, location, price, rent_amount, status) values
  ('aa000000-0000-4000-8000-000000000001',null,'Jigjiga Yar apartments','apartment_block','rent','Jigjiga Yar, Hargeisa',null,null,'available'),
  ('aa000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000004','Masalaha townhouse','house','sale','Masalaha, Hargeisa',95000,null,'reserved'),
  ('aa000000-0000-4000-8000-000000000003',null,'Plot 14 — New Hargeisa','land','sale','New Hargeisa',28000,null,'sold')
on conflict (id) do nothing;

insert into public.property_units (id, property_id, unit_no, floor, bedrooms, size_sqm, rent_amount, status) values
  ('ab000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','A1',0,2,85,350,'rented'),
  ('ab000000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000001','A2',0,2,85,350,'rented'),
  ('ab000000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000001','B1',1,3,110,450,'available'),
  ('ab000000-0000-4000-8000-000000000004','aa000000-0000-4000-8000-000000000001','B2',1,3,110,450,'available')
on conflict (id) do nothing;

insert into public.tenants (id, name, phone) values
  ('ac000000-0000-4000-8000-000000000001','Abshir Tenant (demo)','+252 63 440 0001'),
  ('ac000000-0000-4000-8000-000000000002','Ubah Tenant (demo)','+252 63 440 0002')
on conflict (id) do nothing;
insert into public.buyers (id, name, phone) values
  ('ad000000-0000-4000-8000-000000000001','Mustafe Cabdi (demo)','+252 63 410 0005'),
  ('ad000000-0000-4000-8000-000000000002','Plot buyer (demo)','+252 63 440 0010')
on conflict (id) do nothing;

insert into public.rental_agreements (id, agreement_no, property_id, unit_id, tenant_id, start_date, end_date, monthly_rent, deposit, status) values
  ('ae000000-0000-4000-8000-000000000001','RA-DEMO-001','aa000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000001', current_date - 150, current_date + 215, 350, 350,'active'),
  ('ae000000-0000-4000-8000-000000000002','RA-DEMO-002','aa000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-000000000002', current_date - 60, current_date + 305, 350, 350,'active')
on conflict (id) do nothing;

insert into public.rent_payments (rental_agreement_id, bank_account_id, period_month, amount, method, status)
select a, 'b1000000-0000-4000-8000-000000000003', date_trunc('month', current_date - (m || ' months')::interval)::date, 350, 'zaad', 'confirmed'
from (values ('ae000000-0000-4000-8000-000000000001'::uuid), ('ae000000-0000-4000-8000-000000000002'::uuid)) x(a), generate_series(1, 2) m
where not exists (select 1 from public.rent_payments);

insert into public.sale_agreements (id, agreement_no, property_id, buyer_id, sale_price, deposit, amount_paid, signed_at, status) values
  ('af000000-0000-4000-8000-000000000001','SA-DEMO-001','aa000000-0000-4000-8000-000000000003','ad000000-0000-4000-8000-000000000002',28000,28000,28000, current_date - 40,'completed'),
  ('af000000-0000-4000-8000-000000000002','SA-DEMO-002','aa000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000001',95000,10000,10000, null,'draft')
on conflict (id) do nothing;

insert into public.viewings (property_id, unit_id, lead_id, visitor_name, visitor_phone, scheduled_at, agent_id, status)
select v.p::uuid, v.u::uuid, v.l::uuid, v.n, v.ph, now() + (v.h || ' hours')::interval, '00000000-0000-4000-8000-000000000014', v.s::public.viewing_status
from (values
  ('aa000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000004','Fadumo Jaamac','+252 63 410 0004', 26, 'scheduled'),
  ('aa000000-0000-4000-8000-000000000002',null,'d0000000-0000-4000-8000-000000000005','Mustafe Cabdi','+252 63 410 0005', -50, 'done')
) v(p, u, l, n, ph, h, s)
where not exists (select 1 from public.viewings);

-- ---------------------------------------------------------------- client portal
insert into public.messages (client_id, project_id, sender_id, body, sent_at)
select 'e0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001', s, b, now() - (h || ' hours')::interval
from (values ('00000000-0000-4000-8000-000000000016'::uuid,'When will the walls be finished?',30),
             ('00000000-0000-4000-8000-000000000008'::uuid,'About two more weeks. Photos are in today''s report.',28)) v(s, b, h)
where not exists (select 1 from public.messages where client_id = 'e0000000-0000-4000-8000-000000000001');

insert into public.complaints (client_id, project_id, assigned_to, subject, description, status)
select 'e0000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000018','Noise in the evening','Neighbours complain about work after 7 pm.','open'
where not exists (select 1 from public.complaints);

-- ---------------------------------------------------------------- documents (metadata only; no files)
insert into public.documents (id, title, category, project_id, created_by) values
  ('b2000000-0000-4000-8000-000000000001','Building permit — villa','permit','f0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000008'),
  ('b2000000-0000-4000-8000-000000000002','Signed contract — commercial block','contract','f0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;
insert into public.document_versions (document_id, version_no, storage_path, file_name, mime_type, size_bytes, uploaded_by)
select d, 1, d::text || '/1-demo.pdf', 'demo.pdf', 'application/pdf', 120000, u
from (values ('b2000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000008'::uuid),
             ('b2000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-000000000001'::uuid)) v(d, u)
on conflict (document_id, version_no) do nothing;
insert into public.document_access (document_id, role_id)
select 'b2000000-0000-4000-8000-000000000001', id from public.roles where code = 'client'
  and not exists (select 1 from public.document_access where document_id = 'b2000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------- pending work for approvals (made "as" the requesters)
select set_config('app.approval_engine', 'off', false);

insert into public.material_requests (id, request_no, project_id, stage_id, requested_by, within_budget, needed_by, notes) values
  ('b3000000-0000-4000-8000-000000000001','MR-DEMO-001','f0000000-0000-4000-8000-000000000001',(select id from public.stages where project_id='f0000000-0000-4000-8000-000000000001' and seq=4),'00000000-0000-4000-8000-000000000009', true, current_date + 7, 'For roof slab')
on conflict (id) do nothing;
insert into public.request_items (request_id, inventory_item_id, quantity, qty_from_stock, qty_to_buy)
select 'b3000000-0000-4000-8000-000000000001', i, q, s, q - s
from (values ('a2000000-0000-4000-8000-000000000003'::uuid, 160, 120), ('a2000000-0000-4000-8000-000000000001'::uuid, 400, 350)) v(i, q, s)
where not exists (select 1 from public.request_items where request_id = 'b3000000-0000-4000-8000-000000000001');

insert into public.supplier_payments (id, supplier_id, purchase_order_id, bank_account_id, recorded_by, amount, method, status) values
  ('a6000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','a5000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003',3900,'bank','pending'),
  ('a6000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001',null,'b1000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000006',12500,'bank','pending')
on conflict (id) do nothing;

insert into public.leave_requests (id, employee_id, leave_type, start_date, end_date, reason) values
  ('b4000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000015','annual', current_date + 10, current_date + 14, 'Family visit in Burco')
on conflict (id) do nothing;

insert into public.change_requests (id, project_id, requested_by, title, description, cost_impact, days_impact, status) values
  ('b5000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000016','Add a balcony','Client wants a balcony on the first floor bedroom.',3200,10,'priced')
on conflict (id) do nothing;

update public.stages set status = 'done', progress_pct = 100
 where project_id = 'f0000000-0000-4000-8000-000000000002' and seq = 1 and status <> 'verified';

create or replace function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated', 'aal', 'aal1')::text, true);
$$;

do $$
begin
  if not exists (select 1 from public.approvals) then
    -- material request by the site engineer -> project manager
    perform pg_temp.as_user('00000000-0000-4000-8000-000000000009');
    perform public.request_approval('material_request','material_requests','b3000000-0000-4000-8000-000000000001','Material request MR-DEMO-001 (roof)');
    -- supplier payment under threshold by finance: finance step skipped -> owner (fallback)
    perform pg_temp.as_user('00000000-0000-4000-8000-000000000003');
    perform public.request_approval('payment','supplier_payments','a6000000-0000-4000-8000-000000000002','Pay Hargeisa Steel — PO-DEMO-002');
    -- supplier payment above threshold by procurement: finance -> owner
    perform pg_temp.as_user('00000000-0000-4000-8000-000000000006');
    perform public.request_approval('payment','supplier_payments','a6000000-0000-4000-8000-000000000003','Advance to Berbera Cement (bulk order)');
    -- leave by employee -> HR
    perform pg_temp.as_user('00000000-0000-4000-8000-000000000015');
    perform public.request_approval('leave','leave_requests','b4000000-0000-4000-8000-000000000001','Annual leave — Cali (5 days)');
    -- change request raised by client -> PM -> owner
    perform pg_temp.as_user('00000000-0000-4000-8000-000000000016');
    perform public.request_approval('change_request','change_requests','b5000000-0000-4000-8000-000000000001','Change: add a balcony (villa)');
    -- stage completion by PM2 -> PM step skipped (PM2 is a PM) -> owner
    perform pg_temp.as_user('00000000-0000-4000-8000-000000000018');
    perform public.request_approval('stage_completion','stages',
      (select id from public.stages where project_id = 'f0000000-0000-4000-8000-000000000002' and seq = 1),
      'Foundation complete — commercial block');
    -- BOQ v1 for project 2 by the QS (not a member there, but QS role) -> PM -> owner
    perform pg_temp.as_user('00000000-0000-4000-8000-000000000011');
    perform public.request_approval('boq','boq','f0000000-0000-4000-8000-000000000002','BOQ v1 — commercial block', null, 1);
    perform set_config('request.jwt.claims', '', true);
  end if;
end $$;

-- a few general notifications for the owner
insert into public.notifications (user_id, type, title, body, link)
select '00000000-0000-4000-8000-000000000001', t, ti, b, l from (values
  ('alert','Low stock: Rebar 16 mm','Only a few bars left in the main yard.','/owner/inventory'),
  ('finance','Invoice overdue: INV-DEMO-003','Axmed family villa — $9,000 still unpaid.','/owner/finance'),
  ('project','Project delayed: Primary school extension','Planned end date has passed.','/owner/projects/f0000000-0000-4000-8000-000000000003')
) v(t, ti, b, l)
where not exists (select 1 from public.notifications where user_id = '00000000-0000-4000-8000-000000000001' and type in ('alert','finance','project'));
