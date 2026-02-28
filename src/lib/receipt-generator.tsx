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
  /** When present, the invoice becomes a multi-page Service Contract */
  paymentTerms?: {
    type: string;
    deposit_amount: number;
    schedule: { label: string; amount: number; due_date: string | null; status?: string }[];
  } | null;
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
  page: { backgroundColor: C.white, paddingTop: 75, paddingBottom: 60, paddingHorizontal: 50, fontFamily: 'Helvetica', fontSize: 10, color: C.dark },
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

/** Table column header row — used inline on page 1 and in the fixed continuation bar */
const TableColumnHeaders: React.FC = () => (
  <View style={s.tHead}>
    <Text style={[s.tHeadText, s.colSvc]}>Service / Description</Text>
    <Text style={[s.tHeadText, s.colQty]}>Qty</Text>
    <Text style={[s.tHeadText, s.colRate]}>Rate</Text>
    <Text style={[s.tHeadText, s.colTotal]}>Amount</Text>
  </View>
);

/** Fixed continuation bar — repeats at the top of every page */
const ContinuationHeader: React.FC<{ docType: string; docNumber: string }> = ({ docType, docNumber }) => (
  <View fixed style={{
    position: 'absolute', top: 12, left: 50, right: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: C.primary,
  }}>
    <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.primary, letterSpacing: 1 }}>
      {BRAND.shortName}
    </Text>
    <Text style={{ fontSize: 8, color: C.mid }}>
      {docType} #{docNumber}
    </Text>
  </View>
);

/**
 * Items table — renders rows individually so @react-pdf can break between
 * any two rows instead of treating the whole table as one block.
 * The column header is rendered inline (page 1) and also appears in the
 * fixed ContinuationHeader on subsequent pages.
 */
const ItemsTable: React.FC<{ items: DocumentLineItem[] }> = ({ items }) => (
  <>
    <View style={{ marginTop: 8 }}>
      <TableColumnHeaders />
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
    <View style={{ marginBottom: 20 }} />
  </>
);

const TotalsBlock: React.FC<{
  subtotal: number; taxAmount: number; discountAmount?: number;
  tipAmount?: number; totalAmount: number; totalLabel: string;
  depositAmount?: number; balanceAmount?: number;
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
      {(p.depositAmount ?? 0) > 0 && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#E8F5E9', borderRadius: 3, marginTop: 6 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#2E7D32' }}>Deposit Due</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#2E7D32' }}>{fmt(Math.round(p.depositAmount! * 100))}</Text>
          </View>
          {(p.balanceAmount ?? 0) > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 4, marginTop: 2 }}>
              <Text style={{ fontSize: 9, color: '#4A5568' }}>Remaining Balance</Text>
              <Text style={{ fontSize: 9, color: '#4A5568' }}>{fmt(Math.round(p.balanceAmount! * 100))}</Text>
            </View>
          )}
        </>
      )}
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
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
      <Text style={s.footerBrand}>{BRAND.shortName} · {BRAND.tagline}</Text>
      <Text style={{ fontSize: 7, color: C.light }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
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
      <ContinuationHeader docType="RECEIPT" docNumber={refNum} />
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

// ═══════════════════════════════════════════════════════════════
// FLORIDA SERVICE CONTRACT — LEGAL TERMS (Ch. 713, Ch. 682)
// ═══════════════════════════════════════════════════════════════

const LEGAL_SECTIONS = [
  {
    title: '1. PAYMENT TERMS & SCHEDULE',
    text: 'Customer agrees to make payments in accordance with the Payment Schedule set forth on Page 1 of this Service Contract. All payments are due on or before their scheduled due dates. Payments may be made via credit/debit card, cash, check, Zelle, or Venmo. The deposit is NON-REFUNDABLE and secures the Customer\'s scheduled service date. Work will not commence until the deposit has been received and cleared.',
  },
  {
    title: '2. LATE PAYMENT & ACCELERATION',
    text: 'A late fee of Fifty Dollars ($50.00) shall be assessed on any payment not received within seven (7) calendar days of its scheduled due date. In addition, interest of 1.5% per month (18% annual percentage rate) shall accrue on any unpaid balance beginning on the eighth (8th) day after the due date. If any payment is more than fourteen (14) calendar days past due, the entire remaining unpaid balance shall become immediately due and payable in full ("Acceleration"). The Company reserves the right to suspend or halt all work on the project if any payment is more than seven (7) days past due, and to resume only upon full cure of the delinquency including payment of all accrued late fees and interest.',
  },
  {
    title: '3. CONSTRUCTION LIEN RIGHTS — FLORIDA STATUTE CH. 713',
    text: 'UNDER FLORIDA\'S CONSTRUCTION LIEN LAW (SECTIONS 713.001–713.37, FLORIDA STATUTES), THOSE WHO WORK ON YOUR PROPERTY OR PROVIDE MATERIALS AND SERVICES AND ARE NOT PAID IN FULL HAVE A RIGHT TO ENFORCE THEIR CLAIM FOR PAYMENT AGAINST YOUR PROPERTY. THIS CLAIM IS KNOWN AS A CONSTRUCTION LIEN. The Company expressly reserves all lien rights available under Florida Statute Chapter 713. In the event Customer fails to make any payment required under this Contract, the Company may record a Claim of Lien against the real property where services were performed within ninety (90) days of the last day the Company furnished labor, services, or materials, and may take all actions permitted under Florida law to enforce such lien, including but not limited to foreclosure proceedings. Customer acknowledges that failure to pay may result in a lien being filed against the property, which could result in the forced sale of the property to satisfy amounts owed.',
  },
  {
    title: '4. AUTHORIZATION TO PERFORM WORK',
    text: 'By executing this Contract, Customer authorizes the Company to perform the services described in the Scope of Work at the specified service location. Customer represents and warrants that they are the owner of the property or are duly authorized by the property owner to approve the work described herein. Customer agrees to provide reasonable access to the property as needed for the Company to perform the work.',
  },
  {
    title: '5. CHANGES TO SCOPE OF WORK',
    text: 'Any changes, additions, or modifications to the scope of work described in this Contract must be agreed upon in writing by both parties before such additional work is performed. Additional work beyond the original scope will result in additional charges, which will be documented in a written Change Order signed by both parties. The Company is not obligated to perform work beyond the scope described herein without a signed Change Order.',
  },
  {
    title: '6. WARRANTY & LIMITATION OF LIABILITY',
    text: 'The Company warrants its workmanship for a period of thirty (30) days from the date of completion. This warranty does not cover damage caused by weather events, neglect, misuse, third-party actions, or acts of God. THE COMPANY\'S TOTAL LIABILITY UNDER THIS CONTRACT SHALL NOT EXCEED THE TOTAL CONTRACT PRICE. IN NO EVENT SHALL THE COMPANY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. The Company is not liable for any pre-existing conditions, concealed defects, or damage not caused by the Company\'s work.',
  },
  {
    title: '7. RIGHT TO CURE',
    text: 'Before pursuing any legal remedy for alleged defective work, Customer shall provide the Company with written notice describing the alleged deficiency and a reasonable opportunity to cure, which shall be no less than fifteen (15) business days from receipt of written notice. This provision is consistent with Florida\'s right-to-cure requirements for residential construction contracts.',
  },
  {
    title: '8. CANCELLATION & TERMINATION',
    text: 'Customer may cancel this Contract within three (3) business days of execution for a full refund of the deposit, minus any costs already incurred by the Company (Florida Home Solicitation Sales Act, if applicable). After three (3) business days, the deposit is non-refundable. If Customer cancels after work has commenced, Customer is responsible for payment for all work completed to date, all materials purchased or ordered, and any restocking or cancellation fees incurred by the Company. Either party may terminate this Contract for cause upon fourteen (14) days\' written notice if the other party has materially breached this Contract and failed to cure such breach within the notice period.',
  },
  {
    title: '9. DISPUTE RESOLUTION & ARBITRATION',
    text: 'Any dispute, claim, or controversy arising out of or relating to this Contract or the breach thereof shall first be addressed through good-faith negotiation between the parties. If the dispute cannot be resolved through negotiation within thirty (30) days, it shall be submitted to binding arbitration in Volusia County, Florida, administered by the American Arbitration Association (AAA) in accordance with its Commercial Arbitration Rules then in effect, pursuant to Florida\'s Revised Arbitration Code (Chapter 682, Florida Statutes). The arbitrator shall be empowered to award reasonable attorneys\' fees and costs to the prevailing party. Judgment on the award rendered by the arbitrator may be entered in any court having jurisdiction thereof. THE PARTIES ACKNOWLEDGE THAT BY AGREEING TO ARBITRATION, THEY ARE WAIVING THEIR RIGHT TO A JURY TRIAL.',
  },
  {
    title: '10. INDEMNIFICATION',
    text: 'Customer agrees to indemnify, defend, and hold harmless the Company, its officers, employees, and agents from and against any and all claims, damages, losses, and expenses (including reasonable attorneys\' fees) arising out of or resulting from: (a) Customer\'s breach of this Contract; (b) Customer\'s negligent or wrongful acts or omissions; (c) any inaccuracy in Customer\'s representations under this Contract; or (d) any claim by a third party related to Customer\'s use of or access to the property.',
  },
  {
    title: '11. INSURANCE & PERMITS',
    text: 'The Company maintains general liability insurance and workers\' compensation coverage as required by Florida law. If permits are required for the work described herein, the party responsible for obtaining such permits shall be identified in the Scope of Work. Unless otherwise agreed in writing, the Company shall obtain all necessary permits at Customer\'s expense.',
  },
  {
    title: '12. GOVERNING LAW & VENUE',
    text: 'This Contract shall be governed by and construed in accordance with the laws of the State of Florida, without regard to conflict of laws principles. Any legal proceedings not subject to the arbitration clause shall be brought exclusively in the courts of Volusia County, Florida.',
  },
  {
    title: '13. ENTIRE AGREEMENT & SEVERABILITY',
    text: 'This Contract, together with any Change Orders, constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, and agreements. If any provision of this Contract is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect. No modification of this Contract shall be binding unless in writing and signed by both parties.',
  },
  {
    title: '14. ELECTRONIC SIGNATURE & ACCEPTANCE',
    text: 'The parties agree that electronic signatures are valid and enforceable under the Florida Uniform Electronic Transactions Act (UETA) and the federal Electronic Signatures in Global and National Commerce Act (E-SIGN). By signing this Contract electronically or making the deposit payment, Customer acknowledges that they have read, understand, and agree to all terms and conditions herein.',
  },
];

/** Legal terms pages — rendered as Page 2+ of the contract */
const LegalTermsPages: React.FC<{ docNumber: string }> = ({ docNumber }) => (
  <Page size="LETTER" style={s.page}>
    <ContinuationHeader docType="CONTRACT" docNumber={docNumber} />
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.primary, marginBottom: 4 }}>
        TERMS & CONDITIONS
      </Text>
      <Text style={{ fontSize: 8, color: C.light }}>
        Jenkins Home & Property Solutions, LLC — Service Contract {docNumber}
      </Text>
    </View>
    {LEGAL_SECTIONS.map((section, i) => (
      <View key={i} style={{ marginBottom: 10 }} wrap={false}>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.black, marginBottom: 3 }}>
          {section.title}
        </Text>
        <Text style={{ fontSize: 8, color: C.mid, lineHeight: 1.6 }}>
          {section.text}
        </Text>
      </View>
    ))}
    <View style={{ marginTop: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }} wrap={false}>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.black, marginBottom: 6 }}>
        ACKNOWLEDGMENT & ACCEPTANCE
      </Text>
      <Text style={{ fontSize: 8, color: C.mid, lineHeight: 1.6, marginBottom: 16 }}>
        By signing below or making the initial deposit payment, Customer acknowledges receipt of this
        Service Contract, has read all terms and conditions, and agrees to be bound by them.
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <View style={{ width: '48%' }}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: C.black, marginBottom: 4, height: 30 }} />
          <Text style={{ fontSize: 8, color: C.light }}>Customer Signature</Text>
          <View style={{ borderBottomWidth: 1, borderBottomColor: C.black, marginBottom: 4, height: 24, marginTop: 12 }} />
          <Text style={{ fontSize: 8, color: C.light }}>Printed Name</Text>
        </View>
        <View style={{ width: '48%' }}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: C.black, marginBottom: 4, height: 30 }} />
          <Text style={{ fontSize: 8, color: C.light }}>Date</Text>
          <View style={{ borderBottomWidth: 1, borderBottomColor: C.black, marginBottom: 4, height: 24, marginTop: 12 }} />
          <Text style={{ fontSize: 8, color: C.light }}>Service Property Address</Text>
        </View>
      </View>
    </View>
    <Footer />
  </Page>
);

// ═══════════════════════════════════════════════════════════════
// INVOICE / SERVICE CONTRACT DOCUMENT
// ═══════════════════════════════════════════════════════════════

const InvoiceDoc: React.FC<{ data: InvoiceData; logoUrl?: string }> = ({ data, logoUrl }) => {
  const isOverdue = data.invoiceStatus === 'OVERDUE';
  const badge = isOverdue ? s.badgeOverdue : s.badgeDue;
  const badgeText = isOverdue ? s.badgeOverdueText : s.badgeDueText;
  const label = isOverdue ? 'OVERDUE' : 'DUE';
  const color = isOverdue ? C.overdueRed : C.dueBlue;

  const hasPaymentTerms = data.paymentTerms && data.paymentTerms.type !== 'full' && data.paymentTerms.schedule?.length > 0;
  const docType = hasPaymentTerms ? 'SERVICE CONTRACT' : 'INVOICE';
  const docTypeShort = hasPaymentTerms ? 'CONTRACT' : 'INVOICE';

  return (
    <Document title={`JHPS ${docType} - ${data.invoiceNumber}`} author={BRAND.name} subject={docType}>
      <Page size="LETTER" style={s.page}>
        <ContinuationHeader docType={docTypeShort} docNumber={data.invoiceNumber} />
        <View style={s.header}>
          <CompanyHeader logoUrl={logoUrl} />
          <View style={s.headerRight}>
            <Text style={s.docTitle}>{docType}</Text>
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
            <Text style={s.metaLabel}>{hasPaymentTerms ? 'Contract Details' : 'Invoice Details'}</Text>
            <Text style={s.metaVal}>{hasPaymentTerms ? 'Contract' : 'Invoice'} #: {data.invoiceNumber}</Text>
            <Text style={s.metaVal}>Issued: {formatDateShort(data.invoiceDate)}</Text>
            {data.dueDate && <Text style={[s.metaValBold, { color, marginTop: 4 }]}>Due: {formatDateShort(data.dueDate)}</Text>}
            {data.orderId && <Text style={s.metaVal}>Order: {data.orderId}</Text>}
          </View>
        </View>

        {/* Scope of Work */}
        {hasPaymentTerms && (
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.light, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Scope of Work
            </Text>
          </View>
        )}
        <ItemsTable items={data.lineItems} />
        <TotalsBlock
          subtotal={data.subtotal}
          taxAmount={data.taxAmount}
          discountAmount={data.discountAmount}
          totalAmount={data.totalAmount}
          totalLabel={hasPaymentTerms ? 'Total Contract Price' : 'Amount Due'}
          depositAmount={hasPaymentTerms ? data.paymentTerms!.deposit_amount : undefined}
          balanceAmount={hasPaymentTerms ? (data.totalAmount / 100) - data.paymentTerms!.deposit_amount : undefined}
        />

        {/* Regular invoice: everything stays on one page */}
        {!hasPaymentTerms && (
          <>
            <View style={s.infoBox} wrap={false}>
              <Text style={s.infoTitle}>Invoice Information</Text>
              <View style={s.infoRow}><Text style={s.infoLabel}>Status</Text><Text style={[s.infoVal, { color, fontFamily: 'Helvetica-Bold' }]}>{data.invoiceStatus}</Text></View>
              <View style={s.infoRow}><Text style={s.infoLabel}>Invoice Number</Text><Text style={s.infoVal}>{data.invoiceNumber}</Text></View>
              <View style={s.infoRow}><Text style={s.infoLabel}>Date Issued</Text><Text style={s.infoVal}>{formatDateShort(data.invoiceDate)}</Text></View>
              {data.dueDate && <View style={s.infoRow}><Text style={s.infoLabel}>Payment Due</Text><Text style={[s.infoVal, { color, fontFamily: 'Helvetica-Bold' }]}>{formatDateShort(data.dueDate)}</Text></View>}
            </View>
            {data.paymentLink && (
              <View style={s.payLinkBox} wrap={false}>
                <Text style={s.payLinkTitle}>Pay Online</Text>
                <Text style={s.payLinkUrl}>{data.paymentLink}</Text>
                <Text style={s.payLinkNote}>Click or copy the link above to make a secure payment.</Text>
              </View>
            )}
            {data.notes && <NotesSection text={data.notes} />}
          </>
        )}

        <Footer />
      </Page>

      {/* ══════ CONTRACT PAGE 2: Payment Schedule + Info + Lien Notice ══════ */}
      {hasPaymentTerms && data.paymentTerms && (
        <Page size="LETTER" style={s.page}>
          <ContinuationHeader docType="CONTRACT" docNumber={data.invoiceNumber} />

          {/* Payment Schedule table */}
          <View style={{ marginTop: 4 }}>
            <View style={{ backgroundColor: '#1E3A5F', paddingVertical: 8, paddingHorizontal: 12, borderTopLeftRadius: 4, borderTopRightRadius: 4 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' }}>PAYMENT SCHEDULE</Text>
            </View>
            <View style={{ borderWidth: 1, borderColor: '#CBD5E0', borderTopWidth: 0, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>
              <View style={{ flexDirection: 'row', backgroundColor: '#EDF2F7', paddingVertical: 6, paddingHorizontal: 12 }}>
                <Text style={{ flex: 2, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#4A5568' }}>PAYMENT</Text>
                <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#4A5568', textAlign: 'center' }}>DUE DATE</Text>
                <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#4A5568', textAlign: 'right' }}>AMOUNT</Text>
              </View>
              {data.paymentTerms.schedule.map((item, i) => {
                const isDeposit = i === 0;
                return (
                  <View key={i} style={{ flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 12, borderTopWidth: 1, borderColor: '#E2E8F0', backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F7FAFC' }}>
                    <Text style={{ flex: 2, fontSize: 9, color: '#2D3748', fontFamily: isDeposit ? 'Helvetica-Bold' : 'Helvetica' }}>
                      {item.label}{isDeposit ? ' (Non-Refundable)' : ''}
                    </Text>
                    <Text style={{ flex: 1, fontSize: 9, color: '#4A5568', textAlign: 'center' }}>
                      {item.due_date ? formatDateShort(new Date(item.due_date)) : 'Upon signing'}
                    </Text>
                    <Text style={{ flex: 1, fontSize: 9, color: isDeposit ? C.primary : '#2D3748', fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>
                      {fmt(Math.round(item.amount * 100))}
                    </Text>
                  </View>
                );
              })}
              <View style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#E8F5E9', borderTopWidth: 2, borderColor: C.primary }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.primary }}>DEPOSIT DUE NOW</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.primary }}>{fmt(Math.round(data.paymentTerms.deposit_amount * 100))}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Contract info */}
          <View style={[s.infoBox, { marginTop: 16 }]}>
            <Text style={s.infoTitle}>Contract Information</Text>
            <View style={s.infoRow}><Text style={s.infoLabel}>Status</Text><Text style={[s.infoVal, { color, fontFamily: 'Helvetica-Bold' }]}>{data.invoiceStatus}</Text></View>
            <View style={s.infoRow}><Text style={s.infoLabel}>Contract Number</Text><Text style={s.infoVal}>{data.invoiceNumber}</Text></View>
            <View style={s.infoRow}><Text style={s.infoLabel}>Date Issued</Text><Text style={s.infoVal}>{formatDateShort(data.invoiceDate)}</Text></View>
            {data.dueDate && <View style={s.infoRow}><Text style={s.infoLabel}>Payment Due</Text><Text style={[s.infoVal, { color, fontFamily: 'Helvetica-Bold' }]}>{formatDateShort(data.dueDate)}</Text></View>}
            <View style={s.infoRow}><Text style={s.infoLabel}>Terms</Text><Text style={[s.infoVal, { fontFamily: 'Helvetica-Bold' }]}>See Terms & Conditions on following pages</Text></View>
          </View>

          {/* Notes */}
          {data.notes && <NotesSection text={data.notes} />}

          {/* Florida lien notice */}
          <View style={{ marginTop: 12, padding: 8, backgroundColor: '#FFF3E0', borderRadius: 4, borderWidth: 1, borderColor: '#FFB74D' }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#E65100', marginBottom: 3, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Florida Construction Lien Law Notice
            </Text>
            <Text style={{ fontSize: 7, color: '#BF360C', lineHeight: 1.5 }}>
              {"Under Florida\u2019s Construction Lien Law (Ch. 713, Florida Statutes), those who work on your property or provide materials and are not paid have a right to enforce their claim for payment against your property. This claim is known as a construction lien. If you fail to pay as agreed under this Contract, a lien may be placed on your property. It is recommended that you consult an attorney if you have questions."}
            </Text>
          </View>

          <Footer />
        </Page>
      )}

      {/* Page 2+: Legal Terms & Conditions — only for contracts */}
      {hasPaymentTerms && <LegalTermsPages docNumber={data.invoiceNumber} />}
    </Document>
  );
};

// ═══════════════════════════════════════════════════════════════
// ESTIMATE DOCUMENT
// ═══════════════════════════════════════════════════════════════

export interface EstimatePaymentScheduleItem {
  label: string;
  amount: number;
  due_date: string | null;
}

/** Estimate-specific data (pre-acceptance) */
export interface EstimateData extends BaseDocumentData {
  quoteNumber: string;
  quoteDate: Date;
  expirationDate?: Date;
  quoteStatus: 'PENDING' | 'ACCEPTED';
  showFinancing: boolean;
  paymentTerms?: { type: string; schedule: EstimatePaymentScheduleItem[] } | null;
}

const FINANCING_MESSAGE =
  'This project is eligible for flexible payment options including deposits and installment plans. Contact us to discuss a payment schedule that works for you.';

const EstimateDoc: React.FC<{ data: EstimateData; logoUrl?: string }> = ({ data, logoUrl }) => {
  const isAccepted = data.quoteStatus === 'ACCEPTED';
  const badge = isAccepted ? s.badgePaid : s.badgeDue;
  const badgeText = isAccepted ? s.badgePaidText : s.badgeDueText;
  const label = isAccepted ? 'ACCEPTED' : 'PENDING';

  return (
    <Document title={`JHPS Estimate - ${data.quoteNumber}`} author={BRAND.name} subject="Service Estimate">
      <Page size="LETTER" style={s.page}>
        <ContinuationHeader docType="ESTIMATE" docNumber={data.quoteNumber} />
        <View style={s.header}>
          <CompanyHeader logoUrl={logoUrl} />
          <View style={s.headerRight}>
            <Text style={s.docTitle}>ESTIMATE</Text>
            <View style={badge}><Text style={badgeText}>{label}</Text></View>
          </View>
        </View>
        <View style={s.metaRow}>
          <View style={s.metaBlock}>
            <Text style={s.metaLabel}>Prepared For</Text>
            <Text style={s.metaValBold}>{data.customerName}</Text>
            <Text style={s.metaVal}>{data.customerEmail}</Text>
            {data.customerPhone && <Text style={s.metaVal}>{data.customerPhone}</Text>}
            {data.customerAddress && <Text style={s.metaVal}>{data.customerAddress}</Text>}
          </View>
          <View style={[s.metaBlock, { alignItems: 'flex-end' }]}>
            <Text style={s.metaLabel}>Estimate Details</Text>
            <Text style={s.metaVal}>Estimate #: {data.quoteNumber}</Text>
            <Text style={s.metaVal}>Date: {formatDateShort(data.quoteDate)}</Text>
            {data.expirationDate && <Text style={[s.metaValBold, { color: C.dueBlue, marginTop: 4 }]}>Valid Until: {formatDateShort(data.expirationDate)}</Text>}
          </View>
        </View>
        <ItemsTable items={data.lineItems} />
        <TotalsBlock
          subtotal={data.subtotal}
          taxAmount={data.taxAmount}
          discountAmount={data.discountAmount}
          totalAmount={data.totalAmount}
          totalLabel="Estimated Total"
          depositAmount={data.paymentTerms?.schedule?.[0]?.amount}
          balanceAmount={data.paymentTerms?.schedule && data.paymentTerms.schedule.length > 1
            ? data.paymentTerms.schedule.slice(1).reduce((sum, s) => sum + s.amount, 0)
            : undefined}
        />

        {data.paymentTerms && data.paymentTerms.schedule && data.paymentTerms.schedule.length > 0 && (
          <View style={{ marginTop: 20 }} wrap={false}>
            <View style={{ backgroundColor: '#1E3A5F', paddingVertical: 8, paddingHorizontal: 12, borderTopLeftRadius: 4, borderTopRightRadius: 4 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' }}>PAYMENT SCHEDULE</Text>
            </View>
            <View style={{ borderWidth: 1, borderColor: '#CBD5E0', borderTopWidth: 0, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>
              {/* Header row */}
              <View style={{ flexDirection: 'row', backgroundColor: '#EDF2F7', paddingVertical: 6, paddingHorizontal: 12 }}>
                <Text style={{ flex: 2, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#4A5568' }}>DESCRIPTION</Text>
                <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#4A5568', textAlign: 'center' }}>DUE DATE</Text>
                <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#4A5568', textAlign: 'right' }}>AMOUNT</Text>
              </View>
              {data.paymentTerms.schedule.map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 12, borderTopWidth: 1, borderColor: '#E2E8F0', backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F7FAFC' }}>
                  <Text style={{ flex: 2, fontSize: 9, color: '#2D3748' }}>{item.label}</Text>
                  <Text style={{ flex: 1, fontSize: 9, color: '#4A5568', textAlign: 'center' }}>{item.due_date ? formatDateShort(new Date(item.due_date)) : 'TBD'}</Text>
                  <Text style={{ flex: 1, fontSize: 9, color: '#2D3748', fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>{fmt(Math.round(item.amount * 100))}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {data.showFinancing && (
          <View style={{ marginTop: 20, padding: 14, borderRadius: 6, borderWidth: 1.5, borderColor: '#26A69A', backgroundColor: '#E0F2F1' }} wrap={false}>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#00695C', marginBottom: 6 }}>$ FLEXIBLE PAYMENT OPTIONS AVAILABLE</Text>
            <Text style={{ fontSize: 9, color: '#004D40', lineHeight: 1.5 }}>{FINANCING_MESSAGE}</Text>
          </View>
        )}

        <View style={s.infoBox} wrap={false}>
          <Text style={s.infoTitle}>Estimate Information</Text>
          <View style={s.infoRow}><Text style={s.infoLabel}>Status</Text><Text style={[s.infoVal, { color: isAccepted ? C.paidGreen : C.dueBlue, fontFamily: 'Helvetica-Bold' }]}>{data.quoteStatus}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Estimate Number</Text><Text style={s.infoVal}>{data.quoteNumber}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Date Prepared</Text><Text style={s.infoVal}>{formatDateShort(data.quoteDate)}</Text></View>
          {data.expirationDate && <View style={s.infoRow}><Text style={s.infoLabel}>Valid Until</Text><Text style={[s.infoVal, { color: C.dueBlue, fontFamily: 'Helvetica-Bold' }]}>{formatDateShort(data.expirationDate)}</Text></View>}
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

export async function generateEstimatePDF(data: EstimateData, logoUrl?: string): Promise<Buffer> {
  const buf = await renderToBuffer(<EstimateDoc data={data} logoUrl={logoUrl} />);
  return Buffer.from(buf);
}

export function getEstimateFilename(data: EstimateData): string {
  return `JHPS-Estimate-${data.quoteNumber}.pdf`;
}
