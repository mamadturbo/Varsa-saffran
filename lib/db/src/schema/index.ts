import { sql } from 'drizzle-orm';
export * from './commerce';
import { check, index, uniqueIndex, integer, jsonb, pgTable, serial, text, timestamp, varchar, boolean } from "drizzle-orm/pg-core";

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
}

export const ordersTable = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: varchar("order_number", { length: 32 }).notNull().unique(),
    idempotencyKey: varchar("idempotency_key", { length: 36 }),
    requestFingerprint: varchar("request_fingerprint", { length: 64 }),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    address: text("address").notNull(),
    items: jsonb("items").$type<OrderItem[]>().notNull(),
    total: integer("total").notNull(),
    status: varchar("status", { length: 20 }).$type<OrderStatus>().notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("orders_status_idx").on(table.status),
    createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
    idempotencyIdx: uniqueIndex("orders_idempotency_key_unique").on(table.idempotencyKey),
  }),
);

export type Order = typeof ordersTable.$inferSelect;
export type NewOrder = typeof ordersTable.$inferInsert;

export const storeManagementTable = pgTable('store_management', {
  id: text('id').primaryKey(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
});
export const storeMediaTable = pgTable('store_media', {
  id: text('id').primaryKey(), mime: text('mime').notNull(), data: text('data').notNull(),
});

export const adminLoginAttemptsTable = pgTable('admin_login_attempts', {
  bucket: varchar('bucket', { length: 80 }).primaryKey(),
  attempts: integer('attempts').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => ({
  expiresIdx: index('admin_login_attempts_expires_idx').on(table.expiresAt),
  positiveAttempts: check('admin_login_attempts_attempts_check', sql`${table.attempts} > 0`),
}));

export const customersTable = pgTable('customers', {
  id: text('id').primaryKey(), phone: text('phone').notNull().unique(),
  profile: jsonb('profile').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
export const customerSessionsTable = pgTable('customer_sessions', {
  tokenHash: text('token_hash').primaryKey(), customerId: text('customer_id').notNull().references(() => customersTable.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
export const customerOtpsTable = pgTable('customer_otps', {
  phone: text('phone').primaryKey(), digest: text('digest').notNull(), attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
export const customerRateTable = pgTable('customer_rate_limits', {
  bucket: text('bucket').primaryKey(), attempts: integer('attempts').notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
export const customerOrderLinksTable = pgTable('customer_order_links', {
  orderId: integer('order_id').primaryKey().references(() => ordersTable.id), customerId: text('customer_id').notNull().references(() => customersTable.id),
}, t => ({ customerIdx: index('customer_order_links_customer_idx').on(t.customerId) }));
export const customerCasesTable = pgTable('customer_cases', {
  id: text('id').primaryKey(), customerId: text('customer_id').notNull().references(() => customersTable.id),
  orderId: integer('order_id').references(() => ordersTable.id), kind: text('kind').notNull(), status: text('status').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ customerIdx: index('customer_cases_customer_idx').on(t.customerId) }));
export const customerNotificationsTable = pgTable('customer_notifications', {
  id: serial('id').primaryKey(), customerId: text('customer_id').notNull().references(() => customersTable.id),
  title: text('title').notNull(), message: text('message').notNull(), orderId: integer('order_id'),
  readAt: timestamp('read_at', { withTimezone: true }), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  smsStatus: text('sms_status').notNull().default('disabled'),
  smsAttemptAt: timestamp('sms_attempt_at', { withTimezone: true }),
}, t => ({ customerIdx: index('customer_notifications_customer_idx').on(t.customerId) }));
export const customerReviewsTable = pgTable('customer_reviews', {
  id: text('id').primaryKey(), customerId: text('customer_id').notNull().references(() => customersTable.id), productId: text('product_id').notNull(),
  rating: integer('rating').notNull(), body: text('body').notNull(), author: text('author').notNull(), published: boolean('published').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ ownerProduct: uniqueIndex('customer_reviews_owner_product_idx').on(t.customerId,t.productId), productIdx: index('customer_reviews_product_idx').on(t.productId) }));
export const customerMediaTable = pgTable('customer_media', {
  id: text('id').primaryKey(), customerId: text('customer_id').notNull().references(() => customersTable.id), mime: text('mime').notNull(), data: text('data').notNull(),
});
