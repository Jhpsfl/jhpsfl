import { Resend } from 'resend';
import type { BrandConfig } from '@/lib/brand-config';

/** Sender for customer email: Nexa-branded mail comes from Nexa's own verified domain. */
export function brandMail(brand: Pick<BrandConfig, 'key' | 'name'>) {
  const nexaKey = process.env.RESEND_API_KEY_NEXA;
  if (brand.key === 'nexa' && nexaKey) {
    return { resend: new Resend(nexaKey), from: `${brand.name} <info@nexavisiongroup.com>` };
  }
  return { resend: new Resend(process.env.RESEND_API_KEY), from: `${brand.name} <info@jhpsfl.com>` };
}
