export interface ContactInput {
  phone?: string;
  email?: string;
  address?: string;
  instagram?: string;
  telegram?: string;
}
export interface ContactChannel { label: string; href: string }
export interface ContactConfig {
  phone: ContactChannel | null;
  email: ContactChannel | null;
  address: string | null;
  instagram: string | null;
  telegram: string | null;
}

const digits = (value: string) => value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

export function contactPhone(value = ''): ContactChannel | null {
  const raw = digits(value.trim());
  if (!raw || !/^[+\d\s().-]+$/.test(raw)) return null;
  let number = raw.replace(/[\s().-]/g, '');
  if (number.startsWith('00')) number = `+${number.slice(2)}`;
  else if (/^0[1-9]\d{9}$/.test(number)) number = `+98${number.slice(1)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(number)) return null;
  if (number.startsWith('+98') && !/^\+98[1-9]\d{9}$/.test(number)) return null;
  return { label: number, href: `tel:${number}` };
}

export function contactEmail(value = ''): ContactChannel | null {
  const email = value.trim();
  // A single conventional mailbox, without mail headers, controls or URL syntax.
  if (email.length > 254 || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(email)) return null;
  const local = email.split('@')[0];
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
  return { label: email, href: `mailto:${encodeURIComponent(email)}` };
}

export function contactProfile(value: string | undefined, platform: 'instagram' | 'telegram'): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    const hosts = platform === 'instagram' ? ['instagram.com', 'www.instagram.com'] : ['t.me', 'www.t.me', 'telegram.me', 'www.telegram.me'];
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname)) return null;
    const match = (platform === 'instagram' ? /^\/([a-zA-Z0-9_][a-zA-Z0-9_.]*)\/?$/ : /^\/([a-zA-Z][a-zA-Z0-9_]*)\/?$/).exec(url.pathname);
    if (!match) return null;
    const reserved = platform === 'instagram'
      ? ['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct', 'about', 'legal', 'challenge', 'web', 'tv']
      : ['share', 'iv', 'joinchat', 'proxy', 's', 'addstickers', 'login'];
    if (reserved.includes(match[1].toLowerCase())) return null;
    // Supported public profile paths only. Drop tracking queries/fragments and
    // never treat a platform homepage or action endpoint as a brand account.
    return platform === 'instagram' ? `https://www.instagram.com/${match[1]}/` : `https://t.me/${match[1]}`;
  } catch { return null; }
}

export function buildContactConfig(input: ContactInput = {}): ContactConfig {
  return {
    phone: contactPhone(input.phone),
    email: contactEmail(input.email),
    address: input.address?.trim() || null,
    instagram: contactProfile(input.instagram, 'instagram'),
    telegram: contactProfile(input.telegram, 'telegram'),
  };
}
