import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import type { HomeRow } from '../lib/home-model';
import { HomeRowItem } from './home-row';

const VISIBLE = 4;

interface TodoSectionProps {
  rows: HomeRow[];
  incomplete?: boolean;
  loading?: boolean;
  showAll: boolean;
  onToggleAll: () => void;
}

export function TodoSection({ rows, incomplete, loading, showAll, onToggleAll }: TodoSectionProps) {
  const { t } = useTranslation();
  const shown = showAll ? rows : rows.slice(0, VISIBLE);
  const action: { actionLabel: string; onAction: () => void } | { actionLabel?: undefined } =
    rows.length > VISIBLE ? { actionLabel: showAll ? t('dashboard.todo.showLess') : t('dashboard.todo.seeAll', { count: rows.length }), onAction: onToggleAll } : {};

  return (
    <PlainSection className="rounded-xl border border-border bg-card p-4 sm:p-5" title={t('dashboardPendingHeading')} count={rows.length} data-testid="home-todo" {...action}>
      {rows.length > 0 ? (
        <ul role="list" className="divide-y divide-border border-y border-border">
          {shown.map((row) => (
            <HomeRowItem key={row.id} row={row} noteFirst />
          ))}
        </ul>
      ) : loading || incomplete ? (
        <p role="status" className="py-3 text-sm text-muted-foreground">
          {t(loading ? 'shared.loading.srOnly' : 'dashboardPrioritiesPartial')}
        </p>
      ) : (
        <p className="flex items-center gap-2 py-2 text-sm text-foreground/75" data-testid="home-todo-empty">
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />
          <span className="min-w-0">{t('dashboardNoPending')}</span>
        </p>
      )}
    </PlainSection>
  );
}
