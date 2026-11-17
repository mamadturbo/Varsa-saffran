import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { sql } from 'drizzle-orm';
import type { db } from '@workspace/db';

export const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const ADMIN_LOGIN_IP_LIMIT = 5;
export const ADMIN_LOGIN_GLOBAL_LIMIT = 100;
export type LoginLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };
export type LoginAttemptStore = { consume: (key: string) => Promise<LoginLimitResult> };

class LimitReached extends Error {
  constructor(readonly retryAfterSeconds: number) { super('Admin login limit reached'); }
}

// Canonicalize IPv4/mapped IPv4 and group IPv6 into /64 networks. Rotating an
// IPv6 interface address must not provide a new login allowance.
export function clientNetwork(address: string): string {
  if (isIP(address) === 4) return address;
  if (isIP(address) !== 6) throw new Error('Invalid client address');
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/.exec(canonical);
  if (mapped) {
    const high = parseInt(mapped[1], 16); const low = parseInt(mapped[2], 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  const [left, right] = canonical.split('::');
  const start = left ? left.split(':') : [];
  const end = right ? right.split(':') : [];
  const groups = right === undefined ? start : [...start, ...Array(8 - start.length - end.length).fill('0'), ...end];
  return `${groups.slice(0, 4).map(group => group.padStart(4, '0')).join(':')}::/64`;
}

export function loginClientKey(address: string, secret: string) {
  return `ip:${createHmac('sha256', secret).update(clientNetwork(address)).digest('hex')}`;
}

export function trustedProxyAddresses(value: string | undefined): false | string[] {
  if (!value?.trim()) return false;
  const addresses = value.split(',').map(address => address.trim());
  if (addresses.some(address => isIP(address) === 0)) {
    throw new Error('TRUSTED_PROXY_IPS must contain explicit comma-separated IP addresses.');
  }
  return addresses;
}

export function createLoginAttemptStore(database: Pick<typeof db, 'transaction' | 'execute'>): LoginAttemptStore {
  return {
    async consume(key) {
      // Retain at most one day of expired, hashed buckets. The global cap and
      // rollback on denial bound new rows even when attackers rotate addresses.
      await database.execute(sql`DELETE FROM admin_login_attempts WHERE expires_at < CURRENT_TIMESTAMP - interval '1 day'`);
      try {
        return await database.transaction(async (transaction) => {
          for (const [bucket, limit] of [[key, ADMIN_LOGIN_IP_LIMIT], ['global', ADMIN_LOGIN_GLOBAL_LIMIT]] as const) {
            const result = await transaction.execute(sql`
              INSERT INTO admin_login_attempts (bucket, attempts, expires_at)
              VALUES (${bucket}, 1, CURRENT_TIMESTAMP + ${ADMIN_LOGIN_WINDOW_MS} * interval '1 millisecond')
              ON CONFLICT (bucket) DO UPDATE SET
                attempts = CASE WHEN admin_login_attempts.expires_at <= CURRENT_TIMESTAMP THEN 1 ELSE admin_login_attempts.attempts + 1 END,
                expires_at = CASE WHEN admin_login_attempts.expires_at <= CURRENT_TIMESTAMP THEN EXCLUDED.expires_at ELSE admin_login_attempts.expires_at END
              WHERE admin_login_attempts.expires_at <= CURRENT_TIMESTAMP OR admin_login_attempts.attempts < ${limit}
              RETURNING bucket
            `);
            if (result.rows.length === 0) {
              const remaining = await transaction.execute<{ seconds: number }>(sql`
                SELECT GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))))::integer AS seconds
                FROM admin_login_attempts WHERE bucket = ${bucket}
              `);
              throw new LimitReached(remaining.rows[0]?.seconds ?? ADMIN_LOGIN_WINDOW_MS / 1000);
            }
          }
          return { allowed: true } as const;
        });
      } catch (error) {
        if (error instanceof LimitReached) return { allowed: false, retryAfterSeconds: error.retryAfterSeconds };
        throw error;
      }
    },
  };
}
