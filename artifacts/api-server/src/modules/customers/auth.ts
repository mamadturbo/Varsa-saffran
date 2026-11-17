import { readProfile } from "./repository";
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, gt, lt, sql, inArray, asc } from "drizzle-orm";
import type { Request, Response } from "express";
import type { db } from "@workspace/db";
import {
  customersTable,
  customerSessionsTable,
  customerOtpsTable,
  customerRateTable,
} from "@workspace/db/schema";
import type { Customer, CustomerProfile } from "@workspace/catalog";
import { normalizeIranMobile } from "@workspace/validation";
import { StoreError } from "../../lib/management-store";
import { clientNetwork } from "../../lib/admin-login-limit";
import { reserveSms } from '../../lib/sms-budget';

const COOKIE = "varsa_customer_session";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function secret() {
  const s = process.env.CUSTOMER_AUTH_SECRET || process.env.SESSION_SECRET;
  if (!s)
    throw new StoreError("ورود مشتری هنوز روی میزبان تنظیم نشده است.", 503);
  return s;
}
const digest = (phone: string, code: string) =>
  createHmac("sha256", secret())
    .update(`customer-otp:${phone}:${code}`)
    .digest("hex");
export function developmentOtpEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.CUSTOMER_AUTH_DEV_OTP === "true"
  );
}
export async function sendCustomerSms(
  phone: string,
  message: string,
  code?: string,
  eventId?: string,
) {
  if (process.env.CUSTOMER_SMS_DISABLED === 'true')
    throw new StoreError('سرویس پیامک هنوز فعال نشده است.', 503);
  const endpoint = process.env.CUSTOMER_SMS_URL;
  const token = process.env.CUSTOMER_SMS_TOKEN;
  if (!endpoint || !token || !endpoint.startsWith("https://"))
    throw new StoreError("سرویس پیامک هنوز تنظیم نشده است.", 503);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      phone,
      message,
      ...(code
        ? { code, purpose: "otp" }
        : { purpose: "notification", eventId }),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new StoreError(
      "ارسال پیامک انجام نشد. کمی بعد دوباره تلاش کنید.",
      503,
    );
}
export { enforceRequestOrigin as enforceCustomerOrigin } from "../../lib/http-security";
export function createCustomerAuth(
  database: typeof db,
  sender = sendCustomerSms,
) {
  const sessionToken = (req: Request) => {
    const raw = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    return raw && /^[A-Za-z0-9_-]{43}$/.test(raw) ? raw : null;
  };
  const read = async (req: Request): Promise<Customer | null> => {
    const token = sessionToken(req);
    if (!token) return null;
    const [row] = await database
      .select({
        id: customersTable.id,
        phone: customersTable.phone,
        profile: customersTable.profile,
      })
      .from(customerSessionsTable)
      .innerJoin(
        customersTable,
        eq(customersTable.id, customerSessionsTable.customerId),
      )
      .where(
        and(
          eq(customerSessionsTable.tokenHash, hash(token)),
          gt(customerSessionsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return row ? { ...row, profile: await readProfile(database, row) } : null;
  };
  const requireCustomer = async (req: Request) => {
    const c = await read(req);
    if (!c) throw new StoreError("برای ادامه وارد حساب خود شوید.", 401);
    return c;
  };
  const limit = async (bucket: string, maximum: number, seconds: number) => {
    const key = createHmac("sha256", secret()).update(bucket).digest("hex");
    const rows = await database.execute(
      sql`INSERT INTO customer_rate_limits(bucket,attempts,expires_at) VALUES(${key},1,CURRENT_TIMESTAMP + ${seconds} * interval '1 second') ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN customer_rate_limits.expires_at<=CURRENT_TIMESTAMP THEN 1 ELSE customer_rate_limits.attempts+1 END, expires_at=CASE WHEN customer_rate_limits.expires_at<=CURRENT_TIMESTAMP THEN EXCLUDED.expires_at ELSE customer_rate_limits.expires_at END WHERE customer_rate_limits.expires_at<=CURRENT_TIMESTAMP OR customer_rate_limits.attempts<${maximum} RETURNING attempts`,
    );
    if (!rows.rows.length)
      throw new StoreError(
        "تعداد تلاش‌ها زیاد است. کمی بعد دوباره امتحان کنید.",
        429,
      );
  };
  const requestCode = async (req: Request, raw: unknown) => {
    const phone = normalizeIranMobile(raw);
    if (!phone) throw new StoreError("شماره موبایل معتبر ایران وارد کنید.");
    const development = developmentOtpEnabled();
    if (
      !development &&
      (!process.env.CUSTOMER_SMS_URL || !process.env.CUSTOMER_SMS_TOKEN)
    )
      throw new StoreError("ورود پیامکی هنوز روی میزبان تنظیم نشده است.", 503);
    await limit(`otp-global`, 1000, 3600);
    await limit(
      `otp-ip:${clientNetwork(req.ip ?? req.socket.remoteAddress ?? "")}`,
      20,
      3600,
    );
    await limit(`otp-hour:${phone}`, 8, 3600);
    await limit(`otp-minute:${phone}`, 1, 60);
    const old = new Date(Date.now() - 86400000);
    await database
      .delete(customerOtpsTable)
      .where(lt(customerOtpsTable.expiresAt, old));
    await database
      .delete(customerRateTable)
      .where(lt(customerRateTable.expiresAt, old));
    await database
      .delete(customerSessionsTable)
      .where(lt(customerSessionsTable.expiresAt, new Date()));
    const code = String(randomInt(100000, 1000000));
    await database
      .insert(customerOtpsTable)
      .values({
        phone,
        digest: digest(phone, code),
        attempts: 0,
        expiresAt: new Date(Date.now() + 120000),
      })
      .onConflictDoUpdate({
        target: customerOtpsTable.phone,
        set: {
          digest: digest(phone, code),
          attempts: 0,
          expiresAt: new Date(Date.now() + 120000),
        },
      });
    if (!development) {
      await reserveSms(database,'otp');
      await sender(phone, `کد ورود به ورسا: ${code}\nاعتبار: ۲ دقیقه`, code);
    }
    return {
      phone,
      expiresIn: 120,
      retryAfter: 60,
      ...(development ? { developmentCode: code } : {}),
    };
  };
  const verify = async (
    req: Request,
    res: Response,
    rawPhone: unknown,
    rawCode: unknown,
  ) => {
    const phone = normalizeIranMobile(rawPhone);
    const code =
      typeof rawCode === "string"
        ? rawCode.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
        : "";
    if (!phone || !/^\d{6}$/.test(code))
      throw new StoreError("شماره موبایل یا کد ورود نامعتبر است.");
    // Bound both guessing and bucket growth when clients rotate target numbers.
    // The network cap is deliberately broader than the per-phone allowance.
    await limit('verify-global',3000,900);
    await limit(`verify-network:${clientNetwork(req.ip??req.socket.remoteAddress??'')}`,150,900);
    await limit(`verify:${phone}`, 15, 900);
    const result = await database.transaction(async (rawTx) => {
      const tx = rawTx as unknown as typeof database;
      const [otp] = await tx
        .select()
        .from(customerOtpsTable)
        .where(eq(customerOtpsTable.phone, phone))
        .for("update");
      if (!otp || otp.expiresAt.getTime() <= Date.now() || otp.attempts >= 5)
        return null;
      await tx
        .update(customerOtpsTable)
        .set({ attempts: otp.attempts + 1 })
        .where(eq(customerOtpsTable.phone, phone));
      if (
        !timingSafeEqual(
          Buffer.from(otp.digest),
          Buffer.from(digest(phone, code)),
        )
      )
        return null;
      await tx
        .delete(customerOtpsTable)
        .where(eq(customerOtpsTable.phone, phone));
      await tx
        .insert(customersTable)
        .values({
          id: randomUUID(),
          phone,
          profile: {
            name: "",
            email: "",
            addresses: [],
            favorites: [],
            smsUpdates: false,
          },
        })
        .onConflictDoNothing({ target: customersTable.phone });
      const [row] = await tx
        .select()
        .from(customersTable)
        .where(eq(customersTable.phone, phone));
      const token = randomBytes(32).toString("base64url");
      await tx.insert(customerSessionsTable).values({
        tokenHash: hash(token),
        customerId: row.id,
        expiresAt: new Date(Date.now() + 30 * 86400000),
      });
      return {
        token,
        customer: {
          id: row.id,
          phone: row.phone,
          profile: await readProfile(tx, row),
        },
      };
    });
    if (!result)
      throw new StoreError("کد ورود اشتباه، منقضی یا قبلاً استفاده شده است.");
    res.cookie(COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 86400000,
    });
    return result.customer;
  };
  const logout = async (req: Request, res: Response) => {
    const token = sessionToken(req);
    if (token)
      await database
        .delete(customerSessionsTable)
        .where(eq(customerSessionsTable.tokenHash, hash(token)));
    res.clearCookie(COOKIE, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  };
  const changePhone = async(req:Request,res:Response,raw:unknown) => {
    const customer=await requireCustomer(req);
    const b=raw as Record<string,unknown>;
    const phone=normalizeIranMobile(b?.phone);
    if(!phone || phone===customer.phone || typeof b.oldCode!=='string' || typeof b.newCode!=='string' || !/^\d{6}$/.test(b.oldCode) || !/^\d{6}$/.test(b.newCode))throw new StoreError('شماره و کدهای تأیید معتبر وارد کنید.');
    await limit(`phone-change:${customer.id}`,5,3600);
    const changed=await database.transaction(async rawTx=>{
      const tx=rawTx as unknown as typeof database;
      const [owner]=await tx.select().from(customersTable).where(eq(customersTable.id,customer.id)).for('update');
      if(!owner || owner.phone!==customer.phone)return false;
      const rows=await tx.select().from(customerOtpsTable).where(inArray(customerOtpsTable.phone,[customer.phone,phone])).orderBy(asc(customerOtpsTable.phone)).for('update');
      let valid=rows.length===2;
      for(const row of rows){
        if(row.attempts>=5 || row.expiresAt.getTime()<=Date.now()){valid=false;continue;}
        await tx.update(customerOtpsTable).set({attempts:row.attempts+1}).where(eq(customerOtpsTable.phone,row.phone));
        const code=row.phone===phone?b.newCode:b.oldCode;
        if(!timingSafeEqual(Buffer.from(row.digest),Buffer.from(digest(row.phone,code as string))))valid=false;
      }
      if(!valid)return false;
      const existing=await tx.select({id:customersTable.id}).from(customersTable).where(eq(customersTable.phone,phone));
      if(existing.length)throw new StoreError('این شماره به حساب دیگری تعلق دارد؛ ادغام حساب از این مسیر ممکن نیست.',409);
      await tx.update(customersTable).set({phone}).where(eq(customersTable.id,customer.id));
      await tx.delete(customerOtpsTable).where(inArray(customerOtpsTable.phone,[phone,customer.phone]));
      await tx.delete(customerSessionsTable).where(eq(customerSessionsTable.customerId,customer.id));
      await tx.execute(sql`INSERT INTO security_audit(event) VALUES('customer_phone_changed')`);
      return true;
    });
    if(!changed)throw new StoreError('کدها اشتباه، منقضی یا قبلاً استفاده شده‌اند.');
    res.clearCookie(COOKIE,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'});
  };
  return { read, requireCustomer, requestCode, verify, logout, limit, changePhone };
}
export type CustomerAuth = ReturnType<typeof createCustomerAuth>;

