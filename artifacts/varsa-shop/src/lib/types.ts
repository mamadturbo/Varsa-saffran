export type ProductCategory =
  | 'سوپر نگین'
  | 'نگین'
  | 'شبه نگین'
  | 'سرگل'
  | 'پوشال'
  | 'رشته'
  | 'هدیه';

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  short_description: string;
  long_description: string | null;
  crocin: number;
  picrocrocin: number;
  safranal: number;
  weight: number;
  weight_unit: string;
  price: number;
  image_url: string;
  is_featured: boolean;
  sort_order: number;
}

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
