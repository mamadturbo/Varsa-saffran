import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customerContacts, ordersTable } from "./index";

export const customerFollowups = pgTable(
  "customer_followups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => customerContacts.id),
    text: text("text").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("customer_followups_contact_idx").on(
      t.contactId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    index("customer_followups_due_idx")
      .on(t.dueAt, t.id)
      .where(sql`${t.dueAt} IS NOT NULL AND ${t.completedAt} IS NULL`),
    check(
      "customer_followups_text_check",
      sql`length(btrim(${t.text})) BETWEEN 1 AND 2000`,
    ),
    check(
      "customer_followups_completion_check",
      sql`${t.completedAt} IS NULL OR ${t.dueAt} IS NOT NULL`,
    ),
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    orderId: integer("order_id")
      .primaryKey()
      .references(() => ordersTable.id),
    carrier: text("carrier"),
    trackingCode: text("tracking_code"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "shipments_carrier_check",
      sql`${t.carrier} IS NULL OR length(btrim(${t.carrier})) BETWEEN 1 AND 100`,
    ),
    check(
      "shipments_tracking_code_check",
      sql`${t.trackingCode} IS NULL OR length(btrim(${t.trackingCode})) BETWEEN 1 AND 100`,
    ),
    check(
      "shipments_dates_check",
      sql`${t.deliveredAt} IS NULL OR ${t.shippedAt} IS NULL OR ${t.deliveredAt} >= ${t.shippedAt}`,
    ),
  ],
);

export const orderEventKinds = [
  "order_created",
  "status_changed",
  "receipt_submitted",
  "receipt_reviewed",
  "shipment_updated",
] as const;
export type OrderEventKind = (typeof orderEventKinds)[number];

export const orderEvents = pgTable(
  "order_events",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => ordersTable.id),
    kind: text("kind").$type<OrderEventKind>().notNull(),
    value: text("value"),
    actor: text("actor").notNull(),
    eventKey: text("event_key").unique(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("order_events_order_idx").on(t.orderId, t.occurredAt, t.id),
    check(
      "order_events_kind_check",
      sql`${t.kind} IN ('order_created','status_changed','receipt_submitted','receipt_reviewed','shipment_updated')`,
    ),
  ],
);
