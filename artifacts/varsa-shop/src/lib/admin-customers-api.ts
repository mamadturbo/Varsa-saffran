import { customerRequest } from "./customer-api";
import type { PaymentStatus } from "./management-api";

export type CustomerContact = {
  id: string;
  name: string;
  phone: string;
  orderCount: number;
  paidTotal: string;
  lastOrderAt: string;
  nextDueAt: string | null;
};
export type Followup = {
  id: string;
  text: string;
  createdAt: string;
  dueAt: string | null;
  completedAt: string | null;
};
export type ContactHistory = {
  orders: Array<{
    id: number;
    orderNumber: string;
    createdAt: string;
    total: number;
    status: string;
    paymentStatus: PaymentStatus | null;
  }>;
  followups: Followup[];
  nextCursor: string | null;
};

const root = "/admin/customers";
const profilePath = (id: string) => `${root}/${encodeURIComponent(id)}`;

export function listCustomerContacts(
  query: string,
  due: boolean,
  after?: string,
) {
  const params = new URLSearchParams({ q: query, due: String(due) });
  if (after) params.set("after", after);
  return customerRequest<{
    contacts: CustomerContact[];
    nextCursor: string | null;
  }>(`${root}?${params}`);
}
export const readContactHistory = (id: string, before?: string) =>
  customerRequest<ContactHistory>(
    `${profilePath(id)}${before ? `?before=${encodeURIComponent(before)}` : ""}`,
  );
export const createFollowup = (
  id: string,
  text: string,
  dueAt: string | null,
) =>
  customerRequest<{ followup: Followup }>(
    `${profilePath(id)}/followups`,
    "POST",
    { text, dueAt },
  );
export const changeFollowup = (
  id: string,
  followup: string,
  data: { dueAt: string } | { complete: true },
) =>
  customerRequest<{ followup: Followup }>(
    `${profilePath(id)}/followups/${encodeURIComponent(followup)}`,
    "PATCH",
    data,
  );
