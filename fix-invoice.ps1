$f = "C:\websites\jhps\git\src\lib\receipt-generator.tsx"
$lines = Get-Content $f

# Lines 0-643 (before InvoiceDoc) stay the same
$before = $lines[0..643]

# Lines 832+ (EstimateDoc onward) stay the same  
$after = $lines[832..($lines.Count-1)]

# New clean InvoiceDoc
$newInvoice = @'
const InvoiceDoc: React.FC<{ data: InvoiceData; logoUrl?: string }> = ({ data, logoUrl }) => {
  const docBrand = resolveBrand(data.brandKey);
  const docColors = resolveColors(data.brandKey);
  const isOverdue = data.invoiceStatus === 'OVERDUE';
  const badge = isOverdue ? s.badgeOverdue : s.badgeDue;
  const badgeText = isOverdue ? s.badgeOverdueText : s.badgeDueText;
  const label = isOverdue ? 'OVERDUE' : 'DUE';
  const color = isOverdue ? C.overdueRed : C.dueBlue;

  return (
    <Document title={`${docBrand.shortName} Invoice - ${data.invoiceNumber}`} author={docBrand.name} subject="Invoice">
      <Page size="LETTER" style={s.page}>
        <ContinuationHeader docType="INVOICE" docNumber={data.invoiceNumber} primaryColor={docColors.primary} brandShort={docBrand.shortName} />
        <View style={[s.header, { borderBottomColor: docColors.primary }]}>
          <View style={s.headerLeft}>
            <Text style={[s.logoText, { color: docColors.primary }]}>{docBrand.shortName}</Text>
            <Text style={s.logoSubtext}>{docBrand.tagline}</Text>
            <View>
              <Text style={s.companyLine}>{docBrand.phone} {'\u00B7'} {docBrand.email}</Text>
              <Text style={s.companyLine}>{docBrand.website}</Text>
              <Text style={s.companyLine}>{docBrand.serviceArea}</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={[s.docTitle, { color: docColors.primary }]}>INVOICE</Text>
            <View style={badge}><Text style={badgeText}>{label}</Text></View>
          </View>
        </View>

        <View style={s.metaRow}>
          <View style={s.metaBlock}>
            <Text style={s.metaLabel}>Bill To</Text>
            <Text style={s.metaValBold}>{data.customerName}</Text>
            <Text style={s.metaVal}>{data.customerEmail || ' '}</Text>
            {data.customerPhone ? <Text style={s.metaVal}>{data.customerPhone}</Text> : <Text style={s.metaVal}>{' '}</Text>}
          </View>
          <View style={[s.metaBlock, { alignItems: 'flex-end' as const }]}>
            <Text style={s.metaLabel}>Invoice Details</Text>
            <Text style={s.metaVal}>Invoice #: {data.invoiceNumber}</Text>
            <Text style={s.metaVal}>Issued: {formatDateShort(data.invoiceDate)}</Text>
            {data.dueDate ? (
              <Text style={[s.metaValBold, { color, marginTop: 4 }]}>Due: {formatDateShort(data.dueDate)}</Text>
            ) : (
              <Text style={s.metaVal}>{' '}</Text>
            )}
          </View>
        </View>

        <ItemsTable items={data.lineItems} primaryColor={docColors.primary} />
        <TotalsBlock
          subtotal={data.subtotal}
          taxAmount={data.taxAmount}
          discountAmount={data.discountAmount}
          totalAmount={data.totalAmount}
          totalLabel="Amount Due"
          primaryColor={docColors.primary}
        />

        <View style={s.infoBox} wrap={false}>
          <Text style={s.infoTitle}>Invoice Information</Text>
          <View style={s.infoRow}><Text style={s.infoLabel}>Status</Text><Text style={[s.infoVal, { color, fontFamily: 'Helvetica-Bold' }]}>{data.invoiceStatus}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Invoice Number</Text><Text style={s.infoVal}>{data.invoiceNumber}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Date Issued</Text><Text style={s.infoVal}>{formatDateShort(data.invoiceDate)}</Text></View>
          {data.dueDate ? (
            <View style={s.infoRow}><Text style={s.infoLabel}>Payment Due</Text><Text style={[s.infoVal, { color, fontFamily: 'Helvetica-Bold' }]}>{formatDateShort(data.dueDate)}</Text></View>
          ) : (
            <View />
          )}
        </View>

        {data.paymentLink ? (
          <View style={s.payLinkBox} wrap={false}>
            <Text style={[s.payLinkTitle, { color: docColors.primary }]}>Pay Online</Text>
            <Text style={[s.payLinkUrl, { color: docColors.primaryLight }]}>{data.paymentLink}</Text>
            <Text style={s.payLinkNote}>Click or copy the link above to make a secure payment.</Text>
          </View>
        ) : (
          <View />
        )}

        {data.notes ? <NotesSection text={data.notes} /> : <View />}

        <Footer brandName={docBrand.name} brandPhone={docBrand.phone} brandEmail={docBrand.email} brandShort={docBrand.shortName} brandTagline={docBrand.tagline} primaryColor={docColors.primary} />
      </Page>
    </Document>
  );
};

'@

$result = $before + $newInvoice.Split("`n") + $after
Set-Content -Path $f -Value $result
Write-Host "Done. New line count: $($result.Count)"
