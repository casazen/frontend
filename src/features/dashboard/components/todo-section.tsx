import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import type { HomeRow } from '../lib/home-model';
import { HomeRowItem } from './home-row';

/** How many things to do the Home shows before "Vedi tutte". */
const VISIBLE = 4;

interface TodoSectionProps {
  rows: HomeRow[];
  showAll: boolean;
  onToggleAll: () => void;
}

/**
 * "Da fare": a section without a box, in the order the server gives (most pressing first), each row with how pressing it is,
 * said in words, and the button that does it. Four rows, then "Vedi tutte".
 */
export function TodoSection({ rows, showAll, onToggleAll }: TodoSectionProps) {
  const { t } = useTranslation();
  const shown = showAll ? rows : rows.slice(0, VISIBLE);
  const action: { actionLabel: string; onAction: () => void } | { actionLabel?: undefined } =
    rows.length > VISIBLE ? { actionLabel: showAll ? t('dashboard.todo.showLess') : t('dashboard.todo.seeAll', { count: rows.length }), onAction: onToggleAll } : {};

  return (
    <PlainSection title={t('dashboard.todo.title')} count={rows.length} data-testid="home-todo" {...action}>
      {rows.length > 0 ? (
        <ul role="list" className="divide-y divide-border border-y border-border">
          {shown.map((row) => (
            <HomeRowItem key={row.id} row={row} noteFirst />
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-success-soft text-success-foreground">
            <CheckCircle2 className="size-[22px]" />
          </span>
          <div className="min-w-0 flex-1 basis-52">
            <p className="font-semibold">{t('dashboard.todo.empty.title')}</p>
            <p className="text-sm text-foreground/70">{t('dashboard.todo.empty.text')}</p>
          </div>
        </div>
      )}
    </PlainSection>
  );
}
