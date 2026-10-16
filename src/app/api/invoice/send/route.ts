import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { sendInvoiceEmail } from '@/lib/invoice-email';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { invoice, customer, payment_link } = body;

  if (!invoice || !customer?.email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('clerk_user_id', userId)
    .single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // "No emails" invoices are paid by texted link only — never email the customer.
  if (invoice.id) {
    const { data: flags } = await supabase.from('invoices').select('no_email').eq('id', invoice.id).maybeSingle();
    if (flags?.no_email) {
      return NextResponse.json({ error: 'This invoice is set to "No emails". Copy the payment link and text it instead.' }, { status: 400 });
    }
  }

  const result = await sendInvoiceEmail(supabase, invoice, customer, payment_link);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, thread_id: result.thread_id, resend_id: result.resend_id });
}
