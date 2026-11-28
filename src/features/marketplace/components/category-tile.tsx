import { createElement } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { cn } from '@/lib/utils';
import { categoryIcon } from '../lib/category-icons';
import { marketplaceCategoryPath } from '../lib/marketplace-paths';

const ICON_CLASS = 'size-5';

interface CategoryTileProps {
  category: string;
  count: number;
}

export function CategoryTile({ category, count }: CategoryTileProps) {
  const { t } = useTranslation();

  return (
    <Link
      to={marketplaceCategoryPath(category)}
      className="flex min-h-16 min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid={`marketplace-category-${category}`}
    >
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
        {createElement(categoryIcon(category), { className: ICON_CLASS })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words font-medium">{getServiceCategoryLabel(category, t)}</span>
        <span className={cn('block text-sm', count > 0 ? 'text-foreground/70' : 'text-muted-foreground')}>
          {count > 0 ? t('marketplace.categories.count', { count }) : t('marketplace.categories.none')}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
