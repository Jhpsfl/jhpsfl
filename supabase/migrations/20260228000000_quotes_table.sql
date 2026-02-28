create table quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  quote_number text unique not null,
  status text not null default 'draft'
    check (status in ('draft','sent','accepted','declined','expired','converted')),
  subtotal numeric(10,2) not null default 0,
  tax_rate numeric(5,2) default 0,
  tax_amount numeric(10,2) default 0,
  total numeric(10,2) not null default 0,
  expiration_date date,
  notes text,
  line_items jsonb not null default '[]'::jsonb,
  show_financing boolean not null default false,
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  converted_invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
