import type { PaymentTerms, PaymentTermsType, PaymentScheduleItem } from "./invoiceTypes";

// ─── Predefined Services ───
export const SERVICE_PRESETS: { category: string; items: { description: string; unit_price: number }[] }[] = [
  {
    category: "Lawn Care",
    items: [
      { description: "Standard Lawn Mowing (up to 1/4 acre)", unit_price: 45 },
      { description: "Large Lawn Mowing (1/4 - 1/2 acre)", unit_price: 75 },
      { description: "XL Lawn Mowing (1/2 - 1 acre)", unit_price: 120 },
      { description: "Edging & Trimming", unit_price: 25 },
      { description: "Leaf Blowing / Cleanup", unit_price: 35 },
      { description: "Hedge Trimming", unit_price: 50 },
      { description: "Full Lawn Service Package", unit_price: 95 },
    ],
  },
  {
    category: "Pressure Washing",
    items: [
      { description: "Driveway Pressure Wash", unit_price: 150 },
      { description: "House Exterior Soft Wash", unit_price: 250 },
      { description: "Patio / Pool Deck Wash", unit_price: 125 },
      { description: "Fence Pressure Wash", unit_price: 100 },
      { description: "Roof Soft Wash", unit_price: 350 },
      { description: "Sidewalk / Walkway Wash", unit_price: 75 },
      { description: "Full Property Wash Package", unit_price: 450 },
    ],
  },
  {
    category: "Junk Removal",
    items: [
      { description: "Small Load (pickup truck)", unit_price: 150 },
      { description: "Half Load (dump trailer)", unit_price: 275 },
      { description: "Full Load (dump trailer)", unit_price: 450 },
      { description: "Appliance Removal (each)", unit_price: 75 },
      { description: "Furniture Removal (each)", unit_price: 50 },
      { description: "Yard Debris Removal", unit_price: 200 },
    ],
  },
  {
    category: "Land Clearing",
    items: [
      { description: "Brush Clearing (per 1/4 acre)", unit_price: 500 },
      { description: "Small Tree Removal (under 6\")", unit_price: 150 },
      { description: "Medium Tree Removal (6-12\")", unit_price: 350 },
      { description: "Stump Grinding (per stump)", unit_price: 100 },
      { description: "Lot Clearing (full)", unit_price: 1500 },
    ],
  },
  {
    category: "Property Cleanup",
    items: [
      { description: "General Property Cleanup", unit_price: 200 },
      { description: "Post-Construction Cleanup", unit_price: 400 },
      { description: "Foreclosure / Estate Cleanout", unit_price: 600 },
      { description: "Storm Damage Cleanup", unit_price: 300 },
    ],
  },
];

// ─── Helpers ───
export function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${y}${m}-${rand}`;
}

export function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function getDefaultDueDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function createLineItemId(): string {
  return `li_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

export function createScheduleItemId(): string {
  return `si_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

// ─── Payment Schedule Generation ───

/**
 * Generates the default PaymentTerms object for a given type & total.
 */
export function createDefaultPaymentTerms(type: PaymentTermsType, total: number): PaymentTerms {
  if (type === "full") {
    return {
      type: "full",
      deposit_amount: 0,
      deposit_percentage: 0,
      deposit_method: "percentage",
      num_installments: 0,
      installment_frequency: "monthly",
      balance_due_on: "completion",
      schedule: [],
    };
  }

  // Default 50% deposit
  const depositPct = 50;
  const depositAmt = Math.round((total * depositPct) / 100 * 100) / 100;
  const balance = Math.round((total - depositAmt) * 100) / 100;

  if (type === "deposit_balance") {
    return {
      type: "deposit_balance",
      deposit_amount: depositAmt,
      deposit_percentage: depositPct,
      deposit_method: "percentage",
      num_installments: 0,
      installment_frequency: "monthly",
      balance_due_on: "completion",
      schedule: [
        {
          id: createScheduleItemId(),
          label: "Deposit",
          amount: depositAmt,
          due_date: new Date().toISOString().split("T")[0],
          status: "pending",
          paid_date: null,
          paid_amount: 0,
          payment_method: null,
          notes: null,
        },
        {
          id: createScheduleItemId(),
          label: "Balance Due at Completion",
          amount: balance,
          due_date: null,
          status: "pending",
          paid_date: null,
          paid_amount: 0,
          payment_method: null,
          notes: null,
        },
      ],
    };
  }

  // deposit_installments — default 3 installments, monthly
  const numInstallments = 3;
  const installmentAmt = Math.round((balance / numInstallments) * 100) / 100;
  // Fix rounding — last installment absorbs remainder
  const installments: PaymentScheduleItem[] = [];

  const depositItem: PaymentScheduleItem = {
    id: createScheduleItemId(),
    label: "Deposit",
    amount: depositAmt,
    due_date: new Date().toISOString().split("T")[0],
    status: "pending",
    paid_date: null,
    paid_amount: 0,
    payment_method: null,
    notes: null,
  };
  installments.push(depositItem);

  let runningTotal = depositAmt;
  for (let i = 1; i <= numInstallments; i++) {
    const isLast = i === numInstallments;
    const amt = isLast ? Math.round((total - runningTotal) * 100) / 100 : installmentAmt;
    runningTotal += amt;
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + i);

    installments.push({
      id: createScheduleItemId(),
      label: `Installment ${i} of ${numInstallments}`,
      amount: amt,
      due_date: dueDate.toISOString().split("T")[0],
      status: "pending",
      paid_date: null,
      paid_amount: 0,
      payment_method: null,
      notes: null,
    });
  }

  return {
    type: "deposit_installments",
    deposit_amount: depositAmt,
    deposit_percentage: depositPct,
    deposit_method: "percentage",
    num_installments: numInstallments,
    installment_frequency: "monthly",
    balance_due_on: "completion",
    schedule: installments,
  };
}

/**
 * Regenerate the schedule items when deposit/installment params change.
 */
export function regenerateSchedule(terms: PaymentTerms, total: number): PaymentScheduleItem[] {
  const depositAmt = terms.deposit_amount;
  const balance = Math.round((total - depositAmt) * 100) / 100;

  if (terms.type === "deposit_balance") {
    return [
      {
        id: createScheduleItemId(),
        label: "Deposit",
        amount: depositAmt,
        due_date: new Date().toISOString().split("T")[0],
        status: "pending",
        paid_date: null,
        paid_amount: 0,
        payment_method: null,
        notes: null,
      },
      {
        id: createScheduleItemId(),
        label: terms.balance_due_on === "completion" ? "Balance Due at Completion" : "Balance Due",
        amount: balance,
        due_date: terms.balance_due_on === "date" ? terms.schedule[1]?.due_date || null : null,
        status: "pending",
        paid_date: null,
        paid_amount: 0,
        payment_method: null,
        notes: null,
      },
    ];
  }

  if (terms.type === "deposit_installments") {
    const n = terms.num_installments || 3;
    const installmentAmt = Math.round((balance / n) * 100) / 100;
    const items: PaymentScheduleItem[] = [
      {
        id: createScheduleItemId(),
        label: "Deposit",
        amount: depositAmt,
        due_date: new Date().toISOString().split("T")[0],
        status: "pending",
        paid_date: null,
        paid_amount: 0,
        payment_method: null,
        notes: null,
      },
    ];

    let runningTotal = depositAmt;
    const freqDays = terms.installment_frequency === "weekly" ? 7 : terms.installment_frequency === "biweekly" ? 14 : 30;
    for (let i = 1; i <= n; i++) {
      const isLast = i === n;
      const amt = isLast ? Math.round((total - runningTotal) * 100) / 100 : installmentAmt;
      runningTotal += amt;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (freqDays * i));

      items.push({
        id: createScheduleItemId(),
        label: `Installment ${i} of ${n}`,
        amount: amt,
        due_date: dueDate.toISOString().split("T")[0],
        status: "pending",
        paid_date: null,
        paid_amount: 0,
        payment_method: null,
        notes: null,
      });
    }
    return items;
  }

  return [];
}

// ─── Legal Disclaimers ───

export const LEGAL_DISCLAIMERS: Record<PaymentTermsType, string> = {
  full: "",
  deposit_balance:
    `DEPOSIT & PAYMENT TERMS: The deposit amount listed above is non-refundable and secures your scheduled service date. The remaining balance is due in full upon completion of work unless otherwise agreed in writing. Failure to remit the balance within 7 days of job completion may result in late fees of 1.5% per month on the unpaid amount. Jenkins Home & Property Solutions reserves the right to suspend or cancel services if payment is not received as agreed.`,
  deposit_installments:
    `INSTALLMENT PLAN TERMS: The deposit amount listed above is non-refundable and secures your scheduled service date. The remaining balance will be paid in the installments shown above according to the due dates listed. All installment payments are due on or before their scheduled dates. Late payments may incur a fee of 1.5% per month on the overdue amount. If any installment is more than 14 days past due, the full remaining balance becomes immediately due and payable. Jenkins Home & Property Solutions reserves the right to suspend ongoing services until the account is current.`,
};

/**
 * Returns the appropriate legal disclaimer for the payment terms type.
 */
export function getDisclaimer(type: PaymentTermsType): string {
  return LEGAL_DISCLAIMERS[type] || "";
}

// ─── Payment Progress Helpers ───

export function getPaymentProgress(terms: PaymentTerms | null | undefined): {
  totalPaid: number;
  totalDue: number;
  nextPayment: PaymentScheduleItem | null;
  percentPaid: number;
  isFullyPaid: boolean;
} {
  if (!terms || terms.type === "full" || !terms.schedule.length) {
    return { totalPaid: 0, totalDue: 0, nextPayment: null, percentPaid: 0, isFullyPaid: false };
  }

  const totalDue = terms.schedule.reduce((s, i) => s + i.amount, 0);
  const totalPaid = terms.schedule.reduce((s, i) => s + i.paid_amount, 0);
  const nextPayment = terms.schedule.find(i => i.status !== "paid") || null;
  const percentPaid = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

  return {
    totalPaid,
    totalDue,
    nextPayment,
    percentPaid,
    isFullyPaid: percentPaid >= 100,
  };
}
