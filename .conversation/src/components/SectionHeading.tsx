import type { ReactNode } from 'react';
import { ArabesqueDivider } from './Brand';

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  center?: boolean;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center = true,
  className = '',
}: SectionHeadingProps) {
  return (
    <div className={`${center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'} ${className}`}>
      {eyebrow && (
        <span className="reveal chip mb-4">{eyebrow}</span>
      )}
      <h2 className="reveal reveal-delay-1 font-display text-3xl font-bold leading-tight text-cream-50 text-balance sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {center && <ArabesqueDivider className="reveal reveal-delay-2 mt-5" />}
      {subtitle && (
        <p className="reveal reveal-delay-2 mt-5 text-base leading-8 text-cream-300 text-pretty sm:text-lg">
          {subtitle}
        </p>
      )}
    </div>
  );
}
