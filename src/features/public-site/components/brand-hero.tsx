import type { ReactNode } from 'react';
import { CasaZenRing } from '@/components/brand/casazen-mark';

interface BrandHeroProps {
  /** A small label above the title (`BrandEyebrow`). */
  eyebrow?: ReactNode;
  /** The `h1` of the page. */
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}

/**
 * The top of a page of CasaZen's own public pages (search, hub of the guides, guides and calculators): a soft terracotta panel
 * with the ring of the logo behind the title. It paints with the brand tokens of `public-brand.css`, so it belongs to
 * `PublicSiteShell mode="default"` only.
 */
export function BrandHero({ eyebrow, title, description, children }: BrandHeroProps) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-[var(--cz-brand-tint-strong)] bg-[linear-gradient(135deg,var(--cz-brand-tint-strong),var(--cz-brand-tint)_50%,var(--cz-public-bg))] px-6 py-8 md:px-10 md:py-11">
      <CasaZenRing size={300} className="pointer-events-none absolute -right-16 -top-20 opacity-[0.13]" />
      <div className="relative">
        {eyebrow}
        <h1 className="public-display text-3xl leading-tight md:text-4xl">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-[var(--cz-public-muted)]">{description}</p> : null}
        {children}
      </div>
    </header>
  );
}

/** The label above the title of a hero: a white pill in the terracotta text color, with an optional icon. */
export function BrandEyebrow({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1 text-sm font-semibold text-[var(--cz-brand-tint-text)]">
      {icon}
      {children}
    </p>
  );
}
