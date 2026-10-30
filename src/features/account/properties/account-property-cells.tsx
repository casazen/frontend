import { useTranslation } from 'react-i18next';
import { Home, Sun } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { useDayLabel } from '@/features/properties/mode/use-mode-labels';
import { missingText, type AccountPropertyRow } from './account-properties-model';

/** The mark of a cell whose answer is not there: nothing is claimed, and a screen reader is told why it is empty. */
export function Unknown() {
  const { t } = useTranslation();
  return (
    <span className="text-foreground/70">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t('accountProperties.list.unknown')}</span>
    </span>
  );
}

/**
 * The change of mode that waits for its day, in words: «Passaggio all'affitto lungo il 1 dicembre 2026» (AM-13b). Nothing when none does:
 * the list asks for it with the overview, so every row says it without a request of its own.
 */
export function ScheduledChange({ row, className }: { row: Pick<AccountPropertyRow, 'property'>; className?: string }) {
  const { t } = useTranslation();
  const dayLabel = useDayLabel();
  const change = row.property.scheduledModeChange;
  if (!change || change.status !== 'Scheduled') return null;

  return (
    <span className={className ?? 'break-words text-sm font-normal text-foreground/70'} data-testid="account-property-scheduled-change">
      {t(change.toMode === 'Long' ? 'propertyMode.notice.toLong' : 'propertyMode.notice.toShort', { date: dayLabel(change.effectiveDate) })}
    </span>
  );
}

/** How the property is let, with the icon of its area: an icon and a word, never the icon alone; under it the change that waits for its day. */
export function ModeTag({ row }: { row: AccountPropertyRow }) {
  const { t } = useTranslation();
  const Icon = row.mode === 'Long' ? Home : Sun;
  return (
    <span className="flex min-w-0 max-w-full flex-col items-start gap-0.5">
      <span className="inline-flex max-w-full items-center gap-1.5">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-foreground/70" />
        <span className="min-w-0 break-words">{t(row.mode === 'Long' ? 'accountProperties.mode.long' : 'accountProperties.mode.short')}</span>
      </span>
      <ScheduledChange row={row} />
    </span>
  );
}

/** The state of the property, and under it what the empty fields of a short-term one that is not ready say it lacks. */
export function StateCell({ row }: { row: AccountPropertyRow }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      {row.state?.kind === 'property' ? <StatusBadge kind="property" status={row.state.status} /> : null}
      {row.state?.kind === 'longRentProperty' ? <StatusBadge kind="longRentProperty" status={row.state.status} /> : null}
      {row.state === null ? <Unknown /> : null}
      {row.missing.length > 0 ? <span className="text-sm font-normal text-foreground/70">{missingText(row.missing, t)}</span> : null}
    </div>
  );
}

/** «3 utenti»: the number is what opens the list of who they are (the drawer of the property). */
export function PeopleButton({ row, onWho }: { row: AccountPropertyRow; onWho: (row: AccountPropertyRow) => void }) {
  const { t } = useTranslation();
  if (row.people === null) return <Unknown />;
  return (
    <button
      type="button"
      className="inline-flex min-h-8 items-center rounded-sm text-left font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11"
      aria-label={t('accountProperties.list.whoLabel', { count: row.people, name: row.property.name })}
      onClick={() => onWho(row)}
    >
      {t('accountProperties.list.people', { count: row.people })}
    </button>
  );
}
