import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/store/ui-store';
import { cn } from '@/lib/utils';

export interface ListBulkBarAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
}

interface ListBulkBarProps {
  count: number;
  actions: readonly ListBulkBarAction[];
  onClear: () => void;
}

// A phone has the bottom bar, and a page may fix its primary action above it (the same two heights that `AppToaster` clears).
const ABOVE_THE_BAR = 'max-md:bottom-[calc(var(--bottom-nav-height,0px)+env(safe-area-inset-bottom,0px)+0.75rem)]';
const ABOVE_THE_BAR_AND_THE_PRIMARY_ACTION =
  'max-md:bottom-[calc(var(--bottom-nav-height,0px)+var(--mobile-primary-height,0px)+env(safe-area-inset-bottom,0px)+0.75rem)]';

/**
 * The actions on the rows that are selected, shown while at least one is (UI-14). On a computer it sticks under the header, over
 * the rows; on a phone it is fixed at the bottom, over the bottom bar, where the thumb is.
 */
export function ListBulkBar({ count, actions, onClear }: ListBulkBarProps) {
  const { t } = useTranslation();
  const primaryActionIsThere = useUiStore((state) => state.mobilePrimaryVisible);

  return (
    <div
      role="region"
      aria-label={t('listView.bulk.bar')}
      data-testid="list-bulk-bar"
      className={cn(
        'z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-muted px-4 py-2 text-sm md:sticky md:top-[var(--header-height,0px)]',
        'max-md:fixed max-md:inset-x-3 max-md:rounded-lg max-md:border max-md:bg-background max-md:shadow-lg max-md:ring-1 max-md:ring-primary/30',
        primaryActionIsThere ? ABOVE_THE_BAR_AND_THE_PRIMARY_ACTION : ABOVE_THE_BAR,
      )}
    >
      <span role="status" className="font-semibold max-md:order-1">
        {t('listView.bulk.selected', { count })}
      </span>
      <div className="flex min-w-0 grow flex-wrap items-center gap-2 max-md:order-3 max-md:basis-full">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button key={action.id} type="button" variant="outline" size="sm" onClick={action.onSelect} data-testid={`list-bulk-${action.id}`}>
              {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
              {action.label}
            </Button>
          );
        })}
      </div>
      {/* On a phone: the number and "clear" on the first row, the actions under them. */}
      <Button type="button" variant="ghost" size="sm" onClick={onClear} data-testid="list-bulk-clear" className="max-md:order-2 max-md:ml-auto">
        {t('listView.bulk.clear')}
      </Button>
    </div>
  );
}
