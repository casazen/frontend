import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface PublicBreadcrumbProps {
  segments: BreadcrumbSegment[];
}

export function PublicBreadcrumb({ segments }: PublicBreadcrumbProps) {
  const { t } = useTranslation();

  if (segments.length === 0) return null;

  return (
    <nav aria-label={t('publicSite.breadcrumbLabel')} className="mb-6 text-sm" data-testid="public-breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-[var(--cz-public-muted)]">
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          return (
            <li key={`${seg.label}-${i}`} className="flex items-center gap-1">
              {i > 0 ? <ChevronRight className="h-3 w-3 shrink-0" aria-hidden /> : null}
              {seg.href && !isLast ? (
                <Link to={seg.href} className="hover:text-[var(--cz-public-primary)] hover:underline">
                  {seg.label}
                </Link>
              ) : (
                <span className={isLast ? 'font-medium text-[var(--cz-public-text)]' : undefined} aria-current={isLast ? 'page' : undefined}>
                  {seg.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
