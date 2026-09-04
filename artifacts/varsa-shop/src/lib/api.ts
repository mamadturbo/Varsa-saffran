import { supabase } from './supabase';
import type { Article, ContactMessage, Product } from './types';

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function fetchFeaturedProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_featured', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Product[];
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
