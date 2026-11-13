// Safe for the browser. The customer reads this wording and the same wording is saved with their consent.
export const STATEMENT_NAME = 'SQ *JENKINS HOME & PROPE';

export const usd = (n: number) =>
  Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function authorizationText(sub: { amount: number | string; next_billing_date?: string | null; reference?: string | null }, dueTodayCents = 0) {
  const when = sub.next_billing_date
    ? `The next monthly charge is on ${longDate(sub.next_billing_date)}, then on the same day each month.`
    : `${dueTodayCents > 0 ? 'No monthly charge is made today.' : 'Nothing is charged today.'} We will email you the first monthly charge date before it happens.`;
  return [
    `${dueTodayCents > 0 ? `I authorize NexaVision Group to charge this card ${usd(dueTodayCents / 100)} today, and to ` : 'I authorize NexaVision Group to '}charge this card each month for the services in my signed agreement${sub.reference ? ` ${sub.reference}` : ''}.`,
    `The monthly price is currently ${usd(Number(sub.amount))}. Each charge can also include usage-based or other amounts allowed by that agreement, so the total can change from month to month.`,
    when,
    `We will email you the amount before any charge that differs from the last one, and a receipt after every charge.`,
    `Charges appear on your card statement as ${STATEMENT_NAME}.`,
    `You can stop automatic billing any time by emailing info@nexavisiongroup.com.`,
  ].join(' ');
}

/** A card saved for prepaid AI credit (the Nexa AI module), not for monthly billing. */
export const CREDIT_SERVICE = 'AI credits';
export const isCreditWallet = (sub: { service_type?: string | null } | null | undefined) => sub?.service_type === CREDIT_SERVICE;

export function creditAuthorizationText() {
  return [
    `I authorize NexaVision Group to save this card and charge it for AI credit in my app.`,
    `It is charged only when someone on my account adds credit, for the amount they choose, or automatically if automatic top-up is turned on in the app, for the amount set there.`,
    `Nothing is charged today.`,
    `We email a receipt after every charge.`,
    `Charges appear on the card statement as ${STATEMENT_NAME}.`,
    `You can remove this card any time in the app or by emailing info@nexavisiongroup.com.`,
  ].join(' ');
}
