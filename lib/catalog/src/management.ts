import type { CatalogProduct } from "./products.ts";

export interface ManagedProduct extends CatalogProduct {
  stockRevision?: number;
  active: boolean;
  stock: number | null;
}
export interface ManagedArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  image_url: string;
  author: string;
  category: string;
  read_time: number;
  created_at: string;
  published: boolean;
}
export interface Banner {
  id: string;
  image: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  link: string;
  active: boolean;
}
export interface Coupon {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  minimum: number;
  expiresAt: string;
  limit: number;
  used: number;
  active: boolean;
}
export interface StoreSettings {
  returnWindowDays?: number;
  transactionalSmsEnabled?: boolean;
  phone: string;
  email: string;
  address: string;
  instagram: string;
  telegram: string;
  shippingEnabled: boolean;
  shippingFee: number;
  freeShippingAbove: number;
}
export interface OrderPricing {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode: string;
  shippingConfigured: boolean;
}
export interface OrderMeta extends OrderPricing {
  deliveredAt?: string;
  trackingCode: string;
  reserved: boolean;
  inventoryTracked?: boolean;
  stockItems?: Record<string, number>;
}
export interface ManagementState {
  legacyArticlesEnabled?: boolean;
  revision: number;
  products: ManagedProduct[];
  articles: ManagedArticle[] | null;
  banners: Banner[];
  coupons: Coupon[];
  settings: StoreSettings;
  orderMeta: Record<string, OrderMeta>;
}
