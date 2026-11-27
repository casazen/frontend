import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDocumentDay } from '@/features/fiscal/documents/document-model';
import { romeDateOf } from '@/lib/stay-dates';
import type { SelfBillingListItem } from '@/types';
import { closeReasonKeyOf } from '../self-billing-model';

/**
 * What a draft closed as «non più dovuta» says of itself, as history: that it took the number of a rejected TD17 and that the number stays reserved (never given to another invoice), and then, one line each, why it was
 * closed, the day (Europe/Rome), who (the name; nothing when the person is not known any more, never an id) and the note the person left. A member the server does not give is left out, never filled with a placeholder.
 * `testId` names the block (`<testId>-intro`, `-reason`, `-at`, `-by`, `-note`): the list and the drawer both draw it.
 */
export function ClosedDetails({ item, testId }: { item: SelfBillingListItem; testId: string }) {
  const { t, i18n } = useTranslation();
  const reasonKey = item.closedReason === null ? null : closeReasonKeyOf(item.closedReason);
  const day = romeDateOf(item.closedAt);
  const rows: { key: string; label: string; value: string; className?: string }[] = [];
  if (item.closedReason !== null) rows.push({ key: 'reason', label: t('selfBilling.closed.reason'), value: reasonKey !== null ? t(reasonKey) : item.closedReason });
  if (day !== '') rows.push({ key: 'at', label: t('selfBilling.closed.at'), value: formatDocumentDay(day, i18n.language) });
  if (item.closedBy !== null) rows.push({ key: 'by', label: t('selfBilling.closed.by'), value: item.closedBy });
  if (item.closedNote !== null) rows.push({ key: 'note', label: t('selfBilling.closed.note'), value: item.closedNote, className: 'whitespace-pre-line' });

  return (
    <div className="space-y-1 text-sm" data-testid={testId}>
      <p className="break-words" data-testid={`${testId}-intro`}>
        {item.number ? t('selfBilling.closed.intro', { number: item.number }) : t('selfBilling.closed.introUnknown')}
      </p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
        {rows.map((row) => (
          <Fragment key={row.key}>
            <dt className="text-foreground/70">{row.label}</dt>
            <dd className={`min-w-0 break-words ${row.className ?? ''}`} data-testid={`${testId}-${row.key}`}>
              {row.value}
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
