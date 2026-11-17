import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { StoreError } from "./management-store";
export function allowedOrigins() {
  return [
    ...new Set(
      [
        process.env.PUBLIC_ORIGIN,
        ...(process.env.ALLOWED_ORIGINS ?? "").split(","),
        ...(process.env.CUSTOMER_ALLOWED_ORIGINS ?? "").split(","),
      ]
        .filter((s): s is string => !!s?.trim())
        .map((s) => {
          const u = new URL(s.trim());
          if (
            !["http:", "https:"].includes(u.protocol) ||
            u.username ||
            u.password ||
            u.pathname !== "/" ||
            u.hash ||
            u.search
          )
            throw new Error(
              "Origins must be explicit HTTP(S) origins without paths or credentials",
            );
          return u.origin;
        }),
    ),
  ];
}
export function enforceRequestOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.get("origin");
  const allowed = allowedOrigins();
  // Host and forwarded Host never grant trust. Local development accepts only
  // loopback origins; production requires an explicit canonical origin.
  if (process.env.NODE_ENV !== "production" && origin) {
    const url = (() => {
      try {
        return new URL(origin);
      } catch {
        return null;
      }
    })();
    if (
      url &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.protocol === "http:"
    )
      allowed.push(url.origin);
  }
  if (origin && !allowed.includes(origin))
    throw new StoreError("مبدأ درخواست مجاز نیست.", 403);
  if (req.get("sec-fetch-site") === "cross-site")
    throw new StoreError("مبدأ درخواست مجاز نیست.", 403);
}
const cookieName = "varsa_csrf";
const sign = (value: string) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET required");
  return createHmac("sha256", secret)
    .update("csrf:" + value)
    .digest("base64url");
};
export const issueCsrf: RequestHandler = (_req, res) => {
  const nonce =
      Date.now().toString(36) + "_" + randomBytes(32).toString("base64url"),
    token = nonce + "." + sign(nonce);
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
    maxAge: 3600000,
  });
  res.set("Cache-Control", "no-store").json({ csrfToken: token });
};
export const protectMutations: RequestHandler = (req, _res, next) => {
  try {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    enforceRequestOrigin(req);
    const cookie = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    const token = req.get("x-varsa-csrf");
    if (!cookie || !token || token.length > 150 || token !== cookie)
      throw new StoreError("صفحه را تازه کنید و دوباره تلاش کنید.", 403);
    const [nonce, signature, ...rest] = token.split(".");
    const issued = nonce?.match(/^([a-z0-9]+)_[A-Za-z0-9_-]{43}$/);
    const age = issued ? Date.now() - parseInt(issued[1], 36) : NaN;
    if (!Number.isFinite(age) || age < -30000 || age > 3600000)
      throw new StoreError(
        "اعتبار درخواست تمام شده است؛ دوباره تلاش کنید.",
        403,
      );
    const expected = nonce ? sign(nonce) : "";
    if (
      rest.length ||
      !signature ||
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      throw new StoreError("درخواست معتبر نیست.", 403);
    if (
      req.headers["content-length"] !== "0" &&
      req.headers["transfer-encoding"] !== undefined &&
      !req.is("application/json")
    )
      throw new StoreError("نوع درخواست معتبر نیست.", 415);
    if (req.headers["content-type"] && !req.is("application/json"))
      throw new StoreError("نوع درخواست معتبر نیست.", 415);
    next();
  } catch (e) {
    next(e);
  }
};
export function validateProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;
  for (const name of ["SESSION_SECRET", "CUSTOMER_AUTH_SECRET"])
    if ((process.env[name]?.length ?? 0) < 32)
      throw new Error(name + " must contain at least 32 random characters");
  if (!/^[a-f0-9]{64}$/i.test(process.env.ADMIN_MFA_KEY ?? ""))
    throw new Error("ADMIN_MFA_KEY required");
  if (
    !process.env.PUBLIC_ORIGIN ||
    !allowedOrigins().length ||
    allowedOrigins().some((s) => !s.startsWith("https://"))
  )
    throw new Error("Explicit HTTPS origins required");
  if (
    process.env.CUSTOMER_AUTH_DEV_OTP === "true" ||
    process.env.ADMIN_AUTH_DEV_OTP === "true" ||
    process.env.VARSA_ADMIN_PASSWORD
  )
    throw new Error("Remove development OTP and retired shared admin password");
  const serviceKeys = [
    ...(process.env.STORAGE_DRIVER === 'local' ? [] : ['S3_ENDPOINT']),
    ...(process.env.CUSTOMER_SMS_DISABLED === 'true' ? [] : ['CUSTOMER_SMS_URL']),
  ];
  if (process.env.STORAGE_DRIVER === 'local' && !process.env.STORAGE_LOCAL_ROOT?.startsWith('/'))
    throw new Error('Absolute STORAGE_LOCAL_ROOT required');
  for (const key of serviceKeys)
    if (!process.env[key]?.startsWith("https://"))
      throw new Error(key + " requires HTTPS");
  for (const key of [
    ...(process.env.CUSTOMER_SMS_DISABLED === 'true' ? [] : ['CUSTOMER_SMS_TOKEN']),
    ...(process.env.STORAGE_DRIVER === 'local' ? [] : ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']),
  ])
    if (!process.env[key]) throw new Error(key + " required");
  if (process.env.SESSION_SECRET === process.env.CUSTOMER_AUTH_SECRET)
    throw new Error(
      "Use independent customer and general authentication secrets",
    );
  for (const key of serviceKeys) {
    const u = new URL(process.env[key]!);
    if (u.username || u.password || u.search || u.hash)
      throw new Error(
        "Service endpoints must not embed credentials or query secrets",
      );
  }
  for (const key of [
    "SMS_HOURLY_LIMIT",
    "SMS_DAILY_LIMIT",
    "UPLOAD_ACCOUNT_BYTES",
    "UPLOAD_TOTAL_BYTES",
  ])
    if (
      process.env[key] !== undefined &&
      (!Number.isSafeInteger(Number(process.env[key])) ||
        Number(process.env[key]) < 1)
    )
      throw new Error("Invalid positive resource budget: " + key);
}
