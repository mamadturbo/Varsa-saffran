import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  serial,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { ordersTable, customersTable, customerCasesTable } from "./index";

export const products = pgTable("commerce_products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull(),
});
export const variants = pgTable(
  "product_variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    sku: text("sku").notNull().unique(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    currency: text("currency").notNull().default("IRT"),
    weightMg: integer("weight_mg").notNull(),
    active: boolean("active").notNull(),
    display: jsonb("display").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    index("product_variants_parent_idx").on(t.productId),
    check(
      "variant_values_check",
      sql`${t.price} >= 0 AND ${t.weightMg} > 0 AND ${t.currency} = 'IRT'`,
    ),
  ],
);
export const inventory = pgTable(
  "inventory",
  {
    variantId: text("variant_id")
      .primaryKey()
      .references(() => variants.id),
    available: integer("available"),
    version: integer("version").notNull().default(0),
  },
  (t) => [
    check(
      "inventory_nonnegative",
      sql`${t.available} IS NULL OR ${t.available} >= 0`,
    ),
  ],
);
export const coupons = pgTable(
  "coupons",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    kind: text("kind").notNull(),
    value: integer("value").notNull(),
    minimum: integer("minimum").notNull(),
    limit: integer("usage_limit").notNull(),
    used: integer("used").notNull(),
    expiresAt: text("expires_at").notNull(),
    active: boolean("active").notNull(),
  },
  (t) => [
    check(
      "coupon_values_check",
      sql`${t.kind} IN ('fixed','percent') AND ${t.value} > 0 AND (${t.kind} <> 'percent' OR ${t.value} <= 100) AND ${t.minimum} >= 0 AND ${t.limit} >= 0 AND ${t.used} >= 0`,
    ),
  ],
);
export const orderDetails = pgTable("order_details", {
  orderId: integer("order_id")
    .primaryKey()
    .references(() => ordersTable.id),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull(),
  currency: text("currency").notNull().default("IRT"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  paymentMethod: text("payment_method").notNull().default("manual"),
  fulfillmentStatus: text("fulfillment_status")
    .notNull()
    .default("unfulfilled"),
  addressSnapshot: jsonb("address_snapshot")
    .$type<Record<string, unknown>>()
    .notNull(),
});
export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => ordersTable.id),
    variantId: text("variant_id"),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
  },
  (t) => [
    uniqueIndex("order_items_line_unique").on(t.orderId, t.variantId),
    check(
      "order_items_values_check",
      sql`${t.quantity} > 0 AND ${t.unitPrice} >= 0`,
    ),
  ],
);
export const reservations = pgTable(
  "inventory_reservations",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => ordersTable.id),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
    quantity: integer("quantity").notNull(),
    state: text("state").notNull().default("reserved"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    generation: integer("generation").notNull().default(0),
  },
  (t) => [
    uniqueIndex("reservation_line_unique").on(t.orderId, t.variantId),
    index("reservation_expiry_idx").on(t.state, t.expiresAt),
    check(
      "reservation_values_check",
      sql`${t.quantity} > 0 AND ${t.state} IN ('reserved','released','committed')`,
    ),
  ],
);
export const movements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  variantId: text("variant_id")
    .notNull()
    .references(() => variants.id),
  orderId: integer("order_id").references(() => ordersTable.id),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  eventKey: text("event_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const redemptions = pgTable(
  "coupon_redemptions",
  {
    orderId: integer("order_id")
      .primaryKey()
      .references(() => ordersTable.id),
    couponId: text("coupon_id")
      .notNull()
      .references(() => coupons.id),
    discount: integer("discount").notNull(),
  },
  (t) => [index("coupon_redemptions_coupon_idx").on(t.couponId)],
);
export const contentEntries = pgTable(
  "content_entries",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    slug: text("slug"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    uniqueIndex("content_kind_slug_unique").on(t.kind, t.slug),
    index("content_kind_idx").on(t.kind),
  ],
);
export const storeConfig = pgTable("store_config", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull(),
  articlesImported: boolean("articles_imported").notNull().default(false),
  articlesInitialized: boolean("articles_initialized").notNull().default(false),
});
export const outbox = pgTable(
  "outbox",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    leaseToken: text("lease_token"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("outbox_claim_idx").on(t.status, t.availableAt),
    check(
      "outbox_state_check",
      sql`${t.status} IN ('pending','processing','completed','failed') AND ${t.attempts} >= 0`,
    ),
  ],
);
export const files = pgTable(
  "stored_files",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").references(() => customersTable.id),
    visibility: text("visibility").notNull(),
    objectKey: text("object_key").notNull().unique(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "stored_files_owner_check",
      sql`(${t.visibility} = 'public' AND ${t.ownerId} IS NULL) OR (${t.visibility} = 'private' AND ${t.ownerId} IS NOT NULL)`,
    ),
  ],
);
export const contactMessages = pgTable("contact_messages_api", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const customerAddresses = pgTable(
  "customer_addresses",
  {
    customerId: text("customer_id")
      .notNull()
      .references(() => customersTable.id),
    id: text("id").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [uniqueIndex("customer_addresses_owner_id").on(t.customerId, t.id)],
);
export const customerFavorites = pgTable(
  "customer_favorites",
  {
    customerId: text("customer_id")
      .notNull()
      .references(() => customersTable.id),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
  },
  (t) => [
    uniqueIndex("customer_favorites_owner_variant").on(
      t.customerId,
      t.variantId,
    ),
  ],
);
export const caseMessages = pgTable("case_messages", {
  id: text("id").primaryKey(),
  caseId: text("case_id")
    .notNull()
    .references(() => customerCasesTable.id),
  author: text("author").notNull(),
  body: text("body").notNull(),
  attachments: jsonb("attachments").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
export const paymentAttempts = pgTable("payment_attempts", {
  id: text("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id),
  provider: text("provider").notNull(),
  providerReference: text("provider_reference").unique(),
  status: text("status").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const schemaMigrations = pgTable("schema_migrations", {
  version: text("version").primaryKey(),
  sha256: text("sha256").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cardTransferReceipts = pgTable("card_transfer_receipts", {
  id: text("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  objectKey: text("object_key").notNull().unique(),
  sha256: text("sha256").notNull(),
  size: integer("size").notNull(),
  status: text("status").notNull().default("pending"),
  amount: integer("amount").notNull(),
  destination: jsonb("destination").$type<Record<string, string>>().notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("card_receipts_order_idx").on(t.orderId, t.createdAt),
  uniqueIndex("card_receipts_pending_idx").on(t.orderId).where(sql`${t.status}='pending'`),
  index("card_receipts_sha_idx").on(t.sha256),
  check("card_receipts_values_check", sql`${t.size}>0 AND ${t.amount}>=0 AND ${t.status} IN ('pending','approved','rejected')`),
]);
export const baleBotState = pgTable("bale_bot_state", {
  id: text("id").primaryKey(),
  nextOffset: integer("next_offset").notNull().default(0),
});
