import os

f = r'C:\websites\jhps\git\src\lib\receipt-generator.tsx'
lines = open(f, 'r', encoding='utf-8').readlines()
print(f'Original: {len(lines)} lines')

# Find InvoiceDoc start and ESTIMATE DOCUMENT marker
inv_start = None
est_start = None
for i, line in enumerate(lines):
    if line.strip().startswith('const InvoiceDoc'):
        inv_start = i
    if 'ESTIMATE DOCUMENT' in line and inv_start is not None and est_start is None:
        est_start = i - 2  # 2 lines before (blank + comment border)

print(f'InvoiceDoc: {inv_start+1} to {est_start+1}')

before = lines[:inv_start]
after = lines[est_start:]

# Ultra-minimal InvoiceDoc — no shared components
new_invoice = '''const InvoiceDoc: React.FC<{ data: InvoiceData; logoUrl?: string }> = ({ data }) => {
  return (
    <Document title={`Invoice - ${data.invoiceNumber}`}>
      <Page size="LETTER" style={{ padding: 50 }}>
        <View>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 10 }}>INVOICE</Text>
          <Text style={{ fontSize: 12, marginBottom: 5 }}>{data.invoiceNumber}</Text>
          <Text style={{ fontSize: 10, marginBottom: 5 }}>Customer: {data.customerName}</Text>
          <Text style={{ fontSize: 10, marginBottom: 5 }}>Date: {String(data.invoiceDate)}</Text>
          <Text style={{ fontSize: 10, marginBottom: 15 }}>Total: {fmt(data.totalAmount)}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 5 }}>LINE ITEMS</Text>
          {data.lineItems.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
              <Text style={{ fontSize: 9, flex: 3 }}>{item.name}</Text>
              <Text style={{ fontSize: 9, flex: 1, textAlign: 'right' }}>{fmt(item.totalPrice)}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
};

'''

result = ''.join(before) + new_invoice + ''.join(after)
open(f, 'w', encoding='utf-8').write(result)
new_count = len(result.split('\n'))
print(f'New: {new_count} lines')
