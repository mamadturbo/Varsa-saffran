import express from "express";
import { randomUUID, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { db } from "@workspace/db";
import { Secret } from "otpauth";
import {
  createAdminSecurity,
  hashPassword,
  encryptSecret,
  totpFor,
} from "../src/lib/admin-security";
import { issueCsrf, protectMutations } from "../src/lib/http-security";
import { StoreError } from "../src/lib/management-store";
export function mountSecurity(app: express.Express, database: typeof db) {
  const admin = createAdminSecurity(database);
  app.get("/api/csrf", issueCsrf);
  app.use(
    "/api",
    protectMutations,
    admin.resolve,
    admin.router,
    admin.auditMutation,
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res
        .status(error instanceof StoreError ? error.status : 503)
        .json({
          message:
            error instanceof StoreError ? error.message : "درخواست انجام نشد.",
        });
    },
  );
}
export async function secureFetch(url: string, init: RequestInit = {}) {
  if (!["GET", "HEAD", "OPTIONS"].includes(init.method ?? "GET")) {
    const origin = new URL(url).origin;
    const csrf = await fetch(origin + "/api/csrf");
    const token = (await csrf.json()).csrfToken;
    const headers = new Headers(init.headers);
    headers.set("X-Varsa-CSRF", token);
    headers.set(
      "Cookie",
      [csrf.headers.get("set-cookie")!.split(";")[0], headers.get("cookie")]
        .filter(Boolean)
        .join("; "),
    );
    return fetch(url, { ...init, headers });
  }
  return fetch(url, init);
}
export async function seedAdmin(
  database: typeof db,
  password = "isolated-security-password",
) {
  process.env.ADMIN_MFA_KEY ??= randomBytes(32).toString("hex");
  const secret = new Secret({ size: 20 }).base32,
    id = randomUUID();
  await database.execute(
    sql`INSERT INTO admin_accounts(id,username,password_hash,totp_secret) VALUES(${id},'test-admin',${await hashPassword(password)},${encryptSecret(secret)}) ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash,totp_secret=EXCLUDED.totp_secret,last_counter=-1`,
  );
  return { username: "test-admin", password, code: totpFor(secret).generate() };
}
export async function loginAdmin(
  base: string,
  database: typeof db,
  password?: string,
) {
  const input = await seedAdmin(database, password);
  const response = await secureFetch(base + "/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.status !== 200)
    throw new Error("Test MFA login failed: " + response.status);
  return response.headers.get("set-cookie")!.split(";")[0];
}
