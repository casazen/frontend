import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, type LucideIcon } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { SkeletonList } from '@/components/ui/skeleton';
import { useSupplierDashboard, useSupplierInboxCounts } from '@/queries/supplier/use-inbox';
import { INBOX_PATH } from '../requests/request-model';
import { AVAILABILITY_PATH } from './home-model';

interface TodoItem {
  id: string;
  title: string;
  hint: string;
  action: { label: string; to: string };
}

function TodoRow({ item, icon: Icon }: { item: TodoItem; icon: LucideIcon }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4" data-testid={`supplier-todo-${item.id}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
        <div className="min-w-0">
          <p className="break-words font-semibold">{item.title}</p>
          <p className="break-words text-sm text-foreground/70">{item.hint}</p>
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight sm:shrink-0">
        <Link to={item.action.to}>{item.action.label}</Link>
      </Button>
    </li>
  );
}

/**
 * "Da fare": what waits for the supplier, in plain rows without a box. Two things are here because the server already counts them: the
 * payments asked for that are late (`inbox/counts`) and the calendar events marked "Libero" that wait for the answer (`dashboard`).
 * The conflicts of the agenda (SP-03b) and the account for the payments (SP-16a) are not here yet: nothing counts them.
 */
export function TodoSection() {
  const { t } = useTranslation();
  const dashboard = useSupplierDashboard();
  const counts = useSupplierInboxCounts();

  if (dashboard.isLoading || counts.isLoading) {
    return (
      <PlainSection title={t('supplier.home.todo.title')} data-testid="supplier-todo">
        <SkeletonList items={2} />
      </PlainSection>
    );
  }
  if (dashboard.isError || counts.isError) {
    const retry = () => {
      if (dashboard.isError) void dashboard.refetch();
      if (counts.isError) void counts.refetch();
    };
    return (
      <PlainSection title={t('supplier.home.todo.title')} data-testid="supplier-todo">
        <ErrorState title={t('supplier.home.todo.loadError')} error={dashboard.error ?? counts.error} onRetry={retry} testId="supplier-todo-error" />
      </PlainSection>
    );
  }

  const late = counts.data?.paymentsLate ?? 0;
  const events = dashboard.data?.calendarSyncStatus?.pendingFreeEventsCount ?? 0;
  const items: TodoItem[] = [];
  if (late > 0) {
    items.push({
      id: 'payments-late',
      title: t('supplier.home.todo.paymentsLate', { count: late }),
      hint: t('supplier.home.todo.paymentsLateHint'),
      action: { label: t('supplier.home.todo.paymentsLateAction'), to: `${INBOX_PATH}?chip=da-incassare` },
    });
  }
  if (events > 0) {
    items.push({
      id: 'free-events',
      title: t('supplier.freeEventsDashboardTitle', { count: events }),
      hint: t('supplier.freeEventsDashboardHint'),
      action: { label: t('supplier.freeEventsDashboardCta'), to: AVAILABILITY_PATH },
    });
  }

  if (items.length === 0) {
    return (
      <PlainSection title={t('supplier.home.todo.title')} actionLabel={t('supplier.home.todo.requests')} href={INBOX_PATH} data-testid="supplier-todo">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3" data-testid="supplier-todo-clear">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-success-soft text-success-foreground">
            <CheckCircle2 className="size-[22px]" />
          </span>
          <div className="min-w-0 flex-1 basis-52">
            <p className="font-semibold">{t('supplier.home.todo.allClear')}</p>
            <p className="text-sm text-foreground/70">{t('supplier.home.todo.allClearHint')}</p>
          </div>
        </div>
      </PlainSection>
    );
  }

  return (
    <PlainSection title={t('supplier.home.todo.title')} count={items.length} data-testid="supplier-todo">
      <ul role="list" className="divide-y divide-border border-y border-border">
        {items.map((item) => (
          <TodoRow key={item.id} item={item} icon={AlertTriangle} />
        ))}
      </ul>
    </PlainSection>
  );
}
