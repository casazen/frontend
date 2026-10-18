import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { withListReturn } from '@/lib/list-return';
import type { PageCrumb } from '@/lib/page-crumbs';
import { cn } from '@/lib/utils';

interface PageCrumbsProps {
  /** The trail, the area first and the page that is open last (which is not a link). */
  items: PageCrumb[];
}

/**
 * The breadcrumb of a page (UI-05), for a computer: where the page sits in the area, each step a link to go up. The step that
 * is a list that remembers its filters (`useListReturn`) leads to it as the user left it. Hidden on a phone, where the
 * `BackLink` takes its place.
 */
export function PageCrumbs({ items }: PageCrumbsProps) {
  const { t } = useTranslation();

  return (
    <nav aria-label={t('breadcrumb.ariaLabel')} data-testid="page-crumbs" className="hidden md:block">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
              {item.to && !isCurrent ? (
                <Link
                  to={withListReturn(item.to)}
                  className="truncate rounded-sm outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isCurrent ? 'page' : undefined} className={cn('truncate', isCurrent && 'font-medium text-foreground')}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
