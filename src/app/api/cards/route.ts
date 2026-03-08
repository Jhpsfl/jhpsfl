import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { ensureSquareCustomer, storeCardOnFile, deleteStoredCard } from '@/lib/square';
import { auth } from '@clerk/nextjs/server';

// ─── Auth: get customer from clerk_user_id ───
async function getCustomerFromClerk(clerkUserId: string) {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from('customers')
    .select('id, name, email, phone, square_customer_id')
    .eq('clerk_user_id', clerkUserId)
    .single();
  return data;
}

// ─── GET: List stored cards ───
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customer = await getCustomerFromClerk(userId);
    if (!customer) {
      return NextResponse.json({ cards: [] });
    }

    const supabase = createSupabaseAdmin();
    const { data: cards } = await supabase
      .from('stored_cards')
      .select('id, square_card_id, brand, last4, exp_month, exp_year, is_default, created_at')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ cards: cards || [] });
  } catch (err) {
    console.error('Cards GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Add a new card ───
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { cardToken } = await request.json();
    if (!cardToken) {
      return NextResponse.json({ error: 'Missing cardToken' }, { status: 400 });
    }

    const customer = await getCustomerFromClerk(userId);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const supabase = createSupabaseAdmin();

    // Ensure Square customer exists
    const sqCustId = await ensureSquareCustomer(customer.id, customer.name, customer.email, customer.phone);

    // Store card on Square
    const cardInfo = await storeCardOnFile(sqCustId, cardToken);

    // Check if first card
    const { count } = await supabase
      .from('stored_cards')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer.id);

    const isFirst = (count || 0) === 0;

    // Insert to DB
    const { data: newCard, error } = await supabase
      .from('stored_cards')
      .insert({
        customer_id: customer.id,
        square_card_id: cardInfo.cardId,
        brand: cardInfo.brand || null,
        last4: cardInfo.last4 || null,
        exp_month: cardInfo.expMonth || null,
        exp_year: cardInfo.expYear || null,
        is_default: isFirst,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, card: newCard });
  } catch (err) {
    console.error('Cards POST error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to store card';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── DELETE: Remove a card ───
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { cardId } = await request.json();
    if (!cardId) {
      return NextResponse.json({ error: 'Missing cardId' }, { status: 400 });
    }

    const customer = await getCustomerFromClerk(userId);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const supabase = createSupabaseAdmin();

    // Verify ownership
    const { data: card } = await supabase
      .from('stored_cards')
      .select('id, square_card_id, is_default')
      .eq('id', cardId)
      .eq('customer_id', customer.id)
      .single();

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Disable on Square
    try {
      await deleteStoredCard(card.square_card_id);
    } catch (sqErr) {
      console.error('Square card disable error (continuing):', sqErr);
    }

    // Remove from DB
    await supabase.from('stored_cards').delete().eq('id', cardId);

    // If it was default, promote next card
    if (card.is_default) {
      const { data: nextCard } = await supabase
        .from('stored_cards')
        .select('id')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (nextCard) {
        await supabase.from('stored_cards').update({ is_default: true }).eq('id', nextCard.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Cards DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Set default card ───
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { cardId } = await request.json();
    if (!cardId) {
      return NextResponse.json({ error: 'Missing cardId' }, { status: 400 });
    }

    const customer = await getCustomerFromClerk(userId);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const supabase = createSupabaseAdmin();

    // Verify ownership
    const { data: card } = await supabase
      .from('stored_cards')
      .select('id')
      .eq('id', cardId)
      .eq('customer_id', customer.id)
      .single();

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Unset all defaults for this customer
    await supabase
      .from('stored_cards')
      .update({ is_default: false })
      .eq('customer_id', customer.id);

    // Set this one as default
    await supabase
      .from('stored_cards')
      .update({ is_default: true })
      .eq('id', cardId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Cards PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
