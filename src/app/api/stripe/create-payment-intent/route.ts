import { NextResponse } from 'next/server';
import { createPaymentIntent, ensureStripeCustomer } from '@/lib/stripe';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const {
      amount,
      customerName,
      customerEmail,
      customerPhone,
      service,
      invoiceNumber,
      note,
      saveCard,
      clerkUserId,
    } = await request.json();

    if (!amount) {
      return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
    }

    const amountInCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountInCents) || amountInCents <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    let stripeCustomerId: string | undefined;

    // If we have a clerkUserId or email, try to find/create a Stripe customer
    // This allows saving cards for future use
    if (saveCard || clerkUserId) {
      let supabaseCustomerId: string | null = null;

      // Try to find customer by clerk ID
      if (clerkUserId) {
        const { data } = await supabase.from('customers')
          .select('id').eq('clerk_user_id', clerkUserId).limit(1).single();
        if (data) supabaseCustomerId = data.id;
      }

      // Try email lookup
      if (!supabaseCustomerId && customerEmail) {
        const { data } = await supabase.from('customers')
          .select('id').eq('email', customerEmail).limit(1).single();
        if (data) supabaseCustomerId = data.id;
      }

      if (supabaseCustomerId) {
        try {
          stripeCustomerId = await ensureStripeCustomer(
            supabaseCustomerId,
            customerName,
            customerEmail,
            customerPhone,
          );
        } catch (err) {
          console.error('STRIPE_CUSTOMER_ERROR:', err);
          // Non-fatal — proceed without customer linkage
        }
      }
    }

    // Build metadata
    const metadata: Record<string, string> = {
      source: 'jhpsfl_website',
    };
    if (invoiceNumber) metadata.invoiceNumber = invoiceNumber;
    if (service) metadata.service = service.slice(0, 255);
    if (customerName) metadata.customerName = customerName;
    if (customerEmail) metadata.customerEmail = customerEmail;
    if (customerPhone) metadata.customerPhone = customerPhone;

    const description = note ||
      [service, invoiceNumber ? `INV#${invoiceNumber}` : ''].filter(Boolean).join(' — ') ||
      'JHPS Payment';

    const { clientSecret, paymentIntentId } = await createPaymentIntent({
      amountCents: amountInCents,
      customerEmail,
      customerName,
      metadata,
      description,
      stripeCustomerId,
      setupFutureUsage: saveCard || false,
    });

    return NextResponse.json({
      clientSecret,
      paymentIntentId,
    });
  } catch (error) {
    console.error('STRIPE_INTENT_ERROR:', error);
    const msg = error instanceof Error ? error.message : 'Failed to create payment';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
