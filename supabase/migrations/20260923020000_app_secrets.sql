-- Server-only secrets readable by the service role (RLS on, no policies, no grants to anon/authenticated).
-- Used when a secret can't be set in Vercel env (e.g. NEXA_ORDER_SECRET for /api/external/nexa-order).
create table if not exists public.app_secrets (key text primary key, value text not null, updated_at timestamptz not null default now());
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
-- value inserted out of band (never commit secrets)
