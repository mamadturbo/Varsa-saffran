import type { SVGProps } from 'react';

/**
 * Varsa wordmark — a saffron bloom with three stylized stigmas inside a
 * Persian "shamseh" sunburst. Used in the header, footer, and favicon.
 */
export function VarsaMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="varsaGold" x1="0" y1="0" x2="64" y2="64">
          <stop stopColor="#f0d9a8" />
          <stop offset="0.5" stopColor="#C9A96E" />
          <stop offset="1" stopColor="#92733f" />
        </linearGradient>
      </defs>
      {/* shamseh sunburst */}
      <g stroke="url(#varsaGold)" strokeWidth="1.4" opacity="0.85">
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i * Math.PI) / 8;
          const x1 = 32 + Math.cos(a) * 20;
          const y1 = 32 + Math.sin(a) * 20;
          const x2 = 32 + Math.cos(a) * 28;
          const y2 = 32 + Math.sin(a) * 28;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      <circle cx="32" cy="32" r="20" stroke="url(#varsaGold)" strokeWidth="1.2" opacity="0.5" />
      {/* three saffron stigmas */}
      <g stroke="url(#varsaGold)" strokeWidth="2.6" strokeLinecap="round">
        <path d="M32 44 C 30 36, 27 30, 25 22" />
        <path d="M32 44 C 32 36, 32 28, 32 20" />
        <path d="M32 44 C 34 36, 37 30, 39 22" />
      </g>
      <circle cx="32" cy="46" r="2.4" fill="url(#varsaGold)" />
    </svg>
  );
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
