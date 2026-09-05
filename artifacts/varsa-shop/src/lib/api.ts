import { supabase } from './supabase';
import { LOCAL_PRODUCTS } from './catalog';
import type { Article, ContactMessage, Product } from './types';

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true });

  const activeSlugs = new Set(LOCAL_PRODUCTS.map((product) => product.slug));
  const remoteProducts = error
    ? []
    : ((data ?? []) as Product[]).filter((product) => activeSlugs.has(product.slug));
  const productsBySlug = new Map(remoteProducts.map((product) => [product.slug, product]));

  for (const product of LOCAL_PRODUCTS) {
    productsBySlug.set(product.slug, product);
  }

  return [...productsBySlug.values()].sort((a, b) => a.sort_order - b.sort_order);
}

export async function fetchFeaturedProducts(): Promise<Product[]> {
  const products = await fetchProducts();
  return products.filter((product) => product.is_featured);
}

export async function fetchArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Article[];
}

export async function fetchArticleBySlug(slug: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Article) ?? null;
}

export async function submitContact(msg: ContactMessage): Promise<void> {
  const { error } = await supabase.from('contact_messages').insert({
    name: msg.name,
    phone: msg.phone,
    subject: msg.subject,
    message: msg.message,
  });
  if (error) throw error;
}
