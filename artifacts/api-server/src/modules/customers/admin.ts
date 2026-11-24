import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import {
  customerContacts,
  customerFollowups,
  orderDetails,
  ordersTable,
} from "@workspace/db/schema";
import { normalizeIranMobile } from "@workspace/validation";
import { adminIdentity } from "../../lib/admin-auth";
import { StoreError } from "../../lib/management-store";
import type { Database } from "../catalog/repository";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pageSize = 25;

function readId(value: unknown) {
  if (typeof value !== "string" || !uuid.test(value))
    throw new StoreError("شناسهٔ پرونده یا پیگیری نامعتبر است.", 400);
  return value;
}

function dueDate(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  )
    throw new StoreError("موعد پیگیری نامعتبر است.");
  const result = new Date(value);
  if (!Number.isFinite(result.valueOf()) || result.toISOString() !== value)
    throw new StoreError("موعد پیگیری نامعتبر است.");
  return result;
}

function body(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    throw new StoreError("اطلاعات واردشده نامعتبر است.");
  return req.body;
}

type ContactRow = {
  id: string;
  phone: string;
  name: string;
  orderCount: number;
  paidTotal: string;
  lastOrderAt: string;
  nextDueAt: string | null;
};

export function adminCustomerContacts(database: Database) {
  const router = Router();
  const route =
    (
      handle: (
        req: Request,
        res: Response,
        adminId: string,
      ) => Promise<unknown>,
    ) =>
    async (req: Request, res: Response) => {
      const admin = adminIdentity(req);
      if (!admin?.complete) throw new StoreError("دسترسی مدیر لازم است.", 401);
      res.set("Cache-Control", "no-store");
      await handle(req, res, admin.id);
    };

  router.get(
    "/admin/customers",
    route(async (req, res) => {
      const query =
        typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
      const phoneQuery = normalizeIranMobile(query) ?? query;
      const after = req.query.after;
      if (
        after !== undefined &&
        (typeof after !== "string" || !/^09[0-9]{9}$/.test(after))
      )
        throw new StoreError("صفحهٔ درخواستی نامعتبر است.");
      const onlyDue = req.query.due === "true";
      const result = await database.execute<ContactRow>(sql`
      SELECT c.id,c.phone,last_order.customer_name AS name,last_order.created_at AS "lastOrderAt",
        stats.order_count AS "orderCount",stats.paid_total AS "paidTotal",next_task.due_at AS "nextDueAt"
      FROM customer_contacts c
      JOIN LATERAL (
        SELECT customer_name,created_at FROM orders WHERE customer_contact_id=c.id
        ORDER BY created_at DESC,id DESC LIMIT 1
      ) last_order ON true
      LEFT JOIN LATERAL (
        SELECT due_at FROM customer_followups
        WHERE contact_id=c.id AND due_at IS NOT NULL AND completed_at IS NULL
        ORDER BY due_at,id LIMIT 1
      ) next_task ON true
      CROSS JOIN LATERAL (
        SELECT count(*)::int AS order_count,
          coalesce(sum(o.total) FILTER (WHERE d.payment_status='paid'),0)::text AS paid_total
        FROM orders o LEFT JOIN order_details d ON d.order_id=o.id
        WHERE o.customer_contact_id=c.id
      ) stats
      WHERE c.phone > ${after ?? ""}
        AND (${query}='' OR strpos(c.phone,translate(${phoneQuery},'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789')) > 0
          OR EXISTS (
            SELECT 1 FROM orders p WHERE p.customer_contact_id=c.id
            AND strpos(lower(p.customer_name),lower(${query})) > 0
          ))
        AND (NOT ${onlyDue} OR next_task.due_at <= now())
      ORDER BY c.phone LIMIT ${pageSize + 1}
    `);
      const contacts = result.rows.slice(0, pageSize);
      res.json({
        contacts,
        nextCursor:
          result.rows.length > pageSize ? contacts.at(-1)?.phone : null,
      });
    }),
  );

  router.get(
    "/admin/customers/:id",
    route(async (req, res) => {
      const id = readId(req.params.id);
      const before = req.query.before;
      let cursorCondition;
      if (before !== undefined) {
        const [date, rawId, extra] =
          typeof before === "string" ? before.split("|") : [];
        const orderId = Number(rawId);
        if (
          !date ||
          !/^[0-9]{1,10}$/.test(rawId) ||
          extra !== undefined ||
          orderId < 1 ||
          orderId > 2147483647
        )
          throw new StoreError("صفحهٔ درخواستی نامعتبر است.");
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(date))
          throw new StoreError("صفحهٔ درخواستی نامعتبر است.");
        dueDate(date.slice(0, -4) + "Z");
        cursorCondition = sql`(${ordersTable.createdAt},${ordersTable.id}) < (${date}::timestamptz,${orderId})`;
      }
      const [contact] = await database
        .select()
        .from(customerContacts)
        .where(eq(customerContacts.id, id));
      if (!contact) throw new StoreError("پروندهٔ مشتری پیدا نشد.", 404);
      const [history, followups] = await Promise.all([
        database
          .select({
            cursorDate: sql<string>`to_char(${ordersTable.createdAt} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            id: ordersTable.id,
            orderNumber: ordersTable.orderNumber,
            status: ordersTable.status,
            total: ordersTable.total,
            createdAt: ordersTable.createdAt,
            paymentStatus: orderDetails.paymentStatus,
          })
          .from(ordersTable)
          .leftJoin(orderDetails, eq(orderDetails.orderId, ordersTable.id))
          .where(and(eq(ordersTable.customerContactId, id), cursorCondition))
          .orderBy(desc(ordersTable.createdAt), desc(ordersTable.id))
          .limit(pageSize + 1),
        before === undefined
          ? database
              .select()
              .from(customerFollowups)
              .where(eq(customerFollowups.contactId, id))
              .orderBy(
                desc(customerFollowups.createdAt),
                desc(customerFollowups.id),
              )
          : [],
      ]);
      const orders = history.slice(0, pageSize);
      const last = orders.at(-1);
      res.json({
        contact,
        orders: orders.map(({ cursorDate: _cursor, ...order }) => order),
        followups,
        nextCursor:
          history.length > pageSize && last
            ? `${last.cursorDate}|${last.id}`
            : null,
      });
    }),
  );

  router.post(
    "/admin/customers/:id/followups",
    route(async (req, res, adminId) => {
      const contactId = readId(req.params.id);
      const data = body(req);
      const note = typeof data.text === "string" ? data.text.trim() : "";
      if (!note || note.length > 2000)
        throw new StoreError("متن پیگیری باید بین ۱ تا ۲۰۰۰ نویسه باشد.");
      const dueAt = data.dueAt == null ? null : dueDate(data.dueAt);
      const [contact] = await database
        .select({ id: customerContacts.id })
        .from(customerContacts)
        .where(eq(customerContacts.id, contactId));
      if (!contact) throw new StoreError("پروندهٔ مشتری پیدا نشد.", 404);
      const [followup] = await database
        .insert(customerFollowups)
        .values({ contactId, text: note, dueAt, createdBy: adminId })
        .returning();
      res.status(201).json({ followup });
    }),
  );

  router.patch(
    "/admin/customers/:id/followups/:followupId",
    route(async (req, res) => {
      const contactId = readId(req.params.id);
      const id = readId(req.params.followupId);
      const data = body(req);
      const change =
        data.complete === true
          ? { completedAt: new Date() }
          : { dueAt: dueDate(data.dueAt) };
      const match = and(
        eq(customerFollowups.id, id),
        eq(customerFollowups.contactId, contactId),
      );
      const [followup] = await database
        .update(customerFollowups)
        .set(change)
        .where(
          and(
            match,
            sql`${customerFollowups.dueAt} IS NOT NULL`,
            isNull(customerFollowups.completedAt),
          ),
        )
        .returning();
      if (followup) {
        res.json({ followup });
        return;
      }
      const [current] = await database
        .select()
        .from(customerFollowups)
        .where(match);
      if (current?.completedAt && data.complete === true) {
        res.json({ followup: current });
        return;
      }
      throw new StoreError("پیگیری باز برای این پرونده پیدا نشد.", 404);
    }),
  );
  return router;
}
