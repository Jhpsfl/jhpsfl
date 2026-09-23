-- Payment hardening (2026-09-23)
-- 1) Allow 'partial' invoices (deposits / installments). The admin UI already
--    writes 'partial', but the check constraint rejected it.
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status = any (array['draft','sent','partial','paid','overdue','cancelled']));
-- 2) One payments row per Stripe PaymentIntent (confirm-payment is idempotent).
create unique index if not exists payments_stripe_payment_id_key
  on public.payments (stripe_payment_id) where stripe_payment_id is not null;
