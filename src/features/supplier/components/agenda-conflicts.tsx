import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SupplierRequestConflicts } from '@/types/supplier';
import { conflictTexts, severityOf } from '../lib/agenda-conflicts';
import { requestPath, requestWhen } from '../requests/request-model';

/** How many jobs the block lists before "Mostra tutti". */
const FIRST_SHOWN = 3;

interface ConflictItemProps {
  item: SupplierRequestConflicts;
}

/** One job with something wrong in its time: when it is, what is wrong and what to do about each thing, a time to propose instead. */
function ConflictItem({ item }: ConflictItemProps) {
  const { t, i18n } = useTranslation();
  const when = requestWhen({ scheduledFor: item.date, scheduledStart: item.startUtc, scheduledEnd: item.endUtc }, i18n.language);
  const whenText = [when.day, when.time].filter(Boolean).join(', ');
  const slot = item.suggestedSlot
    ? requestWhen({ scheduledStart: item.suggestedSlot.startUtc, scheduledEnd: item.suggestedSlot.endUtc }, i18n.language)
    : null;
  const slotText = slot ? [slot.day, slot.time].filter(Boolean).join(', ') : '';

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between" data-testid={`agenda-conflict-${item.requestId}`}>
      <div className="min-w-0 space-y-2">
        <p className="break-words font-semibold first-letter:uppercase">{whenText}</p>
        <ul role="list" className="space-y-1.5">
          {item.conflicts.map((conflict) => {
            const danger = severityOf(conflict) === 'danger';
            const Icon = danger ? AlertCircle : AlertTriangle;
            const words = conflictTexts(conflict.code);
            return (
              <li key={conflict.code} className="flex min-w-0 items-start gap-2 text-sm" data-testid={`agenda-conflict-code-${conflict.code}`}>
                <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', danger ? 'text-danger-foreground' : 'text-warning-foreground')} />
                <span className="min-w-0 break-words">
                  <span className="font-semibold">{t(danger ? 'supplier.agenda.conflicts.danger' : 'supplier.agenda.conflicts.warning')}</span>
                  {': '}
                  {t(words.titleKey)}. <span className="text-foreground/70">{t(words.fixKey)}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {slotText ? (
          <p className="break-words text-sm font-medium" data-testid={`agenda-conflict-slot-${item.requestId}`}>
            {t('supplier.agenda.conflicts.suggested', { when: slotText })}
          </p>
        ) : null}
      </div>
      <Button asChild size="sm" variant="outline" className="self-start">
        <Link to={requestPath(item.requestId)} aria-label={t('supplier.agenda.conflicts.openAria', { when: whenText })}>
          {t('supplier.agenda.conflicts.open')}
        </Link>
      </Button>
    </li>
  );
}

interface AgendaConflictsProps {
  /** The jobs to come with something wrong, nearest first. */
  items: readonly SupplierRequestConflicts[];
  /** The range held more jobs than the check looks at. */
  truncated: boolean;
  /** The most jobs one check looks at. */
  limit: number;
}

/**
 * The jobs of the next 30 days whose time does not fit the hours or the commitments of the supplier (SP-03b): one block in the calm look
 * of the focus block, the one thing the page asks when nothing else needs an answer. Each job says what is wrong, what to do about it and,
 * for a request not yet taken, the first free time as long as the job. The words are ours: the server sends codes. Nothing is changed
 * from here; the request opens in its own page.
 */
export function AgendaConflicts({ items, truncated, limit }: AgendaConflictsProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, FIRST_SHOWN);

  return (
    <section aria-labelledby="agenda-conflicts-title" className="w-full" data-testid="agenda-conflicts">
      <div className="flex min-w-0 flex-col gap-3 rounded-xl bg-warning-soft p-4 ring-1 ring-inset ring-warning-border forced-colors:outline-1 sm:flex-row sm:gap-4 sm:p-6">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-warning-foreground sm:size-12">
          <AlertTriangle className="size-5 sm:size-6" />
        </span>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-2">
            <h2 id="agenda-conflicts-title" className="break-words text-lg font-semibold leading-snug sm:text-xl">
              {t('supplier.agenda.conflicts.title', { count: items.length })}
            </h2>
            <p className="break-words text-sm text-foreground/80 sm:text-base">{t('supplier.agenda.conflicts.hint')}</p>
          </div>

          <ul role="list" className="w-full divide-y divide-warning-border" aria-label={t('supplier.agenda.conflicts.listLabel')}>
            {shown.map((item) => (
              <ConflictItem key={item.requestId} item={item} />
            ))}
          </ul>

          {items.length > FIRST_SHOWN && !showAll ? (
            <Button size="sm" variant="outline" onClick={() => setShowAll(true)} data-testid="agenda-conflicts-show-all">
              {t('supplier.agenda.conflicts.showAll', { total: items.length })}
            </Button>
          ) : null}
          {truncated ? <p className="break-words text-sm text-foreground/70">{t('supplier.agenda.conflicts.truncated', { limit })}</p> : null}
        </div>
      </div>
    </section>
  );
}
