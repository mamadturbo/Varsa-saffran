import { buildContactConfig, contactPhone, type ContactInput } from './contact-config';
import { VARSA } from './brand-identity';

// Set only public, owner-confirmed business details; missing fields stay absent.
export function storeContact(settings: ContactInput = {
  phone: import.meta.env?.VITE_CONTACT_PHONE,
  email: import.meta.env?.VITE_CONTACT_EMAIL,
  address: import.meta.env?.VITE_CONTACT_ADDRESS,
  instagram: import.meta.env?.VITE_INSTAGRAM_URL,
  telegram: import.meta.env?.VITE_TELEGRAM_URL,
}) {
  const contact = buildContactConfig(settings);
  return { ...contact, phone: contact.phone ?? contactPhone(VARSA.supportPhone) };
}
