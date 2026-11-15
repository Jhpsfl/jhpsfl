// NexaBooks connector: makes the one-time link that opens NexaBooks for a signed-in admin user.
// Server-only. No dependencies beyond Node's crypto. Copy this folder into the admin app unchanged.
import { createHmac, randomBytes } from 'node:crypto';

export type NexaBooksRole = 'owner' | 'manager' | 'viewer';

export type NexaBooksUser = {
  /** Stable id of the user in this admin app (never an email that can change). */
  id: string;
  email?: string | null;
  name?: string | null;
  role: NexaBooksRole;
};

export type NexaBooksConfig = {
  /** Base URL of the NexaBooks service. */
  url: string;
  /** This business's slug in NexaBooks. */
  tenant: string;
  /** Connector secret issued by NexaVision. Keep it in server-side environment variables only. */
  secret: string;
};

/** Reads NEXABOOKS_URL, NEXABOOKS_TENANT and NEXABOOKS_SECRET. Returns null when the module isn't configured. */
export function nexaBooksConfig(env: Record<string, string | undefined> = process.env): NexaBooksConfig | null {
  const url = env.NEXABOOKS_URL?.trim().replace(/\/+$/, '');
  const tenant = env.NEXABOOKS_TENANT?.trim();
  const secret = env.NEXABOOKS_SECRET?.trim();
  return url && tenant && secret ? { url, tenant, secret } : null;
}

const b64u = (s: string | Buffer) => Buffer.from(s).toString('base64url');

/** Builds the launch URL. The link works once and expires after 60 seconds, so create it at click time. */
export function nexaBooksLaunchUrl(config: NexaBooksConfig, user: NexaBooksUser): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64u(
    JSON.stringify({
      tenant: config.tenant,
      sub: user.id,
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      role: user.role,
      iat: now,
      exp: now + 60,
      nonce: randomBytes(18).toString('base64url'),
    }),
  );
  const signed = `v1.${payload}`;
  const sig = createHmac('sha256', config.secret).update(signed).digest('base64url');
  return `${config.url}/launch?t=${signed}.${sig}`;
}
