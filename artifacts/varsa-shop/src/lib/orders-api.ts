import {
  customFetch,
  createOrder,
  listAdminOrders,
  updateAdminOrderStatus,
  type CreateOrderRequest,
  type Order,
  type OrderStatus,
} from '@workspace/api-client-react';
import { parseOrderReceipt } from './order-receipt';

export function readAdminSession() {
  return customFetch<{authenticated:boolean;enrollmentRequired:boolean}>('/api/admin/session');
}

export async function signOutAdmin() {
  await customFetch('/api/admin/logout', { method: 'POST' });
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    const message = error.message.replace(/^HTTP \d+ [^:]*:\s*/, '').trim();
    if (message) return message;
  }
  return fallback;
}

export async function submitOrder(input: CreateOrderRequest & { couponCode?: string }) {
  const result = await createOrder(input, { signal: AbortSignal.timeout(20_000) });
  return parseOrderReceipt(result);
}

export async function signInAdmin(password: string, username: string, code: string, recoveryCode: string) {
  return customFetch<{authenticated:boolean;enrollmentRequired:boolean}>('/api/admin/login', {
    method:'POST', body:JSON.stringify({password,username,code,recoveryCode}), signal:AbortSignal.timeout(20000)
  });
}

export function getAdminLoginRetryAfter(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const response = error as { status?: unknown; headers?: Headers };
  if (response.status !== 429) return null;
  const seconds = Number(response.headers?.get('Retry-After'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(900, Math.ceil(seconds)) : 900;
}

export async function fetchAdminOrders(status?: OrderStatus): Promise<Order[]> {
  const result = await listAdminOrders(status ? { status } : undefined);
  return result.orders;
}

export async function changeAdminOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const result = await updateAdminOrderStatus(id, { status });
  return result.order;
}
