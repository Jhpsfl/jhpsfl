import type { Metadata } from 'next';
import CardSetup from './CardSetup';
import { createSupabaseAdmin } from '@/lib/supabase';
import { authorizationText, creditAuthorizationText, isCreditWallet } from '@/lib/recurring-text';
import { balanceCents, loadInvoice } from '@/lib/invoice-payment';
import { nexaPayMetadata } from '@/lib/nexa-pay-metadata';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = nexaPayMetadata('Save your card', 'Automatic monthly billing for NexaVision Group.');

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { t } = await searchParams;
  const { data: sub } = t
    ? await createSupabaseAdmin().from('subscriptions').select('*, customers(name, email, phone)').eq('card_token', t).eq('brand', 'nexa').maybeSingle()
    : { data: null };
  const active = !!sub && sub.status !== 'cancelled';
  const invoice = active && sub.due_invoice ? await loadInvoice(createSupabaseAdmin(), sub.due_invoice) : null;
  const dueCents = invoice && !['paid', 'cancelled', 'void'].includes(invoice.status) ? balanceCents(invoice) : 0;
  return (
    <CardSetup
      token={t || ''}
      active={active}
      plan={sub?.plan_name || ''}
      name={sub?.customers?.name || ''}
      email={sub?.customers?.email || ''}
      phone={sub?.customers?.phone || ''}
      last4={active ? sub?.card_last4 || '' : ''}
      authorization={active ? (isCreditWallet(sub) ? creditAuthorizationText() : authorizationText(sub, dueCents)) : ''}
      credit={isCreditWallet(sub)}
      dueCents={dueCents}
      monthly={active ? Number(sub.amount) : 0}
      returnUrl={sub?.return_url || 'https://nexavisiongroup.com'}
    />
  );
}
