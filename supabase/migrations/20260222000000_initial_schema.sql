-- JHPS Supabase Database Schema
-- Run this migration via Supabase CLI: supabase db push
-- Or via SQL editor in Supabase dashboard
-- ============================================

-- Enable UUID generation


-- ─── CUSTOMERS ───
-- Linked to Clerk auth via clerk_user_id
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  email text,
  name text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast Clerk ID lookups
create index if not exists idx_customers_clerk_id on customers(clerk_user_id);

-- ─── JOB SITES ───
-- A customer can have multiple properties
create table if not exists job_sites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  address text not null,
  city text,
  state text default 'FL',
  zip text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_job_sites_customer on job_sites(customer_id);

-- ─── JOBS ───
-- Individual service visits or projects
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  job_site_id uuid references job_sites(id) on delete set null,
  service_type text not null,
  description text,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_date date,
  completed_date date,
  amount decimal(10,2),
  crew_notes text,
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_jobs_customer on jobs(customer_id);
create index if not exists idx_jobs_status on jobs(status);
create index if not exists idx_jobs_scheduled on jobs(scheduled_date);

-- ─── PAYMENTS ───
-- Every transaction, linked to Square
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  amount decimal(10,2) not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  square_payment_id text,
  square_receipt_url text,
  payment_method text,
  notes text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_payments_customer on payments(customer_id);
create index if not exists idx_payments_status on payments(status);
create index if not exists idx_payments_square on payments(square_payment_id);

-- ─── SUBSCRIPTIONS ───
-- Recurring service plans
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  job_site_id uuid references job_sites(id) on delete set null,
  plan_name text not null,
  service_type text not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  amount decimal(10,2) not null,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  next_billing_date date,
  square_subscription_id text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_subscriptions_customer on subscriptions(customer_id);
create index if not exists idx_subscriptions_status on subscriptions(status);

-- ─── INVOICES ───
-- Generated billing documents
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  invoice_number text unique,
  amount decimal(10,2) not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date date,
  paid_date date,
  line_items jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_invoices_customer on invoices(customer_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoices_number on invoices(invoice_number);

-- ─── ADMIN USERS ───
-- Track which Clerk users have admin access
create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  email text,
  name text,
  role text not null default 'admin' check (role in ('admin', 'super_admin', 'crew')),
  created_at timestamptz default now()
);

create index if not exists idx_admin_users_clerk on admin_users(clerk_user_id);

-- ─── ROW LEVEL SECURITY (RLS) ───
-- This ensures customers can only see their own data

alter table customers enable row level security;
alter table job_sites enable row level security;
alter table jobs enable row level security;
alter table payments enable row level security;
alter table subscriptions enable row level security;
alter table invoices enable row level security;
alter table admin_users enable row level security;

-- Policies: Allow all operations via service role key (used by your API routes)
-- The API routes handle authorization via Clerk — Supabase just stores data
-- Service role key bypasses RLS, which is what your server-side code uses

create policy "Service role full access - customers" on customers for all using (true) with check (true);
create policy "Service role full access - job_sites" on job_sites for all using (true) with check (true);
create policy "Service role full access - jobs" on jobs for all using (true) with check (true);
create policy "Service role full access - payments" on payments for all using (true) with check (true);
create policy "Service role full access - subscriptions" on subscriptions for all using (true) with check (true);
create policy "Service role full access - invoices" on invoices for all using (true) with check (true);
create policy "Service role full access - admin_users" on admin_users for all using (true) with check (true);

-- ─── UPDATED_AT TRIGGER ───
-- Auto-update the updated_at column on row changes

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger customers_updated_at before update on customers for each row execute function update_updated_at();
create trigger job_sites_updated_at before update on job_sites for each row execute function update_updated_at();
create trigger jobs_updated_at before update on jobs for each row execute function update_updated_at();
create trigger subscriptions_updated_at before update on subscriptions for each row execute function update_updated_at();
create trigger invoices_updated_at before update on invoices for each row execute function update_updated_at();
