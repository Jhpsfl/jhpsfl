-- Nexa Pro external orders (2026-09-23): the Nexa site creates Nexa-branded
-- invoices server-to-server; these columns make that idempotent and let the
-- pay page send the buyer back to Nexa after paying.
alter table public.invoices add column if not exists external_source text;
alter table public.invoices add column if not exists external_order_id text;
alter table public.invoices add column if not exists return_url text;
create unique index if not exists invoices_external_order_id_key
  on public.invoices (external_order_id) where external_order_id is not null;
