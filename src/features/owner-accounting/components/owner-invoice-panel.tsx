import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { useCreateOwnerInvoiceDraft, useDownloadOwnerInvoicePdf, useIssueOwnerInvoice, useOwnerInvoices } from '@/queries/use-owner-invoices';
import type { OwnerInvoice, OwnerInvoiceListItem, OwnerStatementVersion } from '@/types';
import { InvoiceSettlement } from '@/features/owner-invoices/invoice-settlement';
import {
  creditedInvoicesOfVersion,
  isDraft,
  isIssued,
  liveInvoiceOfMonth,
  liveInvoiceOfVersion,
  vatSummaryOf,
} from '@/features/owner-invoices/owner-invoice-model';
import { hasNoCurrency, useInvoiceMoney } from '@/features/owner-invoices/use-invoice-money';
import { messageOf, periodParam, problemFacts, statementPath } from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';
import { Disclosure } from './disclosure';
import { OwnerAccountingError } from './owner-accounting-error';

interface OwnerInvoicePanelProps {
  /** The version of the statement the invoice is made from. It is made from the newest version of the month and from no other: a version that was superseded only shows what exists. */
  version: OwnerStatementVersion;
}

/** The types of line an owner invoice has (backend `FiscalLineType`): another one, of a later server, is shown by its code. */
const KNOWN_LINE_TYPES = ['Commission', 'Recharge', 'AdvancedExpense'] as const;

/** The codes of a draft that is not what the server would issue now, or that was issued already: the draft on screen is no longer the invoice, and it is made again. */
const STALE_DRAFT_CODES: ReadonlySet<string> = new Set(['document_draft_outdated', 'document_not_draft']);

/**
 * «Fattura del PM» of a statement version (E13/F02/US01/T03, NF-114): the invoice of the property manager to the owner, made from this version by CasaZen. No invoice yet: «Crea la fattura»
 * makes the draft. A draft: its lines (commission, recharges, expenses advanced for the owner) with their VAT by rate and the total, and «Emetti», which asks for a confirmation that shows
 * the series, the total and what follows. Issued: its number, its day, the PDF, and whether the statement offsets it or the owner has to pay. It is behind the flag `ownerInvoicing`: off, nothing
 * is drawn and nothing asks the server. The write buttons are for the owner and the administrators of the organization (`agency.statement.manage`) and wait while any write or download of the
 * card is on its way. Opening the panel only reads: the draft is made, made again or issued by the person's own click, never in the background.
 */
export function OwnerInvoicePanel({ version }: OwnerInvoicePanelProps) {
  const { flags } = useFeatureFlags();
  if (!isFeatureEnabled(flags, 'ownerInvoicing')) return null;
  return <PanelBody version={version} />;
}

function PanelBody({ version }: OwnerInvoicePanelProps) {
  const { t } = useTranslation();
  // A version is the newest until another one supersedes it: the version says it itself, without waiting for the list of the versions of the month.
  const isCurrent = version.status !== 'Superseded';
  const { contexts } = useWorkspace();
  const money = useInvoiceMoney();
  const { date } = useOwnerFormat();
  // The write permission (`agency.statement.manage`) follows the org role: the owner and the administrators hold it, nobody else does (the server decides, this only keeps the buttons away).
  const canManage = isOrgBillingAdmin(contexts);
  const invoices = useOwnerInvoices({ period: periodParam(version), ownerId: version.ownerId });
  const create = useCreateOwnerInvoiceDraft();
  const issue = useIssueOwnerInvoice();
  const pdf = useDownloadOwnerInvoicePdf();
  // The draft as the server made it a moment ago, with its lines: what the person reviews before issuing. A page that is opened later has only the totals of the list, and asks to review.
  const [reviewed, setReviewed] = useState<OwnerInvoice | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Every button of the card waits while one of its writes or downloads is on its way: a draft made again under an issue, or two issues, would act on an invoice that is changing.
  const busy = create.isPending || issue.isPending || pdf.isPending;

  // A 404 is the module being off at the server, whatever the cache still holds; a refused list (null) is not this person's page. Either way there is no panel.
  if (getHttpStatus(invoices.error) === 404 || invoices.data === null) return null;

  const list = invoices.data;
  const own = list ? liveInvoiceOfVersion(list, version.id) : null;
  const ofMonth = list ? liveInvoiceOfMonth(list) : null;
  const credited = list ? creditedInvoicesOfVersion(list, version.id) : [];
  const reviewedHere = own !== null && reviewed !== null && reviewed.id === own.id ? reviewed : null;

  const makeDraft = () => {
    setNotice(null);
    create.mutate(version.id, {
      onSuccess: (draft) => {
        setReviewed(draft);
        toast.success(t('ownerInvoice.panel.draftMade'));
      },
      onError: (error) => setNotice(messageOf(error, t)),
    });
  };

  const savePdf = (invoice: OwnerInvoiceListItem) =>
    pdf.mutate(
      { invoiceId: invoice.id, fileName: `fattura-${(invoice.number ?? invoice.id).replace(/[\\/]/g, '-')}.pdf` },
      { onError: (error) => toast.error(messageOf(error, t)) },
    );

  const issueNow = async () => {
    if (!reviewed) return;
    try {
      const issued = await issue.mutateAsync(reviewed.id);
      toast.success(t('ownerInvoice.issue.done', { number: issued.number ?? '' }));
      setReviewed(null);
    } catch (error) {
      if (STALE_DRAFT_CODES.has(problemFacts(error).code ?? '')) {
        // The draft is not what would be issued now (or is issued already): it is told, and the person reviews it again before issuing. Nothing was issued.
        setReviewed(null);
        setConfirming(false);
        setNotice(messageOf(error, t));
        return;
      }
      // The dialog stays open with the reason.
      throw error;
    }
  };

  const needsAction = own === null ? isCurrent && canManage && invoices.isSuccess : isDraft(own) && canManage;
  let content;
  if (invoices.isPending) {
    content = (
      <p role="status" className="text-sm text-foreground/70">
        {t('ownerInvoice.panel.loading')}
      </p>
    );
  } else if (invoices.isError || !list) {
    content = <OwnerAccountingError error={invoices.error} title={t('ownerInvoice.panel.loadError')} onRetry={() => void invoices.refetch()} />;
  } else if (own === null) {
    content = (
      <div className="space-y-3" data-testid="owner-invoice-none">
        {ofMonth !== null ? (
          <p className="break-words text-sm">
            {ofMonth.number ? t('ownerInvoice.panel.otherVersionIssued', { number: ofMonth.number }) : t('ownerInvoice.panel.otherVersionDraft')}{' '}
            {ofMonth.statementVersionId ? (
              <Link to={statementPath(ofMonth.statementVersionId)} className="font-medium underline underline-offset-4" data-testid="owner-invoice-other-version">
                {t('ownerInvoice.panel.otherVersionOpen')}
              </Link>
            ) : null}
          </p>
        ) : (
          <p className="break-words text-sm">{isCurrent ? t('ownerInvoice.panel.none') : t('ownerInvoice.panel.superseded')}</p>
        )}
        {isCurrent && canManage && (ofMonth === null || isDraft(ofMonth)) ? (
          <Button type="button" size="sm" loading={create.isPending} disabled={busy && !create.isPending} onClick={makeDraft} data-testid="owner-invoice-create">
            {ofMonth === null ? t('ownerInvoice.panel.create') : t('ownerInvoice.panel.createFromThis')}
          </Button>
        ) : null}
        {isCurrent && !canManage ? <p className="break-words text-sm text-foreground/70">{t('ownerInvoice.panel.readOnly')}</p> : null}
      </div>
    );
  } else if (isDraft(own)) {
    content = (
      <div className="space-y-3" data-testid="owner-invoice-draft">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="warning">{t('ownerInvoice.status.Draft')}</Badge>
          <span className="break-words">{t('ownerInvoice.panel.draft', { total: money(own.total, own.currency) })}</span>
        </p>
        {reviewedHere ? (
          <InvoiceLines invoice={reviewedHere} />
        ) : (
          <InvoiceTotals currency={own.currency} taxable={own.taxableBase} vat={own.vatAmount} stampDuty={own.stampDuty} total={own.total} />
        )}
        {reviewedHere ? null : <p className="break-words text-sm text-foreground/70">{t('ownerInvoice.panel.reviewFirst')}</p>}
        {isCurrent ? (
          canManage ? (
            <div className="flex flex-wrap gap-2">
              {reviewedHere ? (
                <Button type="button" size="sm" disabled={busy} onClick={() => setConfirming(true)} data-testid="owner-invoice-issue">
                  {t('ownerInvoice.panel.issue')}
                </Button>
              ) : null}
              <Button type="button" size="sm" variant={reviewedHere ? 'outline' : 'default'} loading={create.isPending} disabled={busy && !create.isPending} onClick={makeDraft} data-testid="owner-invoice-review">
                {reviewedHere ? t('ownerInvoice.panel.recalculate') : t('ownerInvoice.panel.review')}
              </Button>
            </div>
          ) : (
            <p className="break-words text-sm text-foreground/70">{t('ownerInvoice.panel.readOnly')}</p>
          )
        ) : (
          <p className="break-words text-sm text-foreground/70">{t('ownerInvoice.panel.superseded')}</p>
        )}
      </div>
    );
  } else if (isIssued(own)) {
    content = (
      <div className="space-y-3" data-testid="owner-invoice-issued">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="success">{t('ownerInvoice.status.Issued')}</Badge>
          <span className="break-words font-medium" data-testid="owner-invoice-number">
            {t('ownerInvoice.panel.issued', { number: own.number ?? '', date: date(own.issueDate) })}
          </span>
        </p>
        <InvoiceTotals currency={own.currency} taxable={own.taxableBase} vat={own.vatAmount} stampDuty={own.stampDuty} total={own.total} />
        <p className="break-words text-sm" data-testid="owner-invoice-payment">
          <InvoiceSettlement invoice={own} />
        </p>
        {own.currency === 'CHF' && own.payment?.state === 'to_pay' ? <p className="break-words text-sm text-foreground/70">{t('ownerInvoice.settlement.qrBill')}</p> : null}
        <Button type="button" variant="outline" size="sm" loading={pdf.isPending} disabled={busy && !pdf.isPending} onClick={() => savePdf(own)} data-testid="owner-invoice-pdf">
          {t('ownerInvoice.panel.pdf')}
        </Button>
      </div>
    );
  } else {
    // A state of a later server: told by its code, with nothing to do.
    content = <p className="break-words text-sm">{t('ownerInvoice.panel.unknownState', { status: own.status })}</p>;
  }

  return (
    <Disclosure title={t('ownerInvoice.panel.title')} defaultOpen={needsAction} data-testid="owner-invoice-panel">
      <p className="break-words text-sm text-foreground/70">{t('ownerInvoice.panel.description')}</p>
      {list && list.some((invoice) => hasNoCurrency(invoice)) ? (
        <p className="break-words text-sm text-foreground/70" data-testid="owner-invoice-currency-missing">
          {t('ownerInvoice.currencyMissing')}
        </p>
      ) : null}
      {content}
      {credited.length > 0 ? (
        <ul role="list" className="space-y-1 text-sm text-foreground/70" data-testid="owner-invoice-credited">
          {credited.map((invoice) => (
            <li key={invoice.id} className="break-words">
              {t('ownerInvoice.panel.credited', { number: invoice.number ?? '' })}
            </li>
          ))}
        </ul>
      ) : null}
      {notice ? (
        <Alert variant="danger" data-testid="owner-invoice-notice">
          {notice}
        </Alert>
      ) : null}
      {confirming && reviewedHere ? <IssueDialog invoice={reviewedHere} ownerName={own?.ownerName ?? reviewedHere.ownerName} pending={issue.isPending} onIssue={issueNow} onClose={() => setConfirming(false)} /> : null}
    </Disclosure>
  );
}

interface InvoiceTotalsProps {
  currency: string;
  taxable: number;
  vat: number;
  stampDuty: number;
  total: number;
}

/** The totals of an invoice as the server stored them, in its currency: the taxable amount, the VAT, the stamp duty when there is one, and the total. */
function InvoiceTotals({ currency, taxable, vat, stampDuty, total }: InvoiceTotalsProps) {
  const { t } = useTranslation();
  const money = useInvoiceMoney();
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm" data-testid="owner-invoice-totals">
      <dt className="text-foreground/70">{t('ownerInvoice.totals.taxable')}</dt>
      <dd className="text-right tabular-nums">{money(taxable, currency)}</dd>
      <dt className="text-foreground/70">{t('ownerInvoice.totals.vat')}</dt>
      <dd className="text-right tabular-nums">{money(vat, currency)}</dd>
      {stampDuty > 0 ? (
        <>
          <dt className="text-foreground/70">{t('ownerInvoice.totals.stampDuty')}</dt>
          <dd className="text-right tabular-nums">{money(stampDuty, currency)}</dd>
        </>
      ) : null}
      <dt className="font-semibold">{t('ownerInvoice.totals.total')}</dt>
      <dd className="text-right font-semibold tabular-nums" data-testid="owner-invoice-total">
        {money(total, currency)}
      </dd>
    </dl>
  );
}

/** The lines of the draft with the type of each, the VAT by rate as the server sums it, and the totals. Every amount is in the currency of the invoice. */
function InvoiceLines({ invoice }: { invoice: OwnerInvoice }) {
  const { t } = useTranslation();
  const money = useInvoiceMoney();
  const { percent } = useOwnerFormat();
  const rows = vatSummaryOf(invoice.lines, invoice.vatAmount);

  return (
    <div className="space-y-3" data-testid="owner-invoice-lines">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <caption className="sr-only">{t('ownerInvoice.lines.caption')}</caption>
          <thead>
            <tr className="border-b border-border text-left text-foreground/70">
              <th scope="col" className="py-2 pr-3 font-medium">{t('ownerInvoice.lines.description')}</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">{t('ownerInvoice.lines.net')}</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">{t('ownerInvoice.lines.rate')}</th>
              <th scope="col" className="py-2 text-right font-medium">{t('ownerInvoice.lines.vat')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.lineNumber} className="border-b border-border last:border-0" data-testid="owner-invoice-line" data-type={line.type}>
                <td className="py-2 pr-3 align-top">
                  <span className="break-words">{line.description}</span>
                  <span className="block text-foreground/70">{(KNOWN_LINE_TYPES as readonly string[]).includes(line.type) ? t(`ownerInvoice.lineType.${line.type}`) : line.type}</span>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right align-top tabular-nums">{money(line.totalPrice, invoice.currency)}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right align-top tabular-nums">{line.vatRatePercent === 0 ? (line.vatNatureCode ?? percent(0)) : percent(line.vatRatePercent)}</td>
                <td className="whitespace-nowrap py-2 text-right align-top tabular-nums">{line.vatAmount === null ? '' : money(line.vatAmount, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul role="list" className="space-y-1 text-sm" data-testid="owner-invoice-vat-rates" aria-label={t('ownerInvoice.vat.title')}>
        {rows.map((row) => (
          <li key={`${row.rate}-${row.nature ?? ''}`} className="break-words" data-rate={row.rate}>
            {row.rate === 0
              ? t('ownerInvoice.vat.outside', { nature: row.nature ? ` (${row.nature})` : '', taxable: money(row.taxable, invoice.currency) })
              : row.tax === null
                ? t('ownerInvoice.vat.rateWithoutTax', { rate: percent(row.rate), taxable: money(row.taxable, invoice.currency) })
                : t('ownerInvoice.vat.rate', { rate: percent(row.rate), taxable: money(row.taxable, invoice.currency), tax: money(row.tax, invoice.currency) })}
          </li>
        ))}
      </ul>
      <InvoiceTotals currency={invoice.currency} taxable={invoice.taxableBase} vat={invoice.vatAmount} stampDuty={invoice.stampDuty} total={invoice.total} />
    </div>
  );
}

interface IssueDialogProps {
  invoice: OwnerInvoice;
  ownerName: string | null;
  pending: boolean;
  /** Issues the draft; it throws when the server refuses, so the dialog stays open and says why. */
  onIssue: () => Promise<void>;
  onClose: () => void;
}

/**
 * The confirmation of the issue: what is issued (the series and the total, the owner and the month) and what follows. The number is not known yet: the server gives it in the same
 * moment, in sequence and without gaps, and an issued invoice never changes.
 */
function IssueDialog({ invoice, ownerName, pending, onIssue, onClose }: IssueDialogProps) {
  const { t } = useTranslation();
  const money = useInvoiceMoney();
  const { month } = useOwnerFormat();
  const [error, setError] = useState<string | null>(null);
  const period = invoice.periodYear !== null && invoice.periodMonth !== null ? month(invoice.periodYear, invoice.periodMonth) : '';
  const consequences = [t('ownerInvoice.issue.consequenceNumber'), t('ownerInvoice.issue.consequenceFinal')];
  if (invoice.vatAmount > 0) consequences.push(t('ownerInvoice.issue.consequenceVat'));

  const run = async () => {
    setError(null);
    try {
      await onIssue();
    } catch (failure) {
      setError(messageOf(failure, t));
      throw failure;
    }
  };

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('ownerInvoice.issue.title')}
      description={t('ownerInvoice.issue.description', { owner: ownerName ?? '', period })}
      confirmLabel={t('ownerInvoice.issue.confirm')}
      consequences={consequences}
      isLoading={pending}
      onConfirm={run}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="owner-invoice-issue-facts">
        {invoice.series ? (
          <>
            <dt className="text-foreground/70">{t('ownerInvoice.issue.series')}</dt>
            <dd className="break-words font-medium" data-testid="owner-invoice-issue-series">{invoice.series}</dd>
          </>
        ) : null}
        <dt className="text-foreground/70">{t('ownerInvoice.issue.number')}</dt>
        <dd className="break-words">{t('ownerInvoice.issue.numberNext')}</dd>
        <dt className="text-foreground/70">{t('ownerInvoice.issue.total')}</dt>
        <dd className="font-medium tabular-nums" data-testid="owner-invoice-issue-total">{money(invoice.total, invoice.currency)}</dd>
      </dl>
      {error ? (
        <Alert variant="danger" data-testid="owner-invoice-issue-error">
          {error}
        </Alert>
      ) : null}
    </ConfirmationDialog>
  );
}
