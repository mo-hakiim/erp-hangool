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
