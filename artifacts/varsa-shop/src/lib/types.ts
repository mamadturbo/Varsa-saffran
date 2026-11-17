export type { ProductCategory, CatalogProduct as Product } from '@workspace/catalog';
import type { CatalogProduct as Product } from '@workspace/catalog';

export interface Article {
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
}

export interface ContactMessage {
  name: string;
  phone: string;
  subject: string;
  message: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
