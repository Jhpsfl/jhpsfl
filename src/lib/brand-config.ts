/**
 * JHPS Multi-Brand Configuration
 * ─────────────────────────────────────────────────────────────
 * Central source of truth for brand theming across:
 *   - Invoice creation form (admin)
 *   - Payment page (/pay)
 *   - PDF generation (invoices & receipts)
 *   - Email templates
 *
 * Currently supports:
 *   - jhps: Jenkins Home & Property Solutions (default)
 *   - nexa: NexaVision Group (secondary division)
 *
 * Both brands share the same Square payment credentials,
 * Supabase database, and admin dashboard. Only customer-facing
 * presentation changes.
 * ─────────────────────────────────────────────────────────────
 */

export type BrandKey = 'jhps' | 'nexa';

export interface BrandColors {
  /** Deepest page background */
  bg: string;
  /** Slightly elevated surface */
  bgElevated: string;
  /** Card / panel surface */
  bgCard: string;
  /** Primary accent (buttons, highlights) */
  primary: string;
  /** Darker shade of primary */
  primaryDark: string;
  /** Lighter shade of primary */
  primaryLight: string;
  /** Secondary accent */
  secondary: string;
  /** Highlight / warm accent */
  highlight: string;
  /** Primary text */
  textPrimary: string;
  /** Secondary / muted text */
  textSecondary: string;
  /** Very muted text */
  textMuted: string;
  /** Border default */
  border: string;
  /** Border on hover */
  borderHover: string;
  /** Glow shadow color (rgba) */
  glow: string;
}

export interface BrandFonts {
  /** Display / headline font */
  display: string;
  /** Body text font */
  body: string;
  /** Monospace font */
  mono: string;
  /** Google Fonts import URL for customer-facing pages */
  googleImport: string;
}

export interface BrandConfig {
  key: BrandKey;
  /** Full company name */
  name: string;
  /** Short display name */
  shortName: string;
  /** Phone number */
  phone: string;
  /** Contact email */
  email: string;
  /** Website (no https://) */
  website: string;
  /** Service area tagline */
  serviceArea: string;
  /** Tagline / subtitle */
  tagline: string;
  /** Path to logo in /public */
  logo: string;
  /** Brand color palette */
  colors: BrandColors;
  /** Brand typography */
  fonts: BrandFonts;
  /** Square card input styling (passed to Square SDK) */
  squareCardStyle: {
    '.input-container': Record<string, string>;
    '.input-container.is-focus': Record<string, string>;
    '.input-container.is-error': Record<string, string>;
    input: Record<string, string>;
    'input::placeholder': Record<string, string>;
  };
  /** PDF-specific colors */
  pdfColors: {
    primary: string;
    primaryLight: string;
    accent: string;
  };
}

// ═══════════════════════════════════════════════════════════════
// JHPS — Jenkins Home & Property Solutions
// ═══════════════════════════════════════════════════════════════

const jhps: BrandConfig = {
  key: 'jhps',
  name: 'Jenkins Home & Property Solutions',
  shortName: 'JHPS',
  phone: '(407) 686-9817',
  email: 'info@jhpsfl.com',
  website: 'www.jhpsfl.com',
  serviceArea: 'Central Florida — Deltona · Orlando · Sanford · DeLand · Daytona Beach',
  tagline: 'Reliable & Insured · Central Florida',
  logo: '/jhps-nav-logo.svg',
  colors: {
    bg: '#050e05',
    bgElevated: '#0d1f0d',
    bgCard: '#0a160a',
    primary: '#4CAF50',
    primaryDark: '#2E7D32',
    primaryLight: '#81C784',
    secondary: '#1565C0',
    highlight: '#ffd700',
    textPrimary: '#e8f5e8',
    textSecondary: '#8aba8a',
    textMuted: '#5a8a5a',
    border: '#1a3a1a',
    borderHover: 'rgba(76,175,80,0.4)',
    glow: 'rgba(76,175,80,0.35)',
  },
  fonts: {
    display: "'Playfair Display', serif",
    body: "'DM Sans', sans-serif",
    mono: "'JetBrains Mono', monospace",
    googleImport: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  },
  squareCardStyle: {
    '.input-container': {
      borderColor: '#1a3a1a',
      borderRadius: '12px',
    },
    '.input-container.is-focus': {
      borderColor: '#4CAF50',
    },
    '.input-container.is-error': {
      borderColor: '#ef5350',
    },
    input: {
      backgroundColor: '#0d1a0d',
      color: '#e8f5e8',
    },
    'input::placeholder': {
      color: '#3a5a3a',
    },
  },
  pdfColors: {
    primary: '#1B5E20',
    primaryLight: '#2E7D32',
    accent: '#F9A825',
  },
};

// ═══════════════════════════════════════════════════════════════
// NEXA — NexaVision Group
// ═══════════════════════════════════════════════════════════════

const nexa: BrandConfig = {
  key: 'nexa',
  name: 'NexaVision Group',
  shortName: 'Nexa',
  phone: '(864) 301-1806',
  email: 'info@nexavisiongroup.com',
  website: 'www.nexavisiongroup.com',
  serviceArea: 'Central Florida & Beyond',
  tagline: 'Revenue Infrastructure · Digital Solutions',
  logo: '/nexa-logo.svg',
  colors: {
    bg: '#0A1628',
    bgElevated: '#0F1D32',
    bgCard: '#162238',
    primary: '#00E5CC',
    primaryDark: '#009E8F',
    primaryLight: '#33FFD8',
    secondary: '#7B5EA7',
    highlight: '#FF6B35',
    textPrimary: '#F0F4F8',
    textSecondary: '#8896A6',
    textMuted: '#5A6A7E',
    border: 'rgba(255,255,255,0.06)',
    borderHover: 'rgba(0,229,204,0.3)',
    glow: 'rgba(0,229,204,0.2)',
  },
  fonts: {
    display: "'Outfit', sans-serif",
    body: "'Space Grotesk', sans-serif",
    mono: "'JetBrains Mono', monospace",
    googleImport: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  },
  squareCardStyle: {
    '.input-container': {
      borderColor: 'rgba(255,255,255,0.06)',
      borderRadius: '12px',
    },
    '.input-container.is-focus': {
      borderColor: '#00E5CC',
    },
    '.input-container.is-error': {
      borderColor: '#EF4444',
    },
    input: {
      backgroundColor: '#0F1D32',
      color: '#F0F4F8',
    },
    'input::placeholder': {
      color: '#5A6A7E',
    },
  },
  pdfColors: {
    primary: '#008577',
    primaryLight: '#00A99D',
    accent: '#FF6B35',
  },
};

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export const BRANDS: Record<BrandKey, BrandConfig> = { jhps, nexa };

/** Get a brand config by key. Falls back to JHPS if invalid key. */
export function getBrand(key: string | null | undefined): BrandConfig {
  if (key && key in BRANDS) return BRANDS[key as BrandKey];
  return BRANDS.jhps;
}

/** All brand keys */
export const BRAND_KEYS: BrandKey[] = ['jhps', 'nexa'];

/** Default brand */
export const DEFAULT_BRAND: BrandKey = 'jhps';
