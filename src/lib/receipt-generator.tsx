/**
 * JHPS Document Generator — Invoice & Receipt PDFs
 * ─────────────────────────────────────────────────────────────
 * Generates professional branded PDFs for:
 *   1. INVOICES — sent before payment (status: DUE / OVERDUE)
 *   2. RECEIPTS — sent after payment (status: PAID)
 *
 * Uses @react-pdf/renderer for React-based PDF generation
 * on the server side (Next.js API routes).
 *
 * USAGE:
 *   import { generateReceiptPDF, generateInvoicePDF } from '@/lib/receipt-generator';
 *   const pdfBuffer = await generateReceiptPDF({ ... });
 *   const invoiceBuffer = await generateInvoicePDF({ ... });
 *
 * DEPENDENCIES:
 *   npm install @react-pdf/renderer
 *
 * FILE LOCATION: src/lib/receipt-generator.tsx
 * ─────────────────────────────────────────────────────────────
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface DocumentLineItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;   // in cents (Square standard)
  totalPrice: number;  // in cents
}

/** Shared fields for both invoices and receipts */
interface BaseDocumentData {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  lineItems: DocumentLineItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  tipAmount?: number;
  totalAmount: number;
  notes?: string;
  orderId?: string;
}

/** Receipt-specific data (post-payment) */
export interface ReceiptData extends BaseDocumentData {
  paymentId: string;
  receiptNumber?: string;  // short human-readable ref e.g. REC-260226-4821
  paymentDate: Date;
  paymentMethod?: string;
  paymentStatus: 'COMPLETED' | 'APPROVED';
}

/** Generate a short human-readable receipt number: REC-YYMMDD-XXXX */
export function generateReceiptNumber(date?: Date): string {
  const d = date || new Date();
  const yy = d.getFullYear().toString().slice(-2);
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `REC-${yy}${mm}${dd}-${rand}`;
}

/** Invoice-specific data (pre-payment) */
export interface InvoiceData extends BaseDocumentData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  invoiceStatus: 'DUE' | 'OVERDUE' | 'SENT';
  paymentLink?: string;
  jobAddress?: string;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'America/New_York',
  }).format(date);
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/New_York',
  }).format(date);
}

function formatFileDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'America/New_York',
  }).format(date).replace(/\//g, '-');
}

// ═══════════════════════════════════════════════════════════════
// BRAND CONSTANTS
// ═══════════════════════════════════════════════════════════════

const BRAND = {
  name: 'Jenkins Home & Property Solutions',
  shortName: 'JHPS',
  phone: '(407) 686-9817',
  email: 'info@jhpsfl.com',
  website: 'www.jhpsfl.com',
  serviceArea: 'Central Florida — Deltona · Orlando · Sanford · DeLand · Daytona Beach',
  tagline: 'Reliable & Insured · Central Florida',
};

const C = {
  primary: '#1B5E20', primaryLight: '#2E7D32', accent: '#F9A825',
  black: '#1A1A1A', dark: '#333333', mid: '#666666', light: '#999999',
  border: '#E0E0E0', bg: '#F5F5F5', white: '#FFFFFF',
  paidGreen: '#2E7D32', paidBg: '#E8F5E9',
  dueBlue: '#1565C0', dueBg: '#E3F2FD',
  overdueRed: '#C62828', overdueBg: '#FFEBEE',
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  page: { backgroundColor: C.white, paddingTop: 40, paddingBottom: 60, paddingHorizontal: 50, fontFamily: 'Helvetica', fontSize: 10, color: C.dark },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 18, borderBottomWidth: 2.5, borderBottomColor: C.primary },
  headerLeft: { flexDirection: 'column', maxWidth: '60%' },
  logo: { width: 160, height: 50, marginBottom: 6, objectFit: 'contain' },
  logoText: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.primary, marginBottom: 1 },
  logoSubtext: { fontSize: 8, color: C.mid, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  companyLine: { fontSize: 8, color: C.light, marginBottom: 1.5 },
  headerRight: { alignItems: 'flex-end' },
  docTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: C.primary, marginBottom: 6, letterSpacing: 1 },
  badgePaid: { backgroundColor: C.paidBg, borderWidth: 1.5, borderColor: C.paidGreen, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 14 },
  badgePaidText: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.paidGreen, letterSpacing: 2 },
  badgeDue: { backgroundColor: C.dueBg, borderWidth: 1.5, borderColor: C.dueBlue, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 14 },
  badgeDueText: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.dueBlue, letterSpacing: 2 },
  badgeOverdue: { backgroundColor: C.overdueBg, borderWidth: 1.5, borderColor: C.overdueRed, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 14 },
  badgeOverdueText: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.overdueRed, letterSpacing: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 },
  metaBlock: { width: '48%' },
  metaLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.light, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  metaVal: { fontSize: 10, color: C.mid, marginBottom: 2 },
  metaValBold: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.black, marginBottom: 2 },
  table: { marginTop: 8, marginBottom: 20 },
  tHead: { flexDirection: 'row', backgroundColor: C.primary, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 4 },
  tHeadText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.white, textTransform: 'uppercase', letterSpacing: 0.5 },
  tRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  tRowAlt: { backgroundColor: C.bg },
  colSvc: { width: '46%' },
  colQty: { width: '10%', textAlign: 'center' },
  colRate: { width: '18%', textAlign: 'right' },
  colTotal: { width: '18%', textAlign: 'right' },
  cell: { fontSize: 10, color: C.mid },
  cellBold: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.black },
  cellDesc: { fontSize: 8, color: C.light, marginTop: 2 },
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  totalsBlock: { width: '46%' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 8 },
  totalsLabel: { fontSize: 10, color: C.light },
  totalsVal: { fontSize: 10, color: C.dark },
  totalsDivider: { borderBottomWidth: 1, borderBottomColor: C.border, marginVertical: 4 },
  grandTotal: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.primary, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 4, marginTop: 4 },
  grandTotalText: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white },
  infoBox: { marginTop: 24, padding: 14, backgroundColor: C.bg, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  infoTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.light, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  infoLabel: { fontSize: 9, color: C.light },
  infoVal: { fontSize: 9, color: C.dark },
  payLinkBox: { marginTop: 20, padding: 16, backgroundColor: C.paidBg, borderRadius: 6, borderWidth: 1.5, borderColor: C.paidGreen, alignItems: 'center' },
  payLinkTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.primary, marginBottom: 6 },
  payLinkUrl: { fontSize: 9, color: C.primaryLight, textDecoration: 'underline' },
  payLinkNote: { fontSize: 8, color: C.mid, marginTop: 6 },
  notes: { marginTop: 20, padding: 12, borderLeftWidth: 3.5, borderLeftColor: C.accent, backgroundColor: '#FFFDE7' },
  notesLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.light, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  notesText: { fontSize: 9, color: C.mid, lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 28, left: 50, right: 50, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, alignItems: 'center' },
  footerLine: { fontSize: 7, color: C.light, textAlign: 'center', marginBottom: 2 },
  footerBrand: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.primary, marginTop: 4 },
});

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════

const CompanyHeader: React.FC<{ logoUrl?: string }> = ({ logoUrl }) => (
  <View style={s.headerLeft}>
    {logoUrl ? (
      <Image src={logoUrl} style={s.logo} />
    ) : (
      <>
        <Text style={s.logoText}>{BRAND.shortName}</Text>
        <Text style={s.logoSubtext}>{BRAND.name}</Text>
      </>
    )}
    <Text style={s.companyLine}>{BRAND.serviceArea}</Text>
    <Text style={s.companyLine}>Phone: {BRAND.phone} · Email: {BRAND.email}</Text>
    <Text style={s.companyLine}>{BRAND.website}</Text>
  </View>
);

const ItemsTable: React.FC<{ items: DocumentLineItem[] }> = ({ items }) => (
  <View style={s.table}>
    <View style={s.tHead}>
      <Text style={[s.tHeadText, s.colSvc]}>Service / Description</Text>
      <Text style={[s.tHeadText, s.colQty]}>Qty</Text>
      <Text style={[s.tHeadText, s.colRate]}>Rate</Text>
      <Text style={[s.tHeadText, s.colTotal]}>Amount</Text>
    </View>
    {items.map((item, i) => (
      <View key={i} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]} wrap={false}>
        <View style={s.colSvc}>
          <Text style={s.cellBold}>{item.name}</Text>
          {item.description && <Text style={s.cellDesc}>{item.description}</Text>}
        </View>
        <Text style={[s.cell, s.colQty]}>{item.quantity}</Text>
        <Text style={[s.cell, s.colRate]}>{fmt(item.unitPrice)}</Text>
        <Text style={[s.cellBold, s.colTotal]}>{fmt(item.totalPrice)}</Text>
      </View>
    ))}
  </View>
);

const TotalsBlock: React.FC<{
  subtotal: number; taxAmount: number; discountAmount?: number;
  tipAmount?: number; totalAmount: number; totalLabel: string;
}> = (p) => (
  <View style={s.totalsWrap} wrap={false}>
    <View style={s.totalsBlock}>
      <View style={s.totalsRow}>
        <Text style={s.totalsLabel}>Subtotal</Text>
        <Text style={s.totalsVal}>{fmt(p.subtotal)}</Text>
      </View>
      {p.taxAmount > 0 && (
        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>Tax</Text>
          <Text style={s.totalsVal}>{fmt(p.taxAmount)}</Text>
        </View>
      )}
      {(p.discountAmount ?? 0) > 0 && (
        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>Discount</Text>
          <Text style={[s.totalsVal, { color: C.paidGreen }]}>−{fmt(p.discountAmount!)}</Text>
        </View>
      )}
      {(p.tipAmount ?? 0) > 0 && (
        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>Tip</Text>
          <Text style={s.totalsVal}>{fmt(p.tipAmount!)}</Text>
        </View>
      )}
      <View style={s.totalsDivider} />
      <View style={s.grandTotal}>
        <Text style={s.grandTotalText}>{p.totalLabel}</Text>
        <Text style={s.grandTotalText}>{fmt(p.totalAmount)}</Text>
      </View>
    </View>
  </View>
);

const NotesSection: React.FC<{ text: string }> = ({ text }) => (
  <View style={s.notes} wrap={false}>
    <Text style={s.notesLabel}>Notes</Text>
    <Text style={s.notesText}>{text}</Text>
  </View>
);

const Footer: React.FC = () => (
  <View style={s.footer} fixed>
    <Text style={s.footerLine}>Thank you for choosing {BRAND.name}!</Text>
    <Text style={s.footerLine}>Questions? Call {BRAND.phone} or email {BRAND.email}</Text>
    <Text style={s.footerLine}>Please keep this document for your records.</Text>
    <Text style={s.footerBrand}>{BRAND.shortName} · {BRAND.tagline}</Text>
  </View>
);

// ═══════════════════════════════════════════════════════════════
// RECEIPT DOCUMENT
// ═══════════════════════════════════════════════════════════════

const ReceiptDoc: React.FC<{ data: ReceiptData; logoUrl?: string }> = ({ data, logoUrl }) => {
  const refNum = data.receiptNumber || data.paymentId.slice(-8).toUpperCase();
  return (
  <Document title={`JHPS Receipt - ${refNum}`} author={BRAND.name} subject="Payment Receipt">
    <Page size="LETTER" style={s.page}>
      <View style={s.header}>
        <CompanyHeader logoUrl={logoUrl} />
        <View style={s.headerRight}>
          <Text style={s.docTitle}>RECEIPT</Text>
          <View style={s.badgePaid}><Text style={s.badgePaidText}>✓ PAID</Text></View>
        </View>
      </View>
      <View style={s.metaRow}>
        <View style={s.metaBlock}>
          <Text style={s.metaLabel}>Bill To</Text>
          <Text style={s.metaValBold}>{data.customerName}</Text>
          <Text style={s.metaVal}>{data.customerEmail}</Text>
          {data.customerPhone && <Text style={s.metaVal}>{data.customerPhone}</Text>}
          {data.customerAddress && <Text style={s.metaVal}>{data.customerAddress}</Text>}
        </View>
        <View style={[s.metaBlock, { alignItems: 'flex-end' }]}>
          <Text style={s.metaLabel}>Receipt Details</Text>
          <Text style={s.metaValBold}>Ref #: {refNum}</Text>
          <Text style={s.metaVal}>Date: {formatDate(data.paymentDate)}</Text>
          {data.orderId && <Text style={s.metaVal}>Order: {data.orderId}</Text>}
        </View>
      </View>
      <ItemsTable items={data.lineItems} />
      <TotalsBlock subtotal={data.subtotal} taxAmount={data.taxAmount} discountAmount={data.discountAmount} tipAmount={data.tipAmount} totalAmount={data.totalAmount} totalLabel="Total Paid" />
      <View style={s.infoBox}>
        <Text style={s.infoTitle}>Payment Information</Text>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Status</Text>
          <Text style={[s.infoVal, { color: C.paidGreen, fontFamily: 'Helvetica-Bold' }]}>{data.paymentStatus}</Text>
        </View>
        {data.paymentMethod && <View style={s.infoRow}><Text style={s.infoLabel}>Method</Text><Text style={s.infoVal}>{data.paymentMethod}</Text></View>}
        <View style={s.infoRow}><Text style={s.infoLabel}>Receipt #</Text><Text style={[s.infoVal, { fontFamily: 'Helvetica-Bold' }]}>{refNum}</Text></View>
        <View style={s.infoRow}><Text style={s.infoLabel}>Date</Text><Text style={s.infoVal}>{formatDate(data.paymentDate)}</Text></View>
        {data.receiptNumber && <View style={s.infoRow}><Text style={[s.infoLabel, { fontSize: 7 }]}>Transaction ID</Text><Text style={[s.infoVal, { fontSize: 7, color: C.light }]}>{data.paymentId}</Text></View>}
      </View>
      {data.notes && <NotesSection text={data.notes} />}
      <Footer />
    </Page>
  </Document>
  );
};

// ═══════════════════════════════════════════════════════════════
// INVOICE DOCUMENT
// ═══════════════════════════════════════════════════════════════

const InvoiceDoc: React.FC<{ data: InvoiceData; logoUrl?: string }> = ({ data, logoUrl }) => {
  const isOverdue = data.invoiceStatus === 'OVERDUE';
  const badge = isOverdue ? s.badgeOverdue : s.badgeDue;
  const badgeText = isOverdue ? s.badgeOverdueText : s.badgeDueText;
  const label = isOverdue ? 'OVERDUE' : 'DUE';
  const color = isOverdue ? C.overdueRed : C.dueBlue;

  return (
    <Document title={`JHPS Invoice - ${data.invoiceNumber}`} author={BRAND.name} subject="Service Invoice">
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <CompanyHeader logoUrl={logoUrl} />
          <View style={s.headerRight}>
            <Text style={s.docTitle}>INVOICE</Text>
            <View style={badge}><Text style={badgeText}>{label}</Text></View>
          </View>
        </View>
        <View style={s.metaRow}>
          <View style={s.metaBlock}>
            <Text style={s.metaLabel}>Bill To</Text>
            <Text style={s.metaValBold}>{data.customerName}</Text>
            <Text style={s.metaVal}>{data.customerEmail}</Text>
            {data.customerPhone && <Text style={s.metaVal}>{data.customerPhone}</Text>}
            {data.customerAddress && <Text style={s.metaVal}>{data.customerAddress}</Text>}
            {data.jobAddress && (
              <>
                <Text style={[s.metaLabel, { marginTop: 8 }]}>Service Location</Text>
                <Text style={s.metaVal}>{data.jobAddress}</Text>
              </>
            )}
          </View>
          <View style={[s.metaBlock, { alignItems: 'flex-end' }]}>
            <Text style={s.metaLabel}>Invoice Details</Text>
            <Text style={s.metaVal}>Invoice #: {data.invoiceNumber}</Text>
            <Text style={s.metaVal}>Issued: {formatDateShort(data.invoiceDate)}</Text>
            {data.dueDate && <Text style={[s.metaValBold, { color, marginTop: 4 }]}>Due: {formatDateShort(data.dueDate)}</Text>}
            {data.orderId && <Text style={s.metaVal}>Order: {data.orderId}</Text>}
          </View>
        </View>
        <ItemsTable items={data.lineItems} />
        <TotalsBlock subtotal={data.subtotal} taxAmount={data.taxAmount} discountAmount={data.discountAmount} totalAmount={data.totalAmount} totalLabel="Amount Due" />
        <View style={s.infoBox} wrap={false}>
          <Text style={s.infoTitle}>Invoice Information</Text>
          <View style={s.infoRow}><Text style={s.infoLabel}>Status</Text><Text style={[s.infoVal, { color, fontFamily: 'Helvetica-Bold' }]}>{data.invoiceStatus}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Invoice Number</Text><Text style={s.infoVal}>{data.invoiceNumber}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Date Issued</Text><Text style={s.infoVal}>{formatDateShort(data.invoiceDate)}</Text></View>
          {data.dueDate && <View style={s.infoRow}><Text style={s.infoLabel}>Payment Due</Text><Text style={[s.infoVal, { color, fontFamily: 'Helvetica-Bold' }]}>{formatDateShort(data.dueDate)}</Text></View>}
        </View>
        {data.notes && <NotesSection text={data.notes} />}
        <Footer />
      </Page>
    </Document>
  );
};

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

export async function generateReceiptPDF(data: ReceiptData, logoUrl?: string): Promise<Buffer> {
  const buf = await renderToBuffer(<ReceiptDoc data={data} logoUrl={logoUrl} />);
  return Buffer.from(buf);
}

export async function generateInvoicePDF(data: InvoiceData, logoUrl?: string): Promise<Buffer> {
  const buf = await renderToBuffer(<InvoiceDoc data={data} logoUrl={logoUrl} />);
  return Buffer.from(buf);
}

export function getReceiptFilename(data: ReceiptData): string {
  return `JHPS-Receipt-${formatFileDate(data.paymentDate)}-${data.paymentId.slice(-8)}.pdf`;
}

export function getInvoiceFilename(data: InvoiceData): string {
  return `JHPS-Invoice-${data.invoiceNumber}.pdf`;
}
