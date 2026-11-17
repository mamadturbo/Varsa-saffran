export interface CustomerAddress {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
  isDefault: boolean;
}
export interface CustomerProfile {
  name: string;
  email: string;
  addresses: CustomerAddress[];
  favorites: string[];
  smsUpdates: boolean;
}
export interface Customer {
  id: string;
  phone: string;
  profile: CustomerProfile;
}
export interface CaseMessage {
  id: string;
  author: "customer" | "admin";
  text: string;
  images: string[];
  createdAt: string;
}
export interface CasePayload {
  subject: string;
  messages: CaseMessage[];
  resolution: string;
}
export interface CustomerCase {
  id: string;
  customerId: string;
  orderId: number | null;
  kind: "ticket" | "cancel" | "return";
  status:
    "waiting_admin" | "waiting_customer" | "closed" | "approved" | "rejected";
  payload: CasePayload;
  createdAt: string;
  updatedAt: string;
}
export interface CustomerNotification {
  id: number;
  customerId: string;
  title: string;
  message: string;
  orderId: number | null;
  readAt: string | null;
  createdAt: string;
  smsStatus: string;
}
export interface ProductReview {
  id: string;
  customerId: string;
  productId: string;
  rating: number;
  body: string;
  published: boolean;
  author: string;
  updatedAt: string;
}
