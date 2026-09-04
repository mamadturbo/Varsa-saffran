import {
  adminLogin,
  createOrder,
  listAdminOrders,
  updateAdminOrderStatus,
  type CreateOrderRequest,
  type Order,
  type OrderStatus,
} from '@workspace/api-client-react';

export const ADMIN_TOKEN_KEY = 'varsa_admin_token_v1';

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveAdminToken(token: string) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    const message = error.message.replace(/^HTTP \d+ [^:]*:\s*/, '').trim();
    if (message) return message;
  }
  return fallback;
}

export function submitOrder(input: CreateOrderRequest) {
  return createOrder(input);
}

export async function signInAdmin(password: string): Promise<string> {
  const result = await adminLogin({ password });
  return result.token;
}

export async function fetchAdminOrders(status?: OrderStatus): Promise<Order[]> {
  const result = await listAdminOrders(status ? { status } : undefined);
  return result.orders;
}

export async function changeAdminOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const result = await updateAdminOrderStatus(id, { status });
  return result.order;
}