import { Mail, MapPin, Phone } from 'lucide-react';
import { useStoreContact } from '@/lib/store-content';
import { toFaDigits } from '@/lib/site';

export function ContactDetails() {
  const CONTACT = useStoreContact();
  if (!CONTACT.phone && !CONTACT.email && !CONTACT.address) return <p className="text-sm leading-7 text-cream-300">اطلاعات تماس مستقیم هنوز اعلام نشده است.</p>;
  const linkClass = 'inline-flex min-h-11 items-center break-all text-cream-100 underline underline-offset-4 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600';
  return <ul className="space-y-3 text-sm text-cream-300">
    {CONTACT.phone && <li className="flex items-start gap-3">
      <Phone aria-hidden="true" className="mt-3 h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
      <a href={CONTACT.phone.href} dir="ltr" className={linkClass} aria-label={`تماس با ورسا: ${toFaDigits(CONTACT.phone.label)}`}>{toFaDigits(CONTACT.phone.label)}</a>
    </li>}
    {CONTACT.email && <li className="flex items-start gap-3">
      <Mail aria-hidden="true" className="mt-3 h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
      <a href={CONTACT.email.href} dir="ltr" className={linkClass} aria-label={`ایمیل ورسا: ${CONTACT.email.label}`}>{CONTACT.email.label}</a>
    </li>}
    {CONTACT.address && <li className="flex items-start gap-3">
      <MapPin aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
      <span className="min-w-0 break-words leading-7">{CONTACT.address}</span>
    </li>}
  </ul>;
}
