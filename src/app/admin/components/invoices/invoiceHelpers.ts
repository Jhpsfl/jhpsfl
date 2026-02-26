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
