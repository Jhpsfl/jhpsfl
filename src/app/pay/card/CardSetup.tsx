'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { getBrand } from '@/lib/brand-config';
import { usd } from '@/lib/recurring-text';

const brand = getBrand('nexa');
const c = brand.colors;

type Props = { token: string; active: boolean; plan: string; name: string; email: string; phone: string; last4: string; authorization: string; returnUrl: string; dueCents: number; monthly: number; credit?: boolean };

export default function CardSetup({ token, active, plan, name, email, phone, last4, authorization, returnUrl, dueCents, monthly, credit }: Props) {
  const cardRef = useRef<any>(null);
  const [sdk, setSdk] = useState(false);
  const [ready, setReady] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const [due, setDue] = useState(dueCents);
  const [paid, setPaid] = useState(0);

  useEffect(() => {
    if (!active || saved || !sdk) return;
    let cancelled = false;
    let card: any;
    (async () => {
      try {
        const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.trim();
        const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID?.trim();
        const payments = (window as any).Square.payments(appId, locationId);
        card = await payments.card({ style: brand.squareCardStyle || {} });
        if (cancelled) return card.destroy().catch(() => {});
        await card.attach('#sq-card');
        cardRef.current = card;
        setReady(true);
      } catch (e) {
        console.error(e);
        setErr("The secure card form didn't load. Refresh the page and try again.");
      }
    })();
    return () => { cancelled = true; if (card) card.destroy().catch(() => {}); };
  }, [active, saved, sdk]);

  async function save() {
    setErr('');
    if (!agreed) return setErr('Check the box to authorize automatic billing.');
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const [givenName, ...rest] = name.trim().split(/\s+/);
      const result = await cardRef.current.tokenize({
        ...(due > 0 ? { intent: 'CHARGE_AND_STORE', amount: (due / 100).toFixed(2), currencyCode: 'USD' } : { intent: 'STORE' }),
        customerInitiated: true, sellerKeyedIn: false,
        billingContact: { givenName: givenName || undefined, familyName: rest.join(' ') || undefined, email: email || undefined, phone: phone || undefined, countryCode: 'US' },
      });
      if (result.status !== 'OK') { setErr(result.errors?.map((x: any) => x.message).join(', ') || 'Please check your card details.'); return; }
      const r = await fetch('/api/pay-card', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, cardToken: result.token, agreed: true, dueCents: due }) });
      const j = await r.json();
      if (j.paidCents) { setPaid(j.paidCents); setDue(0); }
      if (!r.ok) {
        setErr(j.error || "We couldn't process that card.");
        return;
      }
      setSaved(j.last4 || 'saved');
    } catch (e) {
      console.error(e);
      setErr("We couldn't save that card. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: c.bg, color: c.textPrimary, fontFamily: brand.fonts.body, padding: '32px 16px 56px' }}>
      <style>{`@import url('${brand.fonts.googleImport}');`}</style>
      {active && !saved && <Script src="https://web.squarecdn.com/v1/square.js" onReady={() => setSdk(true)} />}
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brand.logo} alt={brand.name} style={{ height: 44, marginBottom: 8 }} />
        <p style={{ color: c.textSecondary, fontSize: 15, margin: '0 0 24px' }}>{brand.tagline}</p>
        {!active ? (
          <>
            <h1 style={h1}>This link is no longer active</h1>
            <p style={para}>Please contact us at {brand.email} and we&apos;ll help.</p>
          </>
        ) : saved ? (
          <>
            <h1 style={h1}>{paid ? "You're all set" : 'Your card is saved'}</h1>
            <p style={para}>{paid ? `Your payment of ${usd(paid / 100)} went through. ` : ''}Your card ending in {saved} is {credit ? 'saved. Go back to the app to add credit' : 'set up for automatic billing'}. We sent a confirmation to {email}.</p>
            <a href={returnUrl} style={{ ...btn, display: 'inline-block', textAlign: 'center', textDecoration: 'none', marginTop: 12 }}>{credit ? 'Back to the app' : 'Back to your project'}</a>
          </>
        ) : (
          <>
            <h1 style={h1}>{due > 0 ? 'Finish signing up' : last4 ? 'Update your card' : 'Save your card'}</h1>
            <p style={para}>{plan}{last4 ? `. The card we have now ends in ${last4}.` : ''}</p>
            {due > 0 && (
              <dl style={{ margin: '16px 0 0', display: 'grid', gap: 8, fontSize: 17 }}>
                <div style={row}><dt>Due today</dt><dd style={{ margin: 0, fontWeight: 700 }}>{usd(due / 100)}</dd></div>
                <div style={row}><dt style={{ color: c.textSecondary }}>Then each month</dt><dd style={{ margin: 0, color: c.textSecondary }}>{usd(monthly)}</dd></div>
              </dl>
            )}
            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 16, padding: 18, marginTop: 18 }}>
              <div id="sq-card" style={{ minHeight: 90 }} />
              {!ready && !err && <p style={{ ...para, marginBottom: 0 }}>Loading the secure card form…</p>}
            </div>
            <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 20, cursor: 'pointer', fontSize: 16, lineHeight: 1.55, color: c.textPrimary }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 24, height: 24, flex: 'none', marginTop: 2, accentColor: c.primary }} />
              <span>{authorization}</span>
            </label>
            {err && <p role="alert" style={{ color: '#ff8a80', fontSize: 16, marginTop: 14 }}>{err}</p>}
            <button type="button" onClick={save} disabled={busy || !ready} style={{ ...btn, marginTop: 20, width: '100%', opacity: busy || !ready ? 0.6 : 1 }}>{busy ? 'Working…' : due > 0 ? `Pay ${usd(due / 100)} and save card` : last4 ? 'Update card' : 'Save card'}</button>
            <p style={{ ...para, fontSize: 15, marginTop: 14 }}>Your card details go directly to our payment processor, Square. We never see or store your full card number.</p>
          </>
        )}
      </div>
    </main>
  );
}

const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16 };
const h1: React.CSSProperties = { fontFamily: brand.fonts.display, fontSize: 32, lineHeight: 1.15, margin: '0 0 10px', fontWeight: 700 };
const para: React.CSSProperties = { color: c.textSecondary, fontSize: 17, lineHeight: 1.55, margin: '0 0 8px' };
const btn: React.CSSProperties = { background: c.primary, color: c.bg, border: 0, borderRadius: 12, minHeight: 52, padding: '14px 24px', fontSize: 17, fontWeight: 700, fontFamily: brand.fonts.body, cursor: 'pointer' };
