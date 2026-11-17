import { Instagram, Send } from 'lucide-react';
import { useStoreContact } from '@/lib/store-content';

export function SocialLinks({ compact = false }: { compact?: boolean }) {
  const CONTACT = useStoreContact();
  const channels = [
    { href: CONTACT.instagram, label: 'اینستاگرام', Icon: Instagram },
    { href: CONTACT.telegram, label: 'تلگرام', Icon: Send },
  ].filter(channel => channel.href !== null);
  if (!channels.length) return null;
  return <div className="mt-5 flex flex-wrap gap-3">
    {channels.map(({ href, label, Icon }) => <a key={label} href={href!} target="_blank" rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-gold-500/25 text-accent transition-colors hover:border-gold-600 hover:bg-gold-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600 ${compact ? 'w-11' : 'px-4 py-2 text-sm'}`}
      aria-label={`${label} ورسا — باز شدن در زبانه جدید`}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      {!compact && <span>{label}</span>}
    </a>)}
  </div>;
}
