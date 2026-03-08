import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// GET: List all contacts, or search by query
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('q');

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase.from('admin_users').select('id').eq('clerk_user_id', userId).single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let query = supabase
    .from('email_contacts')
    .select('*')
    .order('name', { ascending: true });

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
  }

  const { data: contacts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ contacts: contacts || [] });
}

// POST: Create or update a contact
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, contact } = body as {
    action: 'create' | 'update' | 'delete';
    contact: {
      id?: string;
      name: string;
      email: string;
      phone?: string;
      company?: string;
      category?: string;
      notes?: string;
      starred?: boolean;
    };
  };

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase.from('admin_users').select('id').eq('clerk_user_id', userId).single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (action === 'create') {
    const { data, error } = await supabase
      .from('email_contacts')
      .upsert({
        name: contact.name,
        email: contact.email.toLowerCase(),
        phone: contact.phone || null,
        company: contact.company || null,
        category: contact.category || 'other',
        notes: contact.notes || null,
        starred: contact.starred || false,
      }, { onConflict: 'email' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contact: data });
  }

  if (action === 'update' && contact.id) {
    const { data, error } = await supabase
      .from('email_contacts')
      .update({
        name: contact.name,
        email: contact.email.toLowerCase(),
        phone: contact.phone || null,
        company: contact.company || null,
        category: contact.category || 'other',
        notes: contact.notes || null,
        starred: contact.starred ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contact: data });
  }

  if (action === 'delete' && contact.id) {
    const { error } = await supabase.from('email_contacts').delete().eq('id', contact.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ deleted: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
