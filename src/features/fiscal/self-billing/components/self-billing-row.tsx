import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatDocumentDay, sdiStateOf } from '@/features/fiscal/documents/document-model';
import { StatePill } from '@/features/fiscal/documents/document-state-badge';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { useSelfBillingBusy } from '@/queries/use-self-billing';
import type { SelfBillingListItem } from '@/types';
import { canCloseNotDue, canIssueDraft, isClosedNotDue, isCorrectedOriginal, replacesAnInvoice } from '../self-billing-model';
import { keptWords, money, replacesWords } from '../self-billing-words';
import { ClosedDetails } from './closed-details';
import { StatusBadge } from './status-badge';

interface RowProps {
  item: SelfBillingListItem;
  /** The person may use «Correggi e rimanda» (role and flags): the button is drawn only with it AND when the server says the row `canCorrect`. */
  mayCorrect: boolean;
  /** The person may use «Chiudi come non più dovuta» (role and flags): the button is drawn only with it AND for a kept replacement draft. */
  mayClose: boolean;
  /** This row is the rejected original of a replacement that was closed as «non più dovuta»: no invoice will ever carry its number, and the row does not say it was replaced by one. */
  replacementClosed: boolean;
  onOpen: () => void;
  onCorrect: () => void;
  onCloseNotDue: () => void;
  onOpenReplacement: (id: string) => void;
}

/**
 * One TD17: who holds the account of the portal (the agency, or an owner) and which portal charges the commission, the month, the day it is due by, its number once it is issued, the amounts in their own currency and where
 * it stands. A TD17 the SDI rejected offers «Correggi e rimanda» when the server says it can be corrected; the original a correction discarded is history, with a reference to what replaces it and no action; a draft that
 * replaces one says which and holds its number; a draft that is kept says why it cannot be issued and offers «Chiudi come non più dovuta»; a draft that was closed that way is history too (reason, day, name, note), with no action.
 */
export function SelfBillingRow({ item, mayCorrect, mayClose, replacementClosed, onOpen, onCorrect, onCloseNotDue, onOpenReplacement }: RowProps) {
  const { t, i18n } = useTranslation();
  const { month } = useOwnerFormat();
  // The buttons of the card wait while any write on this TD17 (or the drafts of the month, which name none) is on its way.
  const busy = useSelfBillingBusy([item.id]);
  const issued = item.status === 'Issued';
  const replacementId = item.replacedByDocumentId;
  const original = isCorrectedOriginal(item);
  const closed = isClosedNotDue(item);
  const reviewable = canIssueDraft(item);
  const correctable = mayCorrect && item.canCorrect;
  const closable = mayClose && canCloseNotDue(item);
  const title = `${item.holderName} · ${item.portalName}`;
  const opens = issued || !reviewable;

  let standing;
  if (original) {
    if (replacementClosed) standing = item.number ? t('selfBilling.row.correctedClosed', { number: item.number }) : t('selfBilling.row.correctedClosedUnknown');
    else standing = item.number ? t('selfBilling.row.corrected', { number: item.number }) : t('selfBilling.row.correctedUnknown');
  } else if (issued && item.number) standing = t('selfBilling.row.issued', { number: item.number, date: item.issueDate ? formatDocumentDay(item.issueDate, i18n.language) : '' });
  else standing = t('selfBilling.row.due', { date: formatDocumentDay(item.dueDate, i18n.language) });

  return (
    <li className="flex flex-col gap-3 rounded-xl p-4 even:bg-muted/40 sm:flex-row sm:items-start sm:justify-between" data-testid="self-billing-row" data-status={item.status} data-id={item.id}>
      <div className="min-w-0 space-y-1">
        <h3 className="break-words text-base font-semibold" data-testid="self-billing-row-title">
          {title}
        </h3>
        <p className="break-words text-sm text-foreground/70">
          {t('selfBilling.row.monthAndHolder', { month: month(item.periodYear, item.periodMonth), holder: t(`selfBilling.holder.${item.holderKind === 'Owner' ? 'Owner' : 'Agency'}`), country: item.portalCountry })}
        </p>
        {closed ? (
          // A closed draft is not «da emettere»: it says what it was and why it ended, in place of the line of the due day and of the draft that replaces an invoice.
          <ClosedDetails item={item} testId="self-billing-row-closed" />
        ) : (
          <>
            <p className="break-words text-sm text-foreground/70" data-testid={original ? 'self-billing-row-corrected' : 'self-billing-row-due'}>
              {standing}
            </p>
            {replacesAnInvoice(item) ? (
              <p className="break-words text-sm text-foreground/70" data-testid="self-billing-row-replaces">
                {replacesWords(t, item.number)}
              </p>
            ) : null}
          </>
        )}
        {item.keptReason !== null ? (
          <p className="break-words text-sm font-medium text-foreground" data-testid="self-billing-row-kept" data-reason={item.keptReason}>
            {keptWords(t, item.keptReason, closable)}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium tabular-nums" data-testid="self-billing-row-total">
            {t('selfBilling.row.total', { amount: money(item.total, item.currency, i18n.language) })}
          </span>
          <span className="text-foreground/70 tabular-nums">{t('selfBilling.row.parts', { base: money(item.taxableBase, item.currency, i18n.language), vat: money(item.vatAmount, item.currency, i18n.language) })}</span>
          <StatusBadge status={original ? (replacementClosed ? 'RejectedClosed' : 'Replaced') : closed ? 'ClosedNotDue' : item.status} />
          {issued || original ? <StatePill state={sdiStateOf({ sdiStatus: item.sdiStatus, sdiErrorCode: null })} testId="self-billing-row-sdi" /> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-2 self-start">
        {replacementId !== null ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenReplacement(replacementId)} aria-label={t('selfBilling.row.replacementLabel', { title })} data-testid="self-billing-row-replacement">
            {t('selfBilling.row.replacement')}
          </Button>
        ) : (
          <>
            {correctable ? (
              <Button type="button" size="sm" disabled={busy} onClick={onCorrect} aria-label={t('selfBilling.correct.buttonLabel', { title })} data-testid="self-billing-row-correct">
                {t('selfBilling.correct.button')}
              </Button>
            ) : null}
            {closable ? (
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCloseNotDue} aria-label={t('selfBilling.close.buttonLabel', { title })} data-testid="self-billing-row-close">
                {t('selfBilling.close.button')}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant={opens || correctable ? 'outline' : 'default'} onClick={onOpen} aria-label={t(opens ? 'selfBilling.row.openLabel' : 'selfBilling.row.reviewLabel', { title })} data-testid="self-billing-row-open">
              {t(opens ? 'selfBilling.row.open' : 'selfBilling.row.review')}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
