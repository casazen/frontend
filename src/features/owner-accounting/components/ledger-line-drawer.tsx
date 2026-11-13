import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { OwnerLedgerEntry } from '@/types';
import { attachmentUrlOf, paymentPathOf, shortId, sourcePathOf, stepsOf } from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';

interface LedgerLineDrawerProps {
  /** The line to explain; `null` closes the drawer. */
  entry: OwnerLedgerEntry | null;
  onClose: () => void;
  /** The name of the property of the line, when the page knows it (the line carries its id only). */
  propertyName?: string;
}

/**
 * One line of the statement, explained (E06/F05/US02/T04, AC-NF110-1): what it is, the steps from the source to the amount in the statement
 * (the source amount, the owner's share, the exchange rate with where it comes from, the result), the dates it counts for, the rule it was made
 * under, and the way to the source (the booking, the payment, the wires, the attachment). It shows ids, amounts and codes only: the ledger of an
 * owner carries no name of a guest, and nothing here asks for one.
 */
export function LedgerLineDrawer({ entry, onClose, propertyName }: LedgerLineDrawerProps) {
  const { t } = useTranslation();
  const { money, date, dateTime, percent } = useOwnerFormat();

  return (
    <Sheet open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md" data-testid="ledger-line-drawer">
        {entry ? <LineBody entry={entry} propertyName={propertyName} money={money} date={date} dateTime={dateTime} percent={percent} t={t} /> : null}
      </SheetContent>
    </Sheet>
  );
}

interface LineBodyProps {
  entry: OwnerLedgerEntry;
  propertyName?: string;
  money: (amount: number, currency: string) => string;
  date: (day: string | null | undefined) => string;
  dateTime: (instant: string | null | undefined) => string;
  percent: (value: number) => string;
  t: ReturnType<typeof useTranslation>['t'];
}

function LineBody({ entry, propertyName, money, date, dateTime, percent, t }: LineBodyProps) {
  const steps = stepsOf(entry);
  const booking = sourcePathOf(entry);
  const payment = paymentPathOf(entry);
  const attachmentUrl = attachmentUrlOf(entry.attachmentReference);

  return (
    <div className="space-y-5 pb-6">
      <SheetHeader>
        <SheetTitle>{t(`ownerAccounting.line.type.${entry.type}`)}</SheetTitle>
        <SheetDescription>{t(`ownerAccounting.line.formula.${entry.type}`)}</SheetDescription>
      </SheetHeader>

      <div className="space-y-5 px-6">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-2xl font-semibold tabular-nums" data-testid="line-amount">
            {money(entry.amount, entry.statementCurrency)}
          </span>
          <Badge variant={steps.credit ? 'success' : 'secondary'}>{steps.credit ? t('ownerAccounting.line.credit') : t('ownerAccounting.line.debit')}</Badge>
          {steps.isReversal ? <Badge variant="outline">{t('ownerAccounting.line.reversal')}</Badge> : null}
        </p>

        <section aria-labelledby="line-steps-title" className="space-y-2">
          <h3 id="line-steps-title" className="text-sm font-semibold">
            {t('ownerAccounting.line.steps.title')}
          </h3>
          <ol className="space-y-2 text-sm" data-testid="line-steps">
            <li className="flex justify-between gap-3">
              <span>{t('ownerAccounting.line.steps.source')}</span>
              <span className="tabular-nums">{money(entry.sourceAmount, entry.originalCurrency)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>{t('ownerAccounting.line.steps.share')}</span>
              <span className="tabular-nums">{percent(entry.sharePercent)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>{t('ownerAccounting.line.steps.original')}</span>
              <span className="tabular-nums">{money(entry.originalAmount, entry.originalCurrency)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>{t('ownerAccounting.line.steps.fx')}</span>
              <span className="text-right tabular-nums" data-testid="line-fx">
                {steps.sameCurrency
                  ? t('ownerAccounting.line.steps.sameCurrency', { currency: entry.statementCurrency })
                  : t('ownerAccounting.line.steps.rate', { from: entry.originalCurrency, rate: entry.fxRate, to: entry.statementCurrency })}
              </span>
            </li>
            {!steps.sameCurrency && entry.fxSource ? (
              <li className="break-words text-foreground/70">{t('ownerAccounting.line.steps.fxSource', { source: entry.fxSource, date: date(entry.fxDate) })}</li>
            ) : null}
            <li className="flex justify-between gap-3 border-t border-border pt-2 font-medium">
              <span>{t('ownerAccounting.line.steps.result')}</span>
              <span className="tabular-nums">{money(entry.amount, entry.statementCurrency)}</span>
            </li>
          </ol>
        </section>

        <section aria-labelledby="line-facts-title" className="space-y-2">
          <h3 id="line-facts-title" className="text-sm font-semibold">
            {t('ownerAccounting.line.facts.title')}
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Fact label={t('ownerAccounting.line.facts.service')} value={date(entry.serviceDate)} />
            <Fact label={t('ownerAccounting.line.facts.recognition')} value={date(entry.recognitionDate)} />
            {entry.paymentDate ? <Fact label={t('ownerAccounting.line.facts.payment')} value={date(entry.paymentDate)} /> : null}
            <Fact label={t('ownerAccounting.line.facts.source')} value={t(`ownerAccounting.line.source.${entry.source}`)} />
            {propertyName ? <Fact label={t('ownerAccounting.line.facts.property')} value={propertyName} /> : null}
            {entry.ruleVersion ? <Fact label={t('ownerAccounting.line.facts.rule')} value={entry.ruleVersion} /> : null}
            {entry.taxCode ? <Fact label={t('ownerAccounting.line.facts.taxCode')} value={entry.taxCode} /> : null}
            <Fact label={t('ownerAccounting.line.facts.posted')} value={dateTime(entry.postedAt)} />
          </dl>
          {entry.description ? <p className="break-words text-sm" data-testid="line-description">{entry.description}</p> : null}
          {entry.reversesEntryId ? <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.line.reverses', { id: shortId(entry.reversesEntryId) })}</p> : null}
          {entry.sourceDocumentId ? <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.line.document')}</p> : null}
        </section>

        {booking || payment || entry.attachmentReference ? (
          <section aria-labelledby="line-open-title" className="space-y-2">
            <h3 id="line-open-title" className="text-sm font-semibold">
              {t('ownerAccounting.line.open.title')}
            </h3>
            <ul role="list" className="space-y-1 text-sm">
              {booking ? (
                <li>
                  <Link to={booking} className="font-medium text-primary underline underline-offset-4" data-testid="line-open-source">
                    {entry.source === 'WireBatch' ? t('ownerAccounting.line.open.wires') : t('ownerAccounting.line.open.booking')}
                  </Link>
                </li>
              ) : null}
              {payment ? (
                <li>
                  <Link to={payment} className="font-medium text-primary underline underline-offset-4" data-testid="line-open-payment">
                    {t('ownerAccounting.line.open.payment')}
                  </Link>
                </li>
              ) : null}
              {entry.attachmentReference ? (
                <li className="break-words">
                  {attachmentUrl ? (
                    <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4" data-testid="line-open-attachment">
                      {t('ownerAccounting.line.open.attachment')}
                    </a>
                  ) : (
                    <span>{t('ownerAccounting.line.open.attachmentText', { reference: entry.attachmentReference })}</span>
                  )}
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-foreground/70">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
