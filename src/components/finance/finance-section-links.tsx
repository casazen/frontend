import type { LucideIcon } from 'lucide-react';

interface FinanceSectionLink {
  id: string;
  label: string;
  icon: LucideIcon;
}

export function FinanceSectionLinks({ label, links }: { label: string; links: FinanceSectionLink[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-2">
      {links.map(({ id, label: text, icon: Icon }) => (
        <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
          {text}
        </a>
      ))}
    </nav>
  );
}
