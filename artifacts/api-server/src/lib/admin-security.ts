import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomInt,
} from "node:crypto";
import argon2 from "argon2";
import { TOTP, Secret } from "otpauth";
import {
  Router,
  type Request,
  type Response,
  type RequestHandler,
} from "express";
import { sql } from "drizzle-orm";
import type { db } from "@workspace/db";
import { StoreError } from "./management-store";
import { securityLimit } from "./security-limit";

const COOKIE = "varsa_admin_session";
const passwordOnlyEnabled = () => process.env.ADMIN_PASSWORD_ONLY === "true";
const identities = new WeakMap<
  Request,
  { id: string; username: string; complete: boolean }
>();
export const hashToken = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const hashPassword = (s: string) => {
  if (s.length < 14 || s.length > 256)
    throw new StoreError("رمز باید بین ۱۴ و ۲۵۶ نویسه باشد.");
  return argon2.hash(s, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
};
function encryptionKey() {
  const key = process.env.ADMIN_MFA_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new Error("ADMIN_MFA_KEY must be 32 random bytes encoded as hex");
  return Buffer.from(key, "hex");
}
export function encryptSecret(secret: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from("varsa:admin:totp:v1"));
  return Buffer.concat([
    iv,
    cipher.update(secret, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
export function decryptSecret(encoded: string) {
  const bytes = Buffer.from(encoded, "base64"),
    decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      bytes.subarray(0, 12),
    );
  decipher.setAAD(Buffer.from("varsa:admin:totp:v1"));
  decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([
    decipher.update(bytes.subarray(12, -16)),
    decipher.final(),
  ]).toString("utf8");
}
export const totpFor = (secret: string, username = "admin") =>
  new TOTP({
    issuer: "Varsa",
    label: username,
    secret: Secret.fromBase32(secret),
    digits: 6,
    period: 30,
    algorithm: "SHA1",
  });
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api",
  maxAge: 8 * 3600000,
});
const tokenFrom = (req: Request) =>
  req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
export function hasValidAdminToken(req: Request) {
  return identities.get(req)?.complete === true;
}
export function adminIdentity(req: Request) {
  return identities.get(req);
}
type Account = {
  id: string;
  username: string;
  password_hash: string;
  totp_secret: string | null;
  pending_secret: string | null;
  pending_until: Date | null;
  last_counter: string;
  recovery_hashes: string[];
};
const credentials = (req: Request) => {
  const b = req.body;
  if (!b || typeof b !== "object" || Array.isArray(b))
    throw new StoreError("اطلاعات ورود نامعتبر است.", 401);
  return b as Record<string, unknown>;
};
const denied = () =>
  new StoreError("اطلاعات ورود یا عامل دوم نامعتبر است.", 401);
const temporaryCodeEnabled = (req: Request) =>
  process.env.NODE_ENV === "development" &&
  process.env.ADMIN_AUTH_DEV_OTP === "true" &&
  ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
    req.socket.remoteAddress ?? "",
  );
const dummyHash = argon2.hash(randomBytes(32), {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
});
async function passwordValid(a: Account | undefined, p: unknown) {
  if (typeof p !== "string" || p.length > 256) return false;
  const valid = await argon2.verify(a?.password_hash ?? (await dummyHash), p);
  return !!a && valid;
}
async function secondFactor(
  tx: typeof db,
  a: Account,
  code: unknown,
  recovery: unknown,
  allowTemporary = false,
) {
  if (
    allowTemporary &&
    a.pending_secret &&
    a.pending_until &&
    new Date(a.pending_until).getTime() > Date.now() &&
    typeof code === "string" &&
    /^\d{6}$/.test(code) &&
    decryptSecret(a.pending_secret) === "temporary:" + code
  ) {
    await tx.execute(
      sql`UPDATE admin_accounts SET pending_secret=NULL,pending_until=NULL WHERE id=${a.id}`,
    );
    return true;
  }
  if (typeof recovery === "string" && /^[a-f0-9]{32}$/.test(recovery)) {
    const digest = hashToken(recovery);
    if (!a.recovery_hashes.includes(digest)) return false;
    await tx.execute(
      sql`UPDATE admin_accounts SET recovery_hashes=${JSON.stringify(a.recovery_hashes.filter((h) => h !== digest))}::jsonb WHERE id=${a.id}`,
    );
    await tx.execute(sql`DELETE FROM admin_sessions WHERE admin_id=${a.id}`);
    return true;
  }
  if (!a.totp_secret || typeof code !== "string" || !/^\d{6}$/.test(code))
    return false;
  const otp = totpFor(decryptSecret(a.totp_secret)),
    delta = otp.validate({ token: code, window: 1 });
  const counter = otp.counter() + (delta ?? 0);
  if (delta === null || counter <= Number(a.last_counter)) return false;
  await tx.execute(
    sql`UPDATE admin_accounts SET last_counter=${counter} WHERE id=${a.id}`,
  );
  return true;
}
export function createAdminSecurity(database: typeof db) {
  const resolve: RequestHandler = async (req, res, next) => {
    try {
      const token = tokenFrom(req);
      if (token && (/^[A-Za-z0-9_-]{43}$/.test(token) ||
        (passwordOnlyEnabled() && /^p_[A-Za-z0-9_-]{43}$/.test(token)))) {
        const result = await database.execute<{
          id: string;
          username: string;
          complete: boolean;
        }>(
          sql`UPDATE admin_sessions s SET last_seen=now() FROM admin_accounts a WHERE s.admin_id=a.id AND token_hash=${hashToken(token)} AND expires_at>now() AND last_seen>now()-interval '20 minutes' RETURNING a.id,a.username,s.complete`,
        );
        if (result.rows[0]) identities.set(req, result.rows[0]);
      }
      if (req.path.startsWith("/admin")) res.set("Cache-Control", "no-store");
      next();
    } catch (e) {
      next(e);
    }
  };
  async function session(
    tx: typeof db,
    res: Response,
    a: Account,
    complete: boolean,
    passwordOnly = false,
  ) {
    // These sessions stop resolving immediately when password-only mode is removed.
    const token = (passwordOnly ? "p_" : "") + randomBytes(32).toString("base64url");
    await tx.execute(
      sql`DELETE FROM admin_sessions WHERE expires_at<now() OR last_seen<now()-interval '20 minutes'`,
    );
    await tx.execute(
      sql`INSERT INTO admin_sessions(token_hash,admin_id,complete,expires_at) VALUES(${hashToken(token)},${a.id},${complete},now()+${complete ? 28800 : 600}*interval '1 second')`,
    );
    res.cookie(COOKIE, token, {
      ...cookieOptions(),
      maxAge: complete ? 28800000 : 600000,
    });
  }
  const router = Router();
  const route =
    (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req, res, next) => {
      try {
        res.set("Cache-Control", "no-store");
        await fn(req, res);
      } catch (e) {
        next(e);
      }
    };
  router.get(
    "/admin/login-options",
    route(async (req, res) => {
      res.json({ temporaryCodeEnabled: temporaryCodeEnabled(req), passwordOnly: passwordOnlyEnabled() });
    }),
  );
  router.post(
    "/admin/temporary-code",
    route(async (req, res) => {
      if (!temporaryCodeEnabled(req))
        throw new StoreError("این روش ورود فعال نیست.", 404);
      const b = credentials(req);
      const username =
        typeof b.username === "string" ? b.username.toLowerCase() : "";
      await securityLimit(database, req, "admin-login", username, 8, 900);
      const result = await database.transaction(async (raw) => {
        const tx = raw as unknown as typeof db;
        const a = (
          await tx.execute<Account>(
            sql`SELECT * FROM admin_accounts WHERE username=${username} FOR UPDATE`,
          )
        ).rows[0];
        if (!(await passwordValid(a, b.password))) throw denied();
        const code = randomInt(0, 1000000).toString().padStart(6, "0");
        const expiresAt = new Date(Date.now() + 300000);
        await tx.execute(
          sql`UPDATE admin_accounts SET pending_secret=${encryptSecret("temporary:" + code)},pending_until=${expiresAt} WHERE id=${a.id}`,
        );
        await tx.execute(
          sql`INSERT INTO security_audit(admin_id,event) VALUES(${a.id},'local_temporary_code_issued')`,
        );
        return { code, expiresAt: expiresAt.toISOString() };
      });
      res.json(result);
    }),
  );
  router.post(
    "/admin/login",
    route(async (req, res) => {
      const b = credentials(req),
        username =
          typeof b.username === "string" &&
          /^[a-z0-9][a-z0-9_.-]{2,63}$/.test(b.username.toLowerCase())
            ? b.username.toLowerCase()
            : "";
      await securityLimit(database, req, "admin-login", username, 8, 900);
      const ok = await database.transaction(async (raw) => {
        const tx = raw as unknown as typeof db;
        const a = (
          await tx.execute<Account>(
            sql`SELECT * FROM admin_accounts WHERE username=${username} FOR UPDATE`,
          )
        ).rows[0];
        if (!(await passwordValid(a, b.password))) return false;
        if (passwordOnlyEnabled()) {
          await session(tx, res, a, true, true);
          await tx.execute(sql`INSERT INTO security_audit(admin_id,event) VALUES(${a.id},'password_only_login')`);
          return { authenticated: true, enrollmentRequired: false, username: a.username };
        }
        const temporary =
          temporaryCodeEnabled(req) &&
          typeof b.code === "string" &&
          !!a.pending_secret &&
          decryptSecret(a.pending_secret).startsWith("temporary:");
        if (!a.totp_secret && b.code && !temporary) return false;
        if (
          (a.totp_secret || temporary) &&
          !(await secondFactor(
            tx,
            a,
            b.code,
            b.recoveryCode,
            temporaryCodeEnabled(req),
          ))
        )
          return false;
        const complete = !!a.totp_secret || temporary;
        await session(tx, res, a, complete);
        await tx.execute(
          sql`INSERT INTO security_audit(admin_id,event) VALUES(${a.id},${temporary ? "local_temporary_login" : a.totp_secret ? "login" : "enrollment_login"})`,
        );
        return {
          authenticated: complete,
          enrollmentRequired: !complete,
          username: a.username,
        };
      });
      if (!ok) {
        await database.execute(
          sql`INSERT INTO security_audit(event) VALUES('admin_login_failed')`,
        );
        throw denied();
      }
      res.json(ok);
    }),
  );
  router.get(
    "/admin/session",
    route(async (req, res) => {
      const a = identities.get(req);
      res.json({
        authenticated: !!a?.complete,
        enrollmentRequired: !!a && !a.complete,
        username: a?.username,
      });
    }),
  );
  router.post(
    "/admin/logout",
    route(async (req, res) => {
      const token = tokenFrom(req);
      if (token)
        await database.execute(
          sql`DELETE FROM admin_sessions WHERE token_hash=${hashToken(token)}`,
        );
      res.clearCookie(COOKIE, cookieOptions());
      res.json({ ok: true });
    }),
  );
  const reauth = async (
    req: Request,
    fn: (
      tx: typeof db,
      a: Account,
      b: Record<string, unknown>,
    ) => Promise<unknown>,
    needSecond = true,
  ) => {
    const identity = identities.get(req);
    if (!identity) throw denied();
    await securityLimit(database, req, "admin-sensitive", identity.id, 8, 900);
    return database.transaction(async (raw) => {
      const tx = raw as unknown as typeof db,
        b = credentials(req);
      const a = (
        await tx.execute<Account>(
          sql`SELECT * FROM admin_accounts WHERE id=${identity.id} FOR UPDATE`,
        )
      ).rows[0];
      if (!(await passwordValid(a, b.password))) throw denied();
      if (
        needSecond && !passwordOnlyEnabled() &&
        a.totp_secret &&
        !(await secondFactor(tx, a, b.code, b.recoveryCode))
      )
        throw denied();
      return fn(tx, a, b);
    });
  };
  router.post(
    "/admin/mfa/begin",
    route(async (req, res) => {
      const value = await reauth(req, async (tx, a) => {
        const secret = new Secret({ size: 20 }).base32;
        await tx.execute(
          sql`UPDATE admin_accounts SET pending_secret=${encryptSecret(secret)},pending_until=now()+interval '5 minutes' WHERE id=${a.id}`,
        );
        return { secret, uri: totpFor(secret, a.username).toString() };
      });
      res.json(value);
    }),
  );
  router.post(
    "/admin/mfa/confirm",
    route(async (req, res) => {
      const value = await reauth(req, async (tx, a, b) => {
        if (
          !a.pending_secret ||
          !a.pending_until ||
          new Date(a.pending_until).getTime() < Date.now() ||
          typeof b.newCode !== "string"
        )
          throw denied();
        if (decryptSecret(a.pending_secret).startsWith("temporary:"))
          throw denied();
        const otp = totpFor(decryptSecret(a.pending_secret)),
          delta = otp.validate({ token: b.newCode, window: 1 });
        if (delta === null) throw denied();
        const codes = Array.from({ length: 10 }, () =>
          randomBytes(16).toString("hex"),
        );
        await tx.execute(
          sql`UPDATE admin_accounts SET totp_secret=pending_secret,pending_secret=NULL,pending_until=NULL,last_counter=${otp.counter() + delta},recovery_hashes=${JSON.stringify(codes.map(hashToken))}::jsonb WHERE id=${a.id}`,
        );
        await tx.execute(
          sql`DELETE FROM admin_sessions WHERE admin_id=${a.id}`,
        );
        await session(tx, res, a, true);
        await tx.execute(
          sql`INSERT INTO security_audit(admin_id,event) VALUES(${a.id},'mfa_enabled')`,
        );
        return { authenticated: true, recoveryCodes: codes };
      });
      res.json(value);
    }),
  );
  router.post(
    "/admin/mfa/disable",
    route(async (req, res) => {
      await reauth(req, async (tx, a) => {
        if (!a.totp_secret) throw denied();
        await tx.execute(
          sql`UPDATE admin_accounts SET totp_secret=NULL,pending_secret=NULL,pending_until=NULL,recovery_hashes='[]',last_counter=-1 WHERE id=${a.id}`,
        );
        await tx.execute(
          sql`DELETE FROM admin_sessions WHERE admin_id=${a.id}`,
        );
        await tx.execute(
          sql`INSERT INTO security_audit(admin_id,event) VALUES(${a.id},'mfa_disabled')`,
        );
      });
      res.clearCookie(COOKIE, cookieOptions());
      res.json({ ok: true, enrollmentRequired: true });
    }),
  );
  router.post(
    "/admin/password",
    route(async (req, res) => {
      const b = credentials(req);
      if (typeof b.newPassword !== "string") throw denied();
      await reauth(req, async (tx, a) => {
        const hashed = await hashPassword(b.newPassword as string);
        await tx.execute(
          sql`UPDATE admin_accounts SET password_hash=${hashed} WHERE id=${a.id}`,
        );
        await tx.execute(
          sql`DELETE FROM admin_sessions WHERE admin_id=${a.id}`,
        );
        await tx.execute(
          sql`INSERT INTO security_audit(admin_id,event) VALUES(${a.id},'password_changed')`,
        );
      });
      res.clearCookie(COOKIE, cookieOptions());
      res.json({ ok: true });
    }),
  );
  const auditMutation: RequestHandler = async (req, _res, next) => {
    try {
      const a = identities.get(req);
      if (
        a?.complete &&
        req.path.startsWith("/admin") &&
        !["GET", "HEAD", "OPTIONS"].includes(req.method)
      )
        await database.execute(
          sql`INSERT INTO security_audit(admin_id,event,route) VALUES(${a.id},'mutation_requested',${req.path.replace(/[0-9a-f-]{36}|\d+/g, ":id")})`,
        );
      next();
    } catch (e) {
      next(e);
    }
  };
  return { resolve, router, auditMutation };
}
