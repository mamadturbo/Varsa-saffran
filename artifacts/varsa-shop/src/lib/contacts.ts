import { buildContactConfig } from './contact-config';

// Set only public, owner-confirmed business details; missing fields stay absent.
export const CONTACT = buildContactConfig({
  phone: import.meta.env.VITE_CONTACT_PHONE,
  email: import.meta.env.VITE_CONTACT_EMAIL,
  address: import.meta.env.VITE_CONTACT_ADDRESS,
  instagram: import.meta.env.VITE_INSTAGRAM_URL,
  telegram: import.meta.env.VITE_TELEGRAM_URL,
});
