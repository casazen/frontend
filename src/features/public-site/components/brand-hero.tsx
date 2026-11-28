import type { ReactNode } from 'react';

interface BrandHeroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}

export function BrandHero({ eyebrow, title, description, children }: BrandHeroProps) {
  return (
    <header className="border-b border-[var(--cz-public-line-strong)] py-6 md:py-10">
      <div className="relative">
        {eyebrow}
        <h1 className="public-display max-w-3xl text-balance text-4xl leading-tight md:text-5xl">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-[var(--cz-public-muted)]">{description}</p> : null}
        {children}
      </div>
    </header>
  );
}

export function BrandEyebrow({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1 text-sm font-semibold text-[var(--cz-brand-tint-text)]">
      {icon}
      {children}
    </p>
  );
}
