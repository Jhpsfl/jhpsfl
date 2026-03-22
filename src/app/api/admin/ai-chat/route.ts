import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ═══════════════════════════════════════════
// WEB SEARCH (DuckDuckGo)
// ═══════════════════════════════════════════
async function webSearch(query: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      cache: "no-store",
    });
    if (!res.ok) return "Search failed.";
    const html = await res.text();
    const titles: { url: string; title: string }[] = [];
    const snippets: string[] = [];
    const titleRegex = /<a class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = titleRegex.exec(html)) !== null && titles.length < 6) {
      const url = match[1].replace(/.*uddg=/, "").split("&")[0];
      const title = match[2].replace(/<[^>]*>/g, "").trim();
      try { titles.push({ url: decodeURIComponent(url), title }); } catch { titles.push({ url, title }); }
    }
    while ((match = snippetRegex.exec(html)) !== null && snippets.length < 6) {
      snippets.push(match[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim());
    }
    const results: string[] = [];
    for (let i = 0; i < titles.length; i++) {
      results.push(`${i + 1}. **${titles[i].title}**\n   ${snippets[i] || ""}\n   Source: ${titles[i].url}`);
    }
    return results.length > 0 ? results.join("\n\n") : "No results found.";
  } catch {
    return "Search failed.";
  }
}

// ═══════════════════════════════════════════
// TOOL DEFINITIONS (Claude native tool_use)
// ═══════════════════════════════════════════

// ── READ TOOLS ──
const READ_TOOLS = [
  {
    name: "search_customers",
    description: "Search customers by name, email, phone, or company. Returns matching customer records.",
    input_schema: { type: "object" as const, properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] },
  },
  {
    name: "search_quotes",
    description: "Search quotes/estimates by customer name, quote number, or status. Returns list with totals and line item summaries.",
    input_schema: { type: "object" as const, properties: { query: { type: "string" }, status: { type: "string", description: "draft|sent|accepted|declined|expired|converted" }, limit: { type: "number" } }, required: ["query"] },
  },
  {
    name: "get_quote_details",
    description: "Get full quote details including line items, terms, payment schedule, exclusions, warranty, and closing statement. Use quote_number (e.g. QTE-2603-0001) or quote_id.",
    input_schema: { type: "object" as const, properties: { quote_id: { type: "string" }, quote_number: { type: "string" } } },
  },
  {
    name: "search_invoices",
    description: "Search invoices by customer name, invoice number, or status.",
    input_schema: { type: "object" as const, properties: { query: { type: "string" }, status: { type: "string", description: "draft|sent|paid|overdue|cancelled" }, limit: { type: "number" } }, required: ["query"] },
  },
  {
    name: "search_jobs",
    description: "Search jobs by customer name, service type, or status.",
    input_schema: { type: "object" as const, properties: { query: { type: "string" }, status: { type: "string", description: "scheduled|in_progress|completed|cancelled" }, limit: { type: "number" } }, required: ["query"] },
  },
  {
    name: "search_subscriptions",
    description: "Search recurring service subscriptions by customer name, service type, or frequency.",
    input_schema: { type: "object" as const, properties: { query: { type: "string" }, status: { type: "string", description: "active|paused|cancelled" }, limit: { type: "number" } }, required: ["query"] },
  },
  {
    name: "search_yelp_conversations",
    description: "Search Yelp lead conversations by customer name, service, status, or urgency.",
    input_schema: { type: "object" as const, properties: { query: { type: "string" }, status: { type: "string", description: "ai_active|needs_attention|taken_over|completed" }, limit: { type: "number" } }, required: ["query"] },
  },
  {
    name: "search_video_leads",
    description: "Search video quote leads by name, email, service requested, or status.",
    input_schema: { type: "object" as const, properties: { query: { type: "string" }, status: { type: "string" }, limit: { type: "number" } }, required: ["query"] },
  },
  {
    name: "search_email_threads",
    description: "Search email messages/threads by contact name, email address, or subject line.",
    input_schema: { type: "object" as const, properties: { query: { type: "string" }, folder: { type: "string", description: "inbox|sent|drafts|trash|spam|starred|yelp" }, limit: { type: "number" } }, required: ["query"] },
  },
  {
    name: "search_payments",
    description: "Search payment records by customer name, payment method, or status.",
    input_schema: { type: "object" as const, properties: { query: { type: "string" }, status: { type: "string" }, limit: { type: "number" } }, required: ["query"] },
  },
  {
    name: "get_dashboard_stats",
    description: "Get dashboard overview stats: total customers, quotes, invoices, jobs, revenue, pending amounts, conversion rates. Use when asked about business metrics or 'how are we doing'.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "search_quote_terms",
    description: "List available terms & conditions templates with their IDs, titles, and default status. Use before toggling terms on a quote.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "web_search",
    description: "Search the web for current info — pricing, FL codes, regulations, permits, competitor rates. Use when asked about anything that needs up-to-date external data.",
    input_schema: { type: "object" as const, properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "save_memory",
    description: "Save info to persistent memory. Use when user says 'remember this', 'save this', or 'note this'.",
    input_schema: { type: "object" as const, properties: { content: { type: "string" }, category: { type: "string", description: "general|pricing|preferences|projects|codes|materials" } }, required: ["content", "category"] },
  },
  {
    name: "forget_memory",
    description: "Delete a saved memory by keyword match.",
    input_schema: { type: "object" as const, properties: { keyword: { type: "string" } }, required: ["keyword"] },
  },
];

// ── WRITE TOOLS ──
const WRITE_TOOLS = [
  {
    name: "create_customer",
    description: "Create a new customer. Requires name at minimum. Returns the created customer with ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Full name (required)" },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" },
        city: { type: "string" },
        zip: { type: "string" },
        customer_type: { type: "string", description: "residential or commercial (default residential)" },
        company_name: { type: "string" },
        source: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_customer",
    description: "Update an existing customer record. Requires customer ID. Pass any fields to change.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Customer UUID (required)" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" },
        city: { type: "string" },
        zip: { type: "string" },
        customer_type: { type: "string" },
        company_name: { type: "string" },
        nickname: { type: "string" },
        billing_address: { type: "string" },
        billing_city: { type: "string" },
        billing_zip: { type: "string" },
        notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_quote",
    description: "Create a new quote/estimate. Requires customer_id or customer_name (will auto-find/create). Returns created quote with auto-generated QTE-YYMM-XXXX number. IMPORTANT: Draft in chat first, only create after user confirms.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_id: { type: "string", description: "Customer UUID (if known)" },
        customer_name: { type: "string", description: "Customer name (will search/create if no customer_id)" },
        service_address: { type: "string" },
        scope_summary: { type: "string", description: "1-2 sentence description of work" },
        line_items: {
          type: "array",
          description: "Array of line items",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unit: { type: "string", description: "visit, sqft, cuyd, each, lot, hour, lnft, flat" },
              unit_price: { type: "number" },
              section: { type: "string", description: "Optional section/phase grouping" },
            },
          },
        },
        exclusions: { type: "string", description: "Newline-separated list of exclusions" },
        warranty: { type: "string", description: "Warranty text (default: 30-day workmanship guarantee)" },
        closing_statement: { type: "string", description: "Professional closing with phone number" },
        tax_rate: { type: "number", description: "Tax percentage (default 0)" },
        notes: { type: "string", description: "Internal notes" },
        expiration_days: { type: "number", description: "Days until expiry (default 30)" },
        start_date: { type: "string", description: "Project start date" },
        completion_date: { type: "string", description: "Expected completion or 'Ongoing'" },
        is_commercial: { type: "boolean" },
        show_financing: { type: "boolean" },
        payment_terms: {
          type: "object",
          description: "Payment structure: {type: 'full'|'deposit_balance'|'deposit_installments', deposit_amount?, deposit_percentage?, num_installments?}",
        },
      },
    },
  },
  {
    name: "update_quote",
    description: "Update fields on an existing quote. Pass quote_number and any fields to change. Omitted fields stay as-is. Totals auto-recalculate when line items or tax change.",
    input_schema: {
      type: "object" as const,
      properties: {
        quote_number: { type: "string", description: "Quote number e.g. QTE-2603-0001 (required)" },
        service_address: { type: "string" },
        scope_summary: { type: "string" },
        ai_project_notes: { type: "string" },
        exclusions: { type: "string" },
        warranty: { type: "string" },
        closing_statement: { type: "string" },
        notes: { type: "string" },
        start_date: { type: "string" },
        completion_date: { type: "string" },
        tax_rate: { type: "number" },
        expiration_date: { type: "string" },
        show_financing: { type: "boolean" },
        is_commercial: { type: "boolean" },
        line_items: { type: "array", description: "REPLACES all existing line items", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unit: { type: "string" }, unit_price: { type: "number" }, section: { type: "string" } } } },
        payment_terms: { type: "object", description: "Payment structure object" },
        terms_conditions: { type: "array", description: "Array of term IDs to set (replaces all)", items: { type: "string" } },
      },
      required: ["quote_number"],
    },
  },
  {
    name: "add_quote_items",
    description: "Add line items to an existing quote WITHOUT replacing existing items. Totals auto-recalculate.",
    input_schema: {
      type: "object" as const,
      properties: {
        quote_number: { type: "string", description: "Quote number (required)" },
        items: { type: "array", description: "Items to add", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unit: { type: "string" }, unit_price: { type: "number" }, section: { type: "string" } } } },
      },
      required: ["quote_number", "items"],
    },
  },
  {
    name: "remove_quote_items",
    description: "Remove line items from a quote by description match (case-insensitive partial match). Totals auto-recalculate.",
    input_schema: {
      type: "object" as const,
      properties: {
        quote_number: { type: "string", description: "Quote number (required)" },
        descriptions: { type: "array", description: "Descriptions to match and remove", items: { type: "string" } },
      },
      required: ["quote_number", "descriptions"],
    },
  },
  {
    name: "update_quote_status",
    description: "Update quote status. Valid: draft, sent, accepted, declined, expired, converted.",
    input_schema: {
      type: "object" as const,
      properties: {
        quote_number: { type: "string", description: "Quote number (required)" },
        status: { type: "string", description: "New status (required)" },
      },
      required: ["quote_number", "status"],
    },
  },
  {
    name: "toggle_quote_terms",
    description: "Add or remove terms & conditions on a quote by name or ID. Resolves names to IDs automatically.",
    input_schema: {
      type: "object" as const,
      properties: {
        quote_number: { type: "string", description: "Quote number (required)" },
        add_terms: { type: "array", description: "Term names or IDs to enable", items: { type: "string" } },
        remove_terms: { type: "array", description: "Term names or IDs to disable", items: { type: "string" } },
      },
      required: ["quote_number"],
    },
  },
  {
    name: "send_quote",
    description: "Send a quote to the customer via email with PDF. The quote must exist and have line items.",
    input_schema: {
      type: "object" as const,
      properties: {
        quote_number: { type: "string", description: "Quote number (required)" },
        to_email: { type: "string", description: "Recipient email (required)" },
        to_name: { type: "string" },
        message: { type: "string", description: "Custom message to include" },
      },
      required: ["quote_number", "to_email"],
    },
  },
  {
    name: "create_invoice",
    description: "Create a new invoice. Requires customer_id or customer_name. Returns created invoice with auto-generated INV-YYMM-XXXX number.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_id: { type: "string" },
        customer_name: { type: "string" },
        line_items: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unit_price: { type: "number" } } } },
        tax_rate: { type: "number", description: "Tax percentage (default 0)" },
        due_days: { type: "number", description: "Days until due (default 15)" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "update_invoice",
    description: "Update an existing invoice by invoice number.",
    input_schema: {
      type: "object" as const,
      properties: {
        invoice_number: { type: "string", description: "Invoice number (required)" },
        status: { type: "string", description: "draft|sent|paid|overdue|cancelled" },
        line_items: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unit_price: { type: "number" } } } },
        tax_rate: { type: "number" },
        due_date: { type: "string" },
        notes: { type: "string" },
      },
      required: ["invoice_number"],
    },
  },
  {
    name: "record_payment",
    description: "Record a payment against an invoice. Updates amount_paid and status.",
    input_schema: {
      type: "object" as const,
      properties: {
        invoice_number: { type: "string", description: "Invoice number (required)" },
        amount: { type: "number", description: "Payment amount (required)" },
        payment_method: { type: "string", description: "cash|card|check|square (default cash)" },
        notes: { type: "string" },
      },
      required: ["invoice_number", "amount"],
    },
  },
  {
    name: "send_invoice",
    description: "Send an invoice to the customer via email.",
    input_schema: {
      type: "object" as const,
      properties: {
        invoice_number: { type: "string", description: "Invoice number (required)" },
        to_email: { type: "string", description: "Recipient email (required)" },
        to_name: { type: "string" },
        message: { type: "string" },
      },
      required: ["invoice_number", "to_email"],
    },
  },
  {
    name: "create_job",
    description: "Create a new job/service entry for a customer.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_id: { type: "string", description: "Customer UUID (required)" },
        service_type: { type: "string", description: "Type of service (required)" },
        description: { type: "string" },
        amount: { type: "number" },
        status: { type: "string", description: "scheduled|in_progress|completed (default scheduled)" },
        job_site_id: { type: "string" },
        crew_notes: { type: "string" },
        admin_notes: { type: "string" },
      },
      required: ["customer_id", "service_type"],
    },
  },
  {
    name: "update_job",
    description: "Update a job record by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Job UUID (required)" },
        status: { type: "string", description: "scheduled|in_progress|completed|cancelled" },
        amount: { type: "number" },
        description: { type: "string" },
        crew_notes: { type: "string" },
        admin_notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_subscription",
    description: "Create a recurring service subscription for a customer.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_id: { type: "string", description: "Customer UUID (required)" },
        plan_name: { type: "string", description: "Subscription plan name" },
        service_type: { type: "string", description: "Service type (required)" },
        frequency: { type: "string", description: "weekly|biweekly|monthly|quarterly|yearly (required)" },
        amount: { type: "number", description: "Billing amount per cycle (required)" },
        job_site_id: { type: "string" },
      },
      required: ["customer_id", "service_type", "frequency", "amount"],
    },
  },
  {
    name: "update_subscription",
    description: "Update a subscription by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Subscription UUID (required)" },
        status: { type: "string", description: "active|paused|cancelled" },
        frequency: { type: "string" },
        amount: { type: "number" },
        plan_name: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "reply_yelp_conversation",
    description: "Send a reply to a Yelp lead conversation via email. Updates conversation status.",
    input_schema: {
      type: "object" as const,
      properties: {
        conversation_id: { type: "string", description: "Yelp conversation UUID (required)" },
        message: { type: "string", description: "Reply message text (required)" },
        status: { type: "string", description: "Update status: taken_over|completed (optional)" },
      },
      required: ["conversation_id", "message"],
    },
  },
  {
    name: "compose_email",
    description: "Send a general email via Resend. For follow-ups, thank yous, or any outbound email.",
    input_schema: {
      type: "object" as const,
      properties: {
        to_email: { type: "string", description: "Recipient email (required)" },
        to_name: { type: "string" },
        subject: { type: "string", description: "Email subject (required)" },
        body: { type: "string", description: "Email body - can include HTML (required)" },
      },
      required: ["to_email", "subject", "body"],
    },
  },
  {
    name: "reply_email",
    description: "Reply to an existing email thread.",
    input_schema: {
      type: "object" as const,
      properties: {
        thread_id: { type: "string", description: "Email thread ID (required)" },
        body: { type: "string", description: "Reply body text (required)" },
      },
      required: ["thread_id", "body"],
    },
  },
  {
    name: "update_video_lead",
    description: "Update a video lead's status or assign to a customer.",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_id: { type: "string", description: "Video lead UUID (required)" },
        status: { type: "string", description: "New status" },
        customer_id: { type: "string", description: "Assign to customer UUID" },
      },
      required: ["lead_id"],
    },
  },
  {
    name: "navigate",
    description: "Navigate the user to a specific admin tab. Use after creating records or when user asks to go somewhere.",
    input_schema: {
      type: "object" as const,
      properties: {
        tab: { type: "string", description: "Tab name: overview, customers, jobs, payments, subscriptions, invoices, quotes, yelp_leads, video_leads, messages, analytics" },
        description: { type: "string", description: "Brief description of destination" },
      },
      required: ["tab"],
    },
  },
];

const TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];

// ═══════════════════════════════════════════
// HELPER: Find or create customer by name
// ═══════════════════════════════════════════
async function findOrCreateCustomer(supabase: any, name?: string, id?: string): Promise<string | null> {
  if (id) return id;
  if (!name) return null;
  const { data: found } = await supabase
    .from("customers")
    .select("id")
    .ilike("name", `%${name}%`)
    .limit(1);
  if (found?.length) return found[0].id;
  const { data: created } = await supabase
    .from("customers")
    .insert({ name, customer_type: "residential" })
    .select("id")
    .single();
  return created?.id || null;
}

// ═══════════════════════════════════════════
// HELPER: Generate sequential number
// ═══════════════════════════════════════════
async function generateNumber(supabase: any, table: string, column: string, prefix: string): Promise<string> {
  const now = new Date();
  const fullPrefix = `${prefix}-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  const { data: existing } = await supabase
    .from(table)
    .select(column)
    .like(column, `${fullPrefix}%`)
    .order(column, { ascending: false })
    .limit(1);
  let nextNum = 1;
  if (existing?.length) {
    const last = parseInt(existing[0][column].replace(fullPrefix, ""), 10);
    if (!isNaN(last)) nextNum = last + 1;
  }
  return `${fullPrefix}${String(nextNum).padStart(4, "0")}`;
}

// ═══════════════════════════════════════════
// HELPER: Recalculate quote totals
// ═══════════════════════════════════════════
function recalcQuoteTotals(lineItems: any[], taxRate: number) {
  const subtotal = lineItems.reduce((s: number, li: any) => s + (li.amount || 0), 0);
  const tax_amount = subtotal * (taxRate / 100);
  return { subtotal, tax_amount, total: subtotal + tax_amount };
}

// ═══════════════════════════════════════════
// HELPER: Resolve term names to IDs
// ═══════════════════════════════════════════
async function resolveTermIds(supabase: any, terms: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const t of terms) {
    if (/^[0-9a-f-]{36}$/i.test(t)) { ids.push(t); continue; }
    const { data } = await supabase.from("quote_terms").select("id").ilike("title", `%${t}%`).limit(1);
    if (data?.length) ids.push(data[0].id);
  }
  return ids;
}

// ═══════════════════════════════════════════
// TOOL EXECUTION
// ═══════════════════════════════════════════
async function executeTool(
  name: string,
  input: any,
  supabase: any
): Promise<{ result: string; action?: { type: string; tab?: string; created_id?: string; description?: string } }> {
  switch (name) {
    // ── READ TOOLS ──
    case "search_customers": {
      const q = input.query?.toLowerCase() || "";
      const limit = input.limit || 15;
      const { data } = await supabase
        .from("customers")
        .select("id, name, email, phone, address, city, zip, customer_type, company_name, created_at")
        .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company_name.ilike.%${q}%`)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!data?.length) return { result: `No customers found matching "${input.query}".` };
      return { result: JSON.stringify(data, null, 2) };
    }

    case "search_quotes": {
      const q = input.query?.toLowerCase() || "";
      const limit = input.limit || 10;
      let query = supabase
        .from("quotes")
        .select("id, quote_number, status, total, service_address, scope_summary, created_at, customer:customers(name, email, phone)")
        .or(`quote_number.ilike.%${q}%,scope_summary.ilike.%${q}%,service_address.ilike.%${q}%`);
      if (input.status) query = query.eq("status", input.status);
      const { data } = await query.order("created_at", { ascending: false }).limit(limit);
      if (!data?.length) {
        // Try by customer name
        const { data: byCustomer } = await supabase
          .from("quotes")
          .select("id, quote_number, status, total, service_address, scope_summary, created_at, customer:customers!inner(name, email, phone)")
          .ilike("customers.name", `%${q}%`)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (!byCustomer?.length) return { result: `No quotes found matching "${input.query}".` };
        return { result: JSON.stringify(byCustomer, null, 2) };
      }
      return { result: JSON.stringify(data, null, 2) };
    }

    case "get_quote_details": {
      let query = supabase.from("quotes").select("*, customer:customers(name, email, phone, address)");
      if (input.quote_id) query = query.eq("id", input.quote_id);
      else if (input.quote_number) query = query.eq("quote_number", input.quote_number);
      else return { result: "Please provide a quote_id or quote_number." };
      const { data: q } = await query.single();
      if (!q) return { result: "Quote not found." };

      // Resolve terms to names
      let termsInfo = "None active";
      if (q.terms_conditions?.length) {
        const { data: terms } = await supabase.from("quote_terms").select("id, title").in("id", q.terms_conditions);
        if (terms?.length) termsInfo = terms.map((t: any) => `${t.title} (${t.id})`).join(", ");
      }

      const items = (q.line_items || []).map((li: any) =>
        `  - ${li.description} (qty:${li.quantity} ${li.unit || "flat"} @ $${li.unit_price} = $${li.amount})${li.section ? ` [${li.section}]` : ""}`
      ).join("\n");

      return {
        result: `QUOTE: ${q.quote_number}\nCustomer: ${q.customer?.name || "Unknown"}\nEmail: ${q.customer?.email || ""}\nPhone: ${q.customer?.phone || ""}\nService Address: ${q.service_address || "Not set"}\nStatus: ${q.status || "draft"}\nCreated: ${q.created_at}\nExpiration: ${q.expiration_date || "Not set"}\n\nLine Items:\n${items || "  None"}\n\nSubtotal: $${q.subtotal || 0}\nTax: ${q.tax_rate || 0}% ($${q.tax_amount || 0})\nTotal: $${q.total || 0}\n\nScope: ${q.scope_summary || "Not set"}\nAI Notes: ${q.ai_project_notes || "Not set"}\nStart: ${q.start_date || "Not set"}\nCompletion: ${q.completion_date || "Not set"}\nExclusions: ${q.exclusions || "Not set"}\nWarranty: ${q.warranty || "Not set"}\nClosing: ${q.closing_statement || "Not set"}\nNotes: ${q.notes || "Not set"}\nFinancing: ${q.show_financing ? "Yes" : "No"}\nCommercial: ${q.is_commercial ? "Yes" : "No"}\nPayment Terms: ${q.payment_terms ? JSON.stringify(q.payment_terms) : "None"}\nActive Terms: ${termsInfo}`,
      };
    }

    case "search_invoices": {
      const q = input.query?.toLowerCase() || "";
      const limit = input.limit || 10;
      let query = supabase
        .from("invoices")
        .select("id, invoice_number, status, total, amount_paid, due_date, created_at, customer:customers(name, email, phone)")
        .or(`invoice_number.ilike.%${q}%`);
      if (input.status) query = query.eq("status", input.status);
      const { data } = await query.order("created_at", { ascending: false }).limit(limit);
      if (!data?.length) {
        const { data: byCustomer } = await supabase
          .from("invoices")
          .select("id, invoice_number, status, total, amount_paid, due_date, created_at, customer:customers!inner(name, email, phone)")
          .ilike("customers.name", `%${q}%`)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (!byCustomer?.length) return { result: `No invoices found matching "${input.query}".` };
        return { result: JSON.stringify(byCustomer, null, 2) };
      }
      return { result: JSON.stringify(data, null, 2) };
    }

    case "search_jobs": {
      const q = input.query?.toLowerCase() || "";
      const limit = input.limit || 15;
      let query = supabase
        .from("jobs")
        .select("id, service_type, description, status, amount, completed_date, created_at, customer:customers(name)")
        .or(`service_type.ilike.%${q}%,description.ilike.%${q}%`);
      if (input.status) query = query.eq("status", input.status);
      const { data } = await query.order("created_at", { ascending: false }).limit(limit);
      if (!data?.length) {
        const { data: byCustomer } = await supabase
          .from("jobs")
          .select("id, service_type, description, status, amount, created_at, customer:customers!inner(name)")
          .ilike("customers.name", `%${q}%`)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (!byCustomer?.length) return { result: `No jobs found matching "${input.query}".` };
        return { result: JSON.stringify(byCustomer, null, 2) };
      }
      return { result: JSON.stringify(data, null, 2) };
    }

    case "search_subscriptions": {
      const q = input.query?.toLowerCase() || "";
      const limit = input.limit || 10;
      let query = supabase
        .from("subscriptions")
        .select("id, plan_name, service_type, frequency, amount, status, next_billing_date, created_at, customer:customers(name)")
        .or(`service_type.ilike.%${q}%,plan_name.ilike.%${q}%`);
      if (input.status) query = query.eq("status", input.status);
      const { data } = await query.order("created_at", { ascending: false }).limit(limit);
      if (!data?.length) return { result: `No subscriptions found matching "${input.query}".` };
      return { result: JSON.stringify(data, null, 2) };
    }

    case "search_yelp_conversations": {
      const q = input.query?.toLowerCase() || "";
      const limit = input.limit || 10;
      let query = supabase
        .from("yelp_conversations")
        .select("id, customer_name, services, zip_code, urgency, status, ai_exchange_count, last_customer_message_at, created_at");
      if (q) query = query.or(`customer_name.ilike.%${q}%,services.cs.{${q}}`);
      if (input.status) query = query.eq("status", input.status);
      const { data } = await query.order("created_at", { ascending: false }).limit(limit);
      if (!data?.length) return { result: `No Yelp conversations found matching "${input.query}".` };
      return { result: JSON.stringify(data, null, 2) };
    }

    case "search_video_leads": {
      const q = input.query?.toLowerCase() || "";
      const limit = input.limit || 10;
      let query = supabase
        .from("video_leads")
        .select("id, name, email, phone, address, property_type, service_requested, status, created_at")
        .or(`name.ilike.%${q}%,email.ilike.%${q}%,service_requested.ilike.%${q}%`);
      if (input.status) query = query.eq("status", input.status);
      const { data } = await query.order("created_at", { ascending: false }).limit(limit);
      if (!data?.length) return { result: `No video leads found matching "${input.query}".` };
      return { result: JSON.stringify(data, null, 2) };
    }

    case "search_email_threads": {
      const q = input.query?.toLowerCase() || "";
      const limit = input.limit || 15;
      let query = supabase
        .from("email_messages")
        .select("id, thread_id, direction, from_email, to_email, subject, body_text, read, created_at")
        .or(`from_email.ilike.%${q}%,to_email.ilike.%${q}%,subject.ilike.%${q}%,body_text.ilike.%${q}%`);
      if (input.folder === "sent") query = query.eq("direction", "outbound");
      else if (input.folder === "inbox") query = query.eq("direction", "inbound");
      const { data } = await query.order("created_at", { ascending: false }).limit(limit);
      if (!data?.length) return { result: `No emails found matching "${input.query}".` };
      // Truncate body for summary
      const summary = data.map((e: any) => ({
        ...e,
        body_text: e.body_text ? e.body_text.slice(0, 200) + (e.body_text.length > 200 ? "..." : "") : "",
      }));
      return { result: JSON.stringify(summary, null, 2) };
    }

    case "search_payments": {
      const q = input.query?.toLowerCase() || "";
      const limit = input.limit || 15;
      let query = supabase
        .from("payments")
        .select("id, amount, status, payment_method, square_payment_id, created_at, customer:customers(name)")
        .or(`payment_method.ilike.%${q}%,status.ilike.%${q}%`);
      if (input.status) query = query.eq("status", input.status);
      const { data } = await query.order("created_at", { ascending: false }).limit(limit);
      if (!data?.length) {
        const { data: byCustomer } = await supabase
          .from("payments")
          .select("id, amount, status, payment_method, created_at, customer:customers!inner(name)")
          .ilike("customers.name", `%${q}%`)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (!byCustomer?.length) return { result: `No payments found matching "${input.query}".` };
        return { result: JSON.stringify(byCustomer, null, 2) };
      }
      return { result: JSON.stringify(data, null, 2) };
    }

    case "get_dashboard_stats": {
      const [customers, quotes, invoices, jobs, payments] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("quotes").select("id, status, total"),
        supabase.from("invoices").select("id, status, total, amount_paid"),
        supabase.from("jobs").select("id, status, amount"),
        supabase.from("payments").select("id, amount, status"),
      ]);
      const quoteData = quotes.data || [];
      const invoiceData = invoices.data || [];
      const jobData = jobs.data || [];
      const paymentData = payments.data || [];
      const totalRevenue = paymentData.filter((p: any) => p.status === "completed").reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const pendingInvoices = invoiceData.filter((i: any) => i.status === "sent" || i.status === "overdue");
      const pendingAmount = pendingInvoices.reduce((s: number, i: any) => s + ((i.total || 0) - (i.amount_paid || 0)), 0);
      return {
        result: `Dashboard Stats:\n- Customers: ${customers.count || 0}\n- Quotes: ${quoteData.length} (draft: ${quoteData.filter((q: any) => q.status === "draft").length}, sent: ${quoteData.filter((q: any) => q.status === "sent").length}, accepted: ${quoteData.filter((q: any) => q.status === "accepted").length})\n- Invoices: ${invoiceData.length} (pending: ${pendingInvoices.length}, paid: ${invoiceData.filter((i: any) => i.status === "paid").length})\n- Jobs: ${jobData.length} (active: ${jobData.filter((j: any) => j.status === "in_progress" || j.status === "scheduled").length}, completed: ${jobData.filter((j: any) => j.status === "completed").length})\n- Total Revenue: $${totalRevenue.toLocaleString()}\n- Pending Amount: $${pendingAmount.toLocaleString()}`,
      };
    }

    case "search_quote_terms": {
      const { data: terms } = await supabase.from("quote_terms").select("*").order("sort_order");
      if (!terms?.length) return { result: "No terms found." };
      return {
        result: terms.map((t: any, i: number) =>
          `${i + 1}. ID: ${t.id} | ${t.title} | Default: ${t.is_default ? "ON" : "OFF"}\n   ${(t.body || "").slice(0, 120)}`
        ).join("\n"),
      };
    }

    case "web_search": {
      return { result: await webSearch(input.query) };
    }

    case "save_memory": {
      await supabase.from("ai_memories").insert({ content: input.content, category: input.category || "general", source: "ai" });
      return { result: `Memory saved: "${input.content}" (${input.category})` };
    }

    case "forget_memory": {
      const { data: deleted } = await supabase.from("ai_memories").delete().ilike("content", `%${input.keyword}%`).select("content");
      if (deleted?.length) return { result: `Deleted ${deleted.length} memory/memories matching "${input.keyword}".` };
      return { result: `No memories found matching "${input.keyword}".` };
    }

    // ── WRITE TOOLS ──
    case "create_customer": {
      if (!input.name) return { result: "Error: name is required." };
      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          address: input.address || null,
          city: input.city || null,
          zip: input.zip || null,
          customer_type: input.customer_type || "residential",
          company_name: input.company_name || null,
        })
        .select()
        .single();
      if (error) return { result: `Error creating customer: ${error.message}` };
      return {
        result: `Customer created: ${data.name} (ID: ${data.id})`,
        action: { type: "create_customer", tab: "customers", created_id: data.id },
      };
    }

    case "update_customer": {
      if (!input.id) return { result: "Error: customer id required." };
      const { id, ...fields } = input;
      if (!Object.keys(fields).length) return { result: "Error: no fields to update." };
      const { data, error } = await supabase
        .from("customers")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) return { result: `Error: ${error.message}` };
      if (!data) return { result: "Customer not found." };
      return { result: `Customer updated: ${data.name}` };
    }

    case "create_quote": {
      const customerId = await findOrCreateCustomer(supabase, input.customer_name, input.customer_id);
      const quoteNumber = await generateNumber(supabase, "quotes", "quote_number", "QTE");

      const lineItems = (input.line_items || []).map((li: any) => ({
        id: "ai_" + Math.random().toString(36).slice(2, 8),
        description: li.description || "",
        quantity: li.quantity || 1,
        unit: li.unit || "flat",
        unit_price: li.unit_price || 0,
        amount: (li.quantity || 1) * (li.unit_price || 0),
        section: li.section || undefined,
      }));
      const taxRate = input.tax_rate || 0;
      const totals = recalcQuoteTotals(lineItems, taxRate);
      const expDays = input.expiration_days || 30;
      const expDate = new Date(Date.now() + expDays * 86400000).toISOString().split("T")[0];

      // Build payment terms if provided
      let paymentTerms = input.payment_terms || null;
      if (paymentTerms && paymentTerms.type === "deposit_balance" && paymentTerms.deposit_percentage && !paymentTerms.deposit_amount) {
        paymentTerms.deposit_amount = Math.round(totals.total * (paymentTerms.deposit_percentage / 100));
        paymentTerms.schedule = [
          { label: "Deposit", amount: paymentTerms.deposit_amount, status: "pending" },
          { label: "Balance Due on Completion", amount: totals.total - paymentTerms.deposit_amount, status: "pending" },
        ];
      }

      const { data, error } = await supabase.from("quotes").insert({
        quote_number: quoteNumber,
        customer_id: customerId,
        status: "draft",
        line_items: lineItems,
        ...totals,
        tax_rate: taxRate,
        service_address: input.service_address || null,
        scope_summary: input.scope_summary || null,
        exclusions: input.exclusions || null,
        warranty: input.warranty || "All workmanship guaranteed for 30 days from completion.",
        closing_statement: input.closing_statement || null,
        notes: input.notes || null,
        expiration_date: expDate,
        start_date: input.start_date || null,
        completion_date: input.completion_date || null,
        is_commercial: input.is_commercial || false,
        show_financing: input.show_financing || false,
        payment_terms: paymentTerms,
      }).select().single();

      if (error) return { result: `Error creating quote: ${error.message}` };
      return {
        result: `Quote ${quoteNumber} created — $${totals.total.toFixed(2)} total`,
        action: { type: "create_quote", tab: "quotes", created_id: data.id },
      };
    }

    case "update_quote": {
      if (!input.quote_number) return { result: "Error: quote_number required." };
      const { data: existing } = await supabase
        .from("quotes")
        .select("id, line_items, tax_rate, subtotal, terms_conditions")
        .eq("quote_number", input.quote_number)
        .single();
      if (!existing) return { result: `Quote ${input.quote_number} not found.` };

      const updates: any = { updated_at: new Date().toISOString() };
      const textFields = ["service_address", "scope_summary", "ai_project_notes", "exclusions", "warranty", "closing_statement", "notes", "start_date", "completion_date"];
      for (const f of textFields) {
        if (input[f] !== undefined) updates[f] = input[f] || null;
      }
      if (input.tax_rate !== undefined) updates.tax_rate = Number(input.tax_rate) || 0;
      if (input.show_financing !== undefined) updates.show_financing = !!input.show_financing;
      if (input.is_commercial !== undefined) updates.is_commercial = !!input.is_commercial;
      if (input.expiration_date !== undefined) updates.expiration_date = input.expiration_date || null;
      if (input.payment_terms !== undefined) updates.payment_terms = input.payment_terms || null;
      if (input.terms_conditions !== undefined) updates.terms_conditions = input.terms_conditions;

      if (input.line_items) {
        updates.line_items = input.line_items.map((li: any) => ({
          id: li.id || "ai_" + Math.random().toString(36).slice(2, 8),
          description: li.description || "",
          quantity: li.quantity || 1,
          unit: li.unit || "flat",
          unit_price: li.unit_price || 0,
          amount: (li.quantity || 1) * (li.unit_price || 0),
          section: li.section || undefined,
        }));
        const taxRate = updates.tax_rate !== undefined ? updates.tax_rate : (existing.tax_rate || 0);
        Object.assign(updates, recalcQuoteTotals(updates.line_items, taxRate));
      } else if (updates.tax_rate !== undefined) {
        const currentSubtotal = existing.subtotal || 0;
        updates.tax_amount = currentSubtotal * (updates.tax_rate / 100);
        updates.total = currentSubtotal + updates.tax_amount;
      }

      const { error } = await supabase.from("quotes").update(updates).eq("id", existing.id);
      if (error) return { result: `Error: ${error.message}` };
      const changedFields = Object.keys(updates).filter(k => k !== "updated_at");
      return { result: `Quote ${input.quote_number} updated — changed: ${changedFields.join(", ")}` };
    }

    case "add_quote_items": {
      if (!input.quote_number || !input.items?.length) return { result: "Error: quote_number and items required." };
      const { data: existing } = await supabase.from("quotes").select("id, line_items, tax_rate").eq("quote_number", input.quote_number).single();
      if (!existing) return { result: `Quote ${input.quote_number} not found.` };

      const newItems = input.items.map((li: any) => ({
        id: "ai_" + Math.random().toString(36).slice(2, 8),
        description: li.description || "",
        quantity: li.quantity || 1,
        unit: li.unit || "flat",
        unit_price: li.unit_price || 0,
        amount: (li.quantity || 1) * (li.unit_price || 0),
        section: li.section || undefined,
      }));
      const allItems = [...(existing.line_items || []), ...newItems];
      const totals = recalcQuoteTotals(allItems, existing.tax_rate || 0);

      const { error } = await supabase.from("quotes").update({ line_items: allItems, ...totals, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) return { result: `Error: ${error.message}` };
      return { result: `Added ${newItems.length} item(s) to ${input.quote_number}. New total: $${totals.total.toFixed(2)}` };
    }

    case "remove_quote_items": {
      if (!input.quote_number || !input.descriptions?.length) return { result: "Error: quote_number and descriptions required." };
      const { data: existing } = await supabase.from("quotes").select("id, line_items, tax_rate").eq("quote_number", input.quote_number).single();
      if (!existing) return { result: `Quote ${input.quote_number} not found.` };

      const removeDescs = input.descriptions.map((d: string) => d.toLowerCase());
      const remaining = (existing.line_items || []).filter((li: any) =>
        !removeDescs.some((rd: string) => (li.description || "").toLowerCase().includes(rd))
      );
      const removed = (existing.line_items || []).length - remaining.length;
      const totals = recalcQuoteTotals(remaining, existing.tax_rate || 0);

      const { error } = await supabase.from("quotes").update({ line_items: remaining, ...totals, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) return { result: `Error: ${error.message}` };
      return { result: `Removed ${removed} item(s) from ${input.quote_number}. New total: $${totals.total.toFixed(2)}` };
    }

    case "update_quote_status": {
      if (!input.quote_number || !input.status) return { result: "Error: quote_number and status required." };
      const { data: existing } = await supabase.from("quotes").select("id, status").eq("quote_number", input.quote_number).single();
      if (!existing) return { result: `Quote ${input.quote_number} not found.` };
      const { error } = await supabase.from("quotes").update({ status: input.status, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) return { result: `Error: ${error.message}` };
      return { result: `Quote ${input.quote_number} status: ${existing.status} → ${input.status}` };
    }

    case "toggle_quote_terms": {
      if (!input.quote_number) return { result: "Error: quote_number required." };
      const { data: existing } = await supabase.from("quotes").select("id, terms_conditions").eq("quote_number", input.quote_number).single();
      if (!existing) return { result: `Quote ${input.quote_number} not found.` };

      let current = existing.terms_conditions || [];
      if (input.add_terms?.length) {
        const addIds = await resolveTermIds(supabase, input.add_terms);
        current = Array.from(new Set([...current, ...addIds]));
      }
      if (input.remove_terms?.length) {
        const removeIds = await resolveTermIds(supabase, input.remove_terms);
        current = current.filter((id: string) => !removeIds.includes(id));
      }

      const { error } = await supabase.from("quotes").update({ terms_conditions: current, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) return { result: `Error: ${error.message}` };
      return { result: `Quote ${input.quote_number} terms updated. ${current.length} terms now active.` };
    }

    case "send_quote": {
      if (!input.quote_number || !input.to_email) return { result: "Error: quote_number and to_email required." };
      const { data: q } = await supabase
        .from("quotes")
        .select("id, quote_number, total, share_token, customer:customers(name)")
        .eq("quote_number", input.quote_number)
        .single();
      if (!q) return { result: `Quote ${input.quote_number} not found.` };

      // Generate share token if needed
      let token = q.share_token;
      if (!token) {
        const crypto = await import("crypto");
        token = crypto.randomBytes(16).toString("hex");
        await supabase.from("quotes").update({ share_token: token }).eq("id", q.id);
      }

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://jhps.co";
      const viewLink = `${baseUrl}/quote/${token}`;
      const customerName = input.to_name || q.customer?.name || "there";
      const customMsg = input.message ? `<p>${input.message}</p>` : "";

      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "JHPS Florida <info@jhpsfl.com>",
          to: [input.to_email],
          subject: `Your Estimate from Jenkins Home & Property Solutions — ${q.quote_number}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333"><div style="background:#1B5E20;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">Jenkins Home & Property Solutions</h1></div><div style="padding:24px"><p>Hi ${customerName},</p>${customMsg}<p>Your estimate <strong>${q.quote_number}</strong> for <strong>$${(q.total || 0).toLocaleString()}</strong> is ready for review.</p><p style="text-align:center;margin:32px 0"><a href="${viewLink}" style="background:#1B5E20;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">View Your Estimate</a></p><p style="color:#666;font-size:13px">Or copy this link: ${viewLink}</p><p>Questions? Call or text <strong>(407) 686-9817</strong></p><p>— Jenkins Home & Property Solutions</p></div></div>`,
        });

        // Update status to sent
        await supabase.from("quotes").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", q.id);

        return { result: `Quote ${input.quote_number} sent to ${input.to_email} with view link.` };
      } catch (err: any) {
        return { result: `Error sending quote: ${err.message}` };
      }
    }

    case "create_invoice": {
      const customerId = await findOrCreateCustomer(supabase, input.customer_name, input.customer_id);
      const invoiceNumber = await generateNumber(supabase, "invoices", "invoice_number", "INV");

      const lineItems = (input.line_items || []).map((li: any) => ({
        description: li.description || "",
        quantity: li.quantity || 1,
        unit_price: li.unit_price || 0,
        amount: (li.quantity || 1) * (li.unit_price || 0),
      }));
      const subtotal = lineItems.reduce((s: number, li: any) => s + li.amount, 0);
      const taxRate = input.tax_rate || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;
      const dueDays = input.due_days || 15;
      const dueDate = new Date(Date.now() + dueDays * 86400000).toISOString().split("T")[0];

      const { data, error } = await supabase.from("invoices").insert({
        invoice_number: invoiceNumber,
        customer_id: customerId,
        status: "draft",
        line_items: lineItems,
        subtotal, tax_rate: taxRate, tax_amount: taxAmount, total,
        amount_paid: 0,
        due_date: dueDate,
        notes: input.notes || null,
      }).select().single();

      if (error) return { result: `Error: ${error.message}` };
      return {
        result: `Invoice ${invoiceNumber} created — $${total.toFixed(2)} total, due ${dueDate}`,
        action: { type: "create_invoice", tab: "invoices", created_id: data.id },
      };
    }

    case "update_invoice": {
      if (!input.invoice_number) return { result: "Error: invoice_number required." };
      const { data: existing } = await supabase.from("invoices").select("id, tax_rate").eq("invoice_number", input.invoice_number).single();
      if (!existing) return { result: `Invoice ${input.invoice_number} not found.` };

      const updates: any = { updated_at: new Date().toISOString() };
      if (input.status) updates.status = input.status;
      if (input.due_date) updates.due_date = input.due_date;
      if (input.notes !== undefined) updates.notes = input.notes || null;
      if (input.tax_rate !== undefined) updates.tax_rate = Number(input.tax_rate) || 0;

      if (input.line_items) {
        updates.line_items = input.line_items.map((li: any) => ({
          description: li.description || "",
          quantity: li.quantity || 1,
          unit_price: li.unit_price || 0,
          amount: (li.quantity || 1) * (li.unit_price || 0),
        }));
        const subtotal = updates.line_items.reduce((s: number, li: any) => s + li.amount, 0);
        const taxRate = updates.tax_rate !== undefined ? updates.tax_rate : (existing.tax_rate || 0);
        updates.subtotal = subtotal;
        updates.tax_amount = subtotal * (taxRate / 100);
        updates.total = subtotal + updates.tax_amount;
      }

      const { error } = await supabase.from("invoices").update(updates).eq("id", existing.id);
      if (error) return { result: `Error: ${error.message}` };
      return { result: `Invoice ${input.invoice_number} updated.` };
    }

    case "record_payment": {
      if (!input.invoice_number || !input.amount) return { result: "Error: invoice_number and amount required." };
      const { data: inv } = await supabase.from("invoices").select("id, customer_id, total, amount_paid").eq("invoice_number", input.invoice_number).single();
      if (!inv) return { result: `Invoice ${input.invoice_number} not found.` };

      const newPaid = (inv.amount_paid || 0) + input.amount;
      const newStatus = newPaid >= (inv.total || 0) ? "paid" : "sent";

      // Record payment
      await supabase.from("payments").insert({
        customer_id: inv.customer_id,
        job_id: null,
        amount: input.amount,
        status: "completed",
        payment_method: input.payment_method || "cash",
      });
      // Update invoice
      await supabase.from("invoices").update({ amount_paid: newPaid, status: newStatus, updated_at: new Date().toISOString() }).eq("id", inv.id);

      return { result: `Payment of $${input.amount.toFixed(2)} recorded on ${input.invoice_number}. Total paid: $${newPaid.toFixed(2)}/${inv.total}. Status: ${newStatus}` };
    }

    case "send_invoice": {
      if (!input.invoice_number || !input.to_email) return { result: "Error: invoice_number and to_email required." };
      const { data: inv } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, amount_paid, due_date, customer:customers(name)")
        .eq("invoice_number", input.invoice_number)
        .single();
      if (!inv) return { result: `Invoice ${input.invoice_number} not found.` };

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://jhps.co";
      const viewLink = `${baseUrl}/invoice/${input.invoice_number}`;
      const customerName = input.to_name || inv.customer?.name || "there";
      const balance = (inv.total || 0) - (inv.amount_paid || 0);
      const customMsg = input.message ? `<p>${input.message}</p>` : "";

      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "JHPS Florida <info@jhpsfl.com>",
          to: [input.to_email],
          subject: `Invoice ${inv.invoice_number} from Jenkins Home & Property Solutions`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333"><div style="background:#1B5E20;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">Jenkins Home & Property Solutions</h1></div><div style="padding:24px"><p>Hi ${customerName},</p>${customMsg}<p>Invoice <strong>${inv.invoice_number}</strong> for <strong>$${(inv.total || 0).toLocaleString()}</strong> is ready${inv.due_date ? ` — due by <strong>${inv.due_date}</strong>` : ""}.</p>${balance < (inv.total || 0) ? `<p>Amount paid: $${(inv.amount_paid || 0).toLocaleString()} | Balance: $${balance.toLocaleString()}</p>` : ""}<p style="text-align:center;margin:32px 0"><a href="${viewLink}" style="background:#1B5E20;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">View & Pay Invoice</a></p><p>Questions? Call or text <strong>(407) 686-9817</strong></p><p>— Jenkins Home & Property Solutions</p></div></div>`,
        });

        await supabase.from("invoices").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", inv.id);
        return { result: `Invoice ${input.invoice_number} sent to ${input.to_email}.` };
      } catch (err: any) {
        return { result: `Error: ${err.message}` };
      }
    }

    case "create_job": {
      if (!input.customer_id || !input.service_type) return { result: "Error: customer_id and service_type required." };
      const { data, error } = await supabase.from("jobs").insert({
        customer_id: input.customer_id,
        service_type: input.service_type,
        description: input.description || null,
        amount: input.amount || 0,
        status: input.status || "scheduled",
        job_site_id: input.job_site_id || null,
        crew_notes: input.crew_notes || null,
        admin_notes: input.admin_notes || null,
      }).select().single();
      if (error) return { result: `Error: ${error.message}` };
      return {
        result: `Job created: ${input.service_type} (ID: ${data.id})`,
        action: { type: "create_job", tab: "jobs", created_id: data.id },
      };
    }

    case "update_job": {
      if (!input.id) return { result: "Error: job id required." };
      const { id, ...fields } = input;
      const { error } = await supabase.from("jobs").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) return { result: `Error: ${error.message}` };
      return { result: `Job updated.` };
    }

    case "create_subscription": {
      if (!input.customer_id || !input.service_type || !input.frequency || !input.amount) {
        return { result: "Error: customer_id, service_type, frequency, and amount required." };
      }
      const { data, error } = await supabase.from("subscriptions").insert({
        customer_id: input.customer_id,
        plan_name: input.plan_name || input.service_type,
        service_type: input.service_type,
        frequency: input.frequency,
        amount: input.amount,
        status: "active",
        job_site_id: input.job_site_id || null,
      }).select().single();
      if (error) return { result: `Error: ${error.message}` };
      return {
        result: `Subscription created: ${input.service_type} ${input.frequency} @ $${input.amount}`,
        action: { type: "create_subscription", tab: "subscriptions", created_id: data.id },
      };
    }

    case "update_subscription": {
      if (!input.id) return { result: "Error: subscription id required." };
      const { id, ...fields } = input;
      const { error } = await supabase.from("subscriptions").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) return { result: `Error: ${error.message}` };
      return { result: `Subscription updated.` };
    }

    case "reply_yelp_conversation": {
      if (!input.conversation_id || !input.message) return { result: "Error: conversation_id and message required." };

      // Send reply via Yelp PATCH endpoint (triggers Puppeteer agent)
      const { data: conv } = await supabase.from("yelp_conversations").select("messages, yelp_thread_id, customer_name, services, taken_over_at").eq("id", input.conversation_id).single();
      if (!conv) return { result: "Yelp conversation not found." };

      const msgs = conv.messages || [];
      msgs.push({ role: "admin", text: input.message.trim(), ts: new Date().toISOString() });

      await supabase.from("yelp_conversations").update({
        messages: msgs,
        status: input.status || "taken_over",
        taken_over_at: conv.taken_over_at || new Date().toISOString(),
      }).eq("id", input.conversation_id);

      // Create trigger for Puppeteer to send via Yelp UI
      await supabase.from("yelp_triggers").insert({
        trigger_type: "manual_reply",
        lead_id: conv.yelp_thread_id,
        thread_id: conv.yelp_thread_id,
        customer_name: conv.customer_name,
        service: (conv.services || []).join(", "),
        email_body_text: input.message.trim(),
        status: "pending",
      });

      return { result: `Yelp reply queued for sending. Status: ${input.status || "taken_over"}` };
    }

    case "compose_email": {
      if (!input.to_email || !input.subject || !input.body) return { result: "Error: to_email, subject, and body required." };
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = "JHPS Florida <info@jhpsfl.com>";
        const { data: sent, error: sendErr } = await resend.emails.send({
          from: fromEmail,
          to: [input.to_email],
          subject: input.subject,
          html: input.body,
        });
        if (sendErr) return { result: `Error sending email: ${sendErr.message}` };

        // Log to email_messages table
        const threadId = "thread_" + Date.now();
        await supabase.from("email_messages").insert({
          thread_id: threadId,
          direction: "outbound",
          from_email: "info@jhpsfl.com",
          to_email: input.to_email,
          subject: input.subject,
          body_html: input.body,
          body_text: input.body.replace(/<[^>]*>/g, ""),
          resend_message_id: sent?.id || null,
          read: true,
        });

        return { result: `Email sent to ${input.to_email}: "${input.subject}"` };
      } catch (err: any) {
        return { result: `Error: ${err.message}` };
      }
    }

    case "reply_email": {
      if (!input.thread_id || !input.body) return { result: "Error: thread_id and body required." };
      try {
        // Get original thread to find the recipient
        const { data: original } = await supabase
          .from("email_messages")
          .select("from_email, to_email, subject")
          .eq("thread_id", input.thread_id)
          .order("created_at", { ascending: true })
          .limit(1)
          .single();
        if (!original) return { result: "Thread not found." };

        const replyTo = original.direction === "inbound" ? original.from_email : original.to_email;
        const subject = original.subject?.startsWith("Re: ") ? original.subject : `Re: ${original.subject}`;

        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error: sendErr } = await resend.emails.send({
          from: "JHPS Florida <info@jhpsfl.com>",
          to: [replyTo],
          subject,
          html: input.body,
        });
        if (sendErr) return { result: `Error: ${sendErr.message}` };

        // Log reply
        await supabase.from("email_messages").insert({
          thread_id: input.thread_id,
          direction: "outbound",
          from_email: "info@jhpsfl.com",
          to_email: replyTo,
          subject,
          body_html: input.body,
          body_text: input.body.replace(/<[^>]*>/g, ""),
          read: true,
        });

        return { result: `Reply sent to ${replyTo} on thread ${input.thread_id}.` };
      } catch (err: any) {
        return { result: `Error: ${err.message}` };
      }
    }

    case "update_video_lead": {
      if (!input.lead_id) return { result: "Error: lead_id required." };
      const updates: any = { updated_at: new Date().toISOString() };
      if (input.status) updates.status = input.status;
      if (input.customer_id) updates.customer_id = input.customer_id;
      const { error } = await supabase.from("video_leads").update(updates).eq("id", input.lead_id);
      if (error) return { result: `Error: ${error.message}` };
      return { result: `Video lead updated.` };
    }

    case "navigate": {
      return {
        result: `Navigating to ${input.tab}`,
        action: { type: "navigate", tab: input.tab, description: input.description || `Going to ${input.tab}` },
      };
    }

    default:
      return { result: `Unknown tool: ${name}` };
  }
}

// ═══════════════════════════════════════════
// SYSTEM PROMPT (cached — keep compact)
// ═══════════════════════════════════════════
const SYSTEM_PROMPT = `You are JHPS Assistant for Jenkins Home & Property Solutions (Central Florida lawn/landscaping/property services).

## RULES
- NEVER fabricate database records (customers, quotes, invoices). ALWAYS use tools for database queries.
- You CAN and SHOULD provide estimates, approximations, and educated guesses when asked about lot sizes, property dimensions, pricing ballparks, project scope, material quantities, etc. Use your knowledge of typical FL neighborhoods, lot sizes, and property types. Always label these clearly as estimates (e.g. "I'd estimate roughly..." or "Typical for that area...") and explain your reasoning.
- If someone gives you an address, use your knowledge to estimate lot size, property type, and neighborhood context. Use web_search if you want to verify. Don't refuse just because you can't do a database lookup — give your best estimate with reasoning.
- Be concise. Use **bold** and bullet lists.
- For quotes: DRAFT IN CHAT FIRST. Gather info, present draft with line items and totals, wait for "yes"/"go ahead"/"commit" before creating.
- Navigate user to new records after creating them.
- Confirm before sending emails, quotes, or invoices.

## QUOTE BUILDER FLOW
1. Gather: customer name, service address, services needed, lot size/qty, special conditions
2. Ask in batches of 2-3 questions, conversational
3. Present full draft: line items (qty × price = total), subtotal, exclusions, warranty
4. Wait for confirmation — "Ready to commit?"
5. Only then create_quote + navigate
6. User can request changes — update draft and re-present

## QUOTE RULES
- Use realistic quantities, not 1 for everything
- Appropriate units: visit, sqft, cuyd, each, lot, hour, lnft, flat
- ALWAYS fill: scope_summary, exclusions (3-5), warranty (default 30-day), closing_statement (with phone 407-686-9817)
- Calculate amounts correctly (qty × unit_price)

## NATURAL LANGUAGE TRANSLATION
"add 50% deposit" → set_payment_terms deposit_balance 50%, "make it 3 payments" → deposit_installments, "turn on warranty" → toggle_quote_terms add, "make it commercial" → is_commercial:true, "add financing" → show_financing:true, "set tax 7%" → tax_rate:7, "expires in 2 weeks" → calculate expiration_date

## PRICING (Central FL 2025-26)
Mow: std $45, lg $75, XL $120. Edge $25, hedge $50, full pkg $95. Pressure wash: driveway $150, house $250, patio $125, fence $100, roof $350, full $450. Junk: sm $150, half $275, full $450. Land clear: brush $500/qtr-acre, tree $150-350. Cleanup: general $200, post-construction $400, estate $600. Mulch $50-75/cuyd, rubber $100-150/cuyd. Sod $1.50-3/sqft, rock $75-125/cuyd, border $8-15/lnft, irrigation $75-150/hr.

## TABS
overview, customers, jobs, payments, subscriptions, invoices, quotes, yelp_leads, video_leads, messages, analytics

## TERMS DEFAULTS
ON: Payment Terms, Scope of Work, Cancellation Policy, Property Access, Liability Limitation, Weather Delays, Change Orders
OFF: Material Price Fluctuation, Independent Contractor, Warranty, FL Lien Rights, Dispute Resolution`;

// ═══════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { messages, currentTab, useModel } = await req.json();
    if (!messages?.length) return NextResponse.json({ error: "messages required" }, { status: 400 });

    const claudeKey = process.env.ANTHROPIC_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    if (!claudeKey && !groqKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

    const supabase = createSupabaseAdmin();

    // Load persistent memories
    const { data: memories } = await supabase
      .from("ai_memories")
      .select("content, category")
      .order("category")
      .order("created_at", { ascending: false })
      .limit(50);

    // Build dynamic context (uncached — changes per request)
    const contextParts: string[] = [];

    if (memories?.length) {
      contextParts.push("\n## SAVED MEMORIES");
      const grouped: Record<string, string[]> = {};
      memories.forEach((m: any) => {
        const cat = m.category || "general";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(m.content);
      });
      Object.entries(grouped).forEach(([cat, items]) => {
        contextParts.push(`**${cat}:**`);
        items.forEach(i => contextParts.push(`- ${i}`));
      });
    }

    if (currentTab) contextParts.push(`\nUser is on tab: ${currentTab}`);

    const dynamicContext = contextParts.length ? "\n" + contextParts.join("\n") : "";

    // Model selection
    const preferClaude = useModel !== "groq" && !!claudeKey;
    let content = "";
    const actions: { type: string; tab?: string; created_id?: string; description?: string }[] = [];

    // ── Claude with native tool_use + prompt caching + multi-round loop ──
    if (preferClaude) {
      try {
        const apiMessages = messages.map((m: any) => ({ role: m.role, content: m.content }));

        // System prompt: static cached + dynamic uncached
        const systemBlocks: any[] = [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ];
        if (dynamicContext) {
          systemBlocks.push({ type: "text", text: dynamicContext });
        }

        let claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": claudeKey!, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 4000,
            system: systemBlocks,
            messages: apiMessages,
            tools: TOOLS,
          }),
        });

        if (!claudeRes.ok) {
          console.error("[ai-chat] Claude error:", claudeRes.status, await claudeRes.text());
        } else {
          let claudeData = await claudeRes.json();

          // Tool use loop — execute tools and feed results back (max 5 rounds)
          let rounds = 0;
          while (claudeData.stop_reason === "tool_use" && rounds < 5) {
            rounds++;
            const toolBlocks = claudeData.content.filter((b: any) => b.type === "tool_use");
            const toolResults: any[] = [];
            const assistantContent = claudeData.content;

            for (const tool of toolBlocks) {
              const { result, action } = await executeTool(tool.name, tool.input, supabase);
              if (action) actions.push(action);
              toolResults.push({
                type: "tool_result",
                tool_use_id: tool.id,
                content: result,
              });
            }

            // Continue conversation with tool results
            claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "x-api-key": claudeKey!, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 4000,
                system: systemBlocks,
                messages: [
                  ...apiMessages,
                  { role: "assistant", content: assistantContent },
                  { role: "user", content: toolResults },
                ],
                tools: TOOLS,
              }),
            });

            if (!claudeRes.ok) {
              console.error("[ai-chat] Claude tool loop error:", claudeRes.status);
              break;
            }
            claudeData = await claudeRes.json();
          }

          // Extract final text response
          const textBlocks = claudeData.content?.filter((b: any) => b.type === "text") || [];
          content = textBlocks.map((b: any) => b.text).join("\n");
        }
      } catch (err) {
        console.error("[ai-chat] Claude failed:", err);
      }
    }

    // ── Groq fallback (no native tool_use — simpler prompt) ──
    if (!content && groqKey) {
      const groqPrompt = SYSTEM_PROMPT + dynamicContext + "\n\nNote: You do not have database tools in this mode. Answer from context and general knowledge only. Be clear when you are estimating vs stating facts.";
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: groqPrompt }, ...messages],
            temperature: 0.7,
            max_tokens: 4000,
          }),
        });
        if (!groqRes.ok) {
          const err = await groqRes.text();
          console.error("[ai-chat] Groq error:", groqRes.status, err);
          return NextResponse.json({ error: groqRes.status === 429 ? "Rate limit — wait a few seconds" : "AI service error" }, { status: 502 });
        }
        const d = await groqRes.json();
        content = d.choices?.[0]?.message?.content || "";
      } catch (err: any) {
        console.error("[ai-chat] Groq error:", err);
      }
    }

    if (!content) return NextResponse.json({ error: "No AI service available" }, { status: 502 });

    return NextResponse.json({
      role: "assistant",
      content,
      ...(actions.length > 0 ? { actions } : {}),
    });
  } catch (err: any) {
    console.error("[ai-chat] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
