import type { CSSProperties, HTMLAttributes } from 'react';

type BrandProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'auto' | 'gold' | 'rust';
};

function BrandImage({ kind, tone = 'auto', className = '', style, ...props }: BrandProps & { kind: 'logo' | 'monogram' }) {
  const width = kind === 'logo' ? 360 : 192;
  const base = `${import.meta.env.BASE_URL}brand/${kind}`;
  const colors = tone === 'auto' ? (['rust', 'gold'] as const) : [tone];
  const artworkStyle = {
    '--varsa-gold-artwork': `url("${base}-gold-${width}.webp")`,
    ...style,
  } as CSSProperties;
  return (
    <span role="img" aria-label="ورسا" className={`varsa-brand-image varsa-brand-${kind} varsa-brand-${tone} ${className}`} style={artworkStyle} {...props}>
      {colors.map((color) => (
        <img key={color} src={`${base}-${color}-${width}.webp`}
          className={`varsa-brand-tone-${color}`} alt="" aria-hidden="true"
          width={width} height={kind === 'logo' ? (color === 'gold' ? 234 : 229) : 192}
          draggable={false} decoding="async" fetchPriority="low" />
      ))}
    </span>
  );
}

export function VarsaMark(props: BrandProps) {
  return <BrandImage kind="monogram" {...props} />;
}

export function VarsaLogo(props: BrandProps) {
  return <BrandImage kind="logo" {...props} />;
}

/** Horizontal Persian-style ornamental divider — two mirrored arabesques. */
export function ArabesqueDivider({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className ?? ''}`}>
      <span className="gold-rule max-w-[120px]" />
      <svg width="42" height="14" viewBox="0 0 42 14" fill="none" className="text-gold-500">
        <path
          d="M21 1 C 16 5, 16 9, 21 13 C 26 9, 26 5, 21 1 Z M21 4.5 C 19 6.5, 19 7.5, 21 9.5 C 23 7.5, 23 6.5, 21 4.5 Z"
          stroke="currentColor"
          strokeWidth="1"
          fill="currentColor"
          fillOpacity="0.25"
        />
        <path d="M1 7 H 14 M28 7 H 41" stroke="currentColor" strokeWidth="1" />
      </svg>
      <span className="gold-rule max-w-[120px]" />
    </div>
  );
}
