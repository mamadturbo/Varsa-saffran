export const PHONE_INPUT_MAX_LENGTH = 64;
export * from './contacts';
export const MAX_PRODUCT_QUANTITY = 99;
export const MAX_ORDER_LINES = 50;

export function isOrderQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= MAX_PRODUCT_QUANTITY;
}
export const MOBILE_PHONE_ERROR = 'شماره موبایل معتبر ایران وارد کنید؛ مانند ۰۹۱۲۳۴۵۶۷۸۹.';

// Validate formatting without guessing missing digits or removing arbitrary
// characters. A valid result is always an 11-digit national mobile number.
export function normalizeIranMobile(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > PHONE_INPUT_MAX_LENGTH) return null;
  const digits = input
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
  // Spaces (including non-breaking spaces) and ordinary hyphens are accepted
  // as pasted presentation separators. Other punctuation remains invalid.
  const phone = digits.replace(/[\s-]/g, '');
  if (/^09[0-9]{9}$/.test(phone)) return phone;
  if (/^\+989[0-9]{9}$/.test(phone)) return `0${phone.slice(3)}`;
  if (/^00989[0-9]{9}$/.test(phone)) return `0${phone.slice(4)}`;
  return null;
}
