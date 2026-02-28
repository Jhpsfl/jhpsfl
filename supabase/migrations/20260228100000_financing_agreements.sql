-- Financing agreements table
-- Tracks digital signature agreements for estimates with payment plans
create table if not exists financing_agreements (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  token text unique not null,

  status text not null default 'pending'
    check (status in ('pending','viewed','signed','expired','voided')),

  -- Customer info captured at signing
  signer_name text,
  signer_email text,
  signer_phone text,
  signer_address text,

  -- Agreement content (snapshoted at creation — immutable)
  agreement_text text not null,
  payment_schedule jsonb,
  quote_snapshot jsonb,           -- full quote data at time of agreement creation

  -- Signature
  signature_url text,
  signed_at timestamptz,
  signer_ip text,
  signer_user_agent text,

  -- ID verification
  id_front_url text,
  id_back_url text,
  id_type text,                   -- drivers_license, state_id, passport, military_id

  -- Generated PDF
  signed_pdf_url text,

  -- Lifecycle
  viewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_agreements_quote on financing_agreements(quote_id);
create index if not exists idx_agreements_token on financing_agreements(token);
create index if not exists idx_agreements_status on financing_agreements(status);

-- Add payment_terms column to quotes if not already present
alter table quotes add column if not exists payment_terms jsonb default null;

-- updated_at trigger
create trigger financing_agreements_updated_at
  before update on financing_agreements
  for each row execute function update_updated_at();

-- RLS
alter table financing_agreements enable row level security;
create policy "Service role full access - financing_agreements"
  on financing_agreements for all using (true) with check (true);
