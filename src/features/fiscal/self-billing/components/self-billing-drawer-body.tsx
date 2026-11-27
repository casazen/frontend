import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { isFeatureEnabled } from '@/config/feature-flags';
import { hasCurrencyCode, sdiStateOf } from '@/features/fiscal/documents/document-model';
import { DocumentSdiPanel } from '@/features/fiscal/documents/document-sdi-panel';
import { StatePill } from '@/features/fiscal/documents/document-state-badge';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { useDownloadFiscalDocument } from '@/queries/use-fiscal-documents';
import { useSelfBillingBusy, useSelfBillingDetail } from '@/queries/use-self-billing';
import type { SelfBillingListItem } from '@/types';
import { canCloseNotDue, canDiscardDraft, canIssueDraft, isClosedNotDue, isCorrectedOriginal, replacesAnInvoice } from '../self-billing-model';
import { keptWords, money } from '../self-billing-words';
import { ClosedDetails } from './closed-details';
import { CurrencyMissing } from './currency-missing';
import { DiscardDialog } from './discard-dialog';
import { IssueDialog } from './issue-dialog';
import { StatusBadge } from './status-badge';

const TH = 'px-2 py-2 text-left font-medium text-foreground/70';
const TH_NUM = 'px-2 py-2 text-right font-medium text-foreground/70';
const TD = 'px-2 py-2 align-top';
const TD_NUM = 'px-2 py-2 text-right align-top tabular-nums';

interface DrawerBodyProps {
  id: string;
  onClose: () => void;
  mayCorrect: boolean;
  mayClose: boolean;
  closedIds: ReadonlySet<string>;
  onCorrect: (item: SelfBillingListItem) => void;
  onCloseNotDue: (item: SelfBillingListItem) => void;
  onRedoDrafts: (year: number, month: number) => void;
  onOpenReplacement: (id: string) => void;
}

export function DrawerBody({ id, onClose, mayCorrect, mayClose, closedIds, onCorrect, onCloseNotDue, onRedoDrafts, onOpenReplacement }: DrawerBodyProps) {
  const { t, i18n } = useTranslation();
  const { month } = useOwnerFormat();
  const query = useSelfBillingDetail(id);
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const download = useDownloadFiscalDocument();
  const busy = useSelfBillingBusy([id]);
  const [dialog, setDialog] = useState<'issue' | 'discard' | null>(null);
  const detail = getHttpStatus(query.error) === 404 || query.isError ? undefined : query.data;
  // What the API asks. The TD17 themselves (the issue, the discard) are behind `agency.invoice.manage`, which is the role that opens this page (`AgencyFinanceGate`: the owner and the administrators), and the flag of the
  // issuance: nothing of the rental areas is asked of them (an administrator of the account may hold no membership of those). The sending of an issued TD17 to the SDI is on the endpoints of the fiscal documents, which
  // ask `payment.write`: the panel offers it only to who holds it.
  const canManage = isFeatureEnabled(flags, 'fiscalDocumentIssuance');
  const canSend = canManage && hasPermission('short-rent', 'payment.write');

  let content;
  if (getHttpStatus(query.error) === 404) {
    content = (
      <p className="text-sm text-foreground/70" data-testid="self-billing-detail-gone">
        {t('selfBilling.detail.gone')}
      </p>
    );
  } else if (query.isPending) {
    content = (
      <p role="status" className="text-sm text-foreground/70">
        {t('selfBilling.detail.loading')}
      </p>
    );
  } else if (query.isError || detail === undefined) {
    content = <ErrorState title={t('selfBilling.detail.loadError')} error={query.error} onRetry={() => void query.refetch()} />;
  } else {
    const { invoice } = detail;
    const issued = invoice.status === 'Issued';
    const draft = invoice.status === 'Draft';
    // A draft that holds the number of a rejected TD17 is issued, never discarded; one that is kept (nothing gives it a TD17 now) can be neither, and says why, and is closed as «non più dovuta» by who may. A rejected TD17
    // is corrected when the server says it can be. The original a correction discarded is history, as in its row: «Sostituita», its rejection, the way to what replaces it, and no action; a draft that was closed is history too.
    const issuable = draft && canManage && canIssueDraft(invoice);
    const discardable = draft && canManage && canDiscardDraft(invoice);
    const correctable = mayCorrect && invoice.canCorrect;
    const closable = mayClose && canCloseNotDue(invoice);
    const closed = isClosedNotDue(invoice);
    const original = isCorrectedOriginal(invoice);
    const replacementId = invoice.replacedByDocumentId;
    const replacementClosed = replacementId !== null && closedIds.has(replacementId);
    const money2 = (amount: number) => money(amount, invoice.currency, i18n.language);
    content = (
      <div className="space-y-5" data-testid="self-billing-detail" data-status={invoice.status}>
        <div className="space-y-2">
          <p className="text-3xl font-semibold tabular-nums" data-testid="self-billing-detail-total">
            {money2(invoice.total)}
          </p>
          {hasCurrencyCode(invoice.currency) ? null : <CurrencyMissing />}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={original ? (replacementClosed ? 'RejectedClosed' : 'Replaced') : closed ? 'ClosedNotDue' : invoice.status} />
            {issued || original ? <StatePill state={sdiStateOf({ sdiStatus: invoice.sdiStatus, sdiErrorCode: null })} testId="self-billing-detail-sdi" /> : null}
          </div>
          <p className="break-words text-sm text-foreground/70">{t('selfBilling.detail.holder', { holder: invoice.holderName, portal: invoice.portalName })}</p>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t('selfBilling.detail.lines.title')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="self-billing-lines">
              <caption className="sr-only">{t('selfBilling.detail.lines.title')}</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className={TH}>{t('selfBilling.detail.lines.description')}</th>
                  <th scope="col" className={TH_NUM}>{t('selfBilling.detail.lines.amount')}</th>
                  <th scope="col" className={TH_NUM}>{t('selfBilling.detail.lines.vat')}</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((line) => (
                  <tr key={line.lineNumber} className="border-b last:border-0" data-testid="self-billing-line">
                    <td className={`${TD} min-w-0 break-words`}>{line.description}</td>
                    <td className={TD_NUM}>{money2(line.totalPrice)}</td>
                    <td className={TD_NUM}>{line.vatAmount === null ? t('selfBilling.detail.lines.rate', { rate: line.vatRatePercent }) : `${money2(line.vatAmount)} (${t('selfBilling.detail.lines.rate', { rate: line.vatRatePercent })})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex items-baseline justify-between gap-4"><dt className="text-foreground/70">{t('selfBilling.detail.totals.base')}</dt><dd className="tabular-nums">{money2(invoice.taxableBase)}</dd></div>
            <div className="flex items-baseline justify-between gap-4"><dt className="text-foreground/70">{t('selfBilling.detail.totals.vat')}</dt><dd className="tabular-nums">{money2(invoice.vatAmount)}</dd></div>
            <div className="flex items-baseline justify-between gap-4 border-t border-border pt-1 font-semibold"><dt>{t('selfBilling.detail.totals.total')}</dt><dd className="tabular-nums">{money2(invoice.total)}</dd></div>
          </dl>
        </section>

        {draft && detail.estimatedAmount > 0 ? (
          <Alert variant="warning" title={t('selfBilling.detail.estimate.title')} data-testid="self-billing-estimate">
            {t('selfBilling.detail.estimate.body', { amount: money2(detail.estimatedAmount) })}
          </Alert>
        ) : null}
        {detail.ruleVersion ? <p className="text-xs text-foreground/70">{t('selfBilling.detail.rule', { version: detail.ruleVersion })}</p> : null}
        {original && replacementId !== null ? (
          <Alert
            variant="info"
            title={t(replacementClosed ? 'selfBilling.detail.replaced.closedTitle' : 'selfBilling.detail.replaced.title')}
            data-testid="self-billing-replaced"
            data-replacement-closed={replacementClosed ? 'true' : undefined}
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenReplacement(replacementId)} data-testid="self-billing-replacement-open">
                {t('selfBilling.detail.replaced.open')}
              </Button>
            }
          >
            {t(replacementClosed ? 'selfBilling.detail.replaced.closedBody' : 'selfBilling.detail.replaced.body')}
          </Alert>
        ) : closed ? (
          <Alert variant="info" title={t('selfBilling.closed.title')} data-testid="self-billing-closed-alert">
            <ClosedDetails item={invoice} testId="self-billing-closed" />
          </Alert>
        ) : invoice.keptReason !== null ? (
          <Alert variant="warning" title={t('selfBilling.detail.kept.title')} data-testid="self-billing-kept" data-reason={invoice.keptReason}>
            {keptWords(t, invoice.keptReason, closable)}
          </Alert>
        ) : replacesAnInvoice(invoice) ? (
          <Alert
            variant="info"
            title={invoice.number ? t('selfBilling.detail.replaces.title', { number: invoice.number }) : t('selfBilling.detail.replaces.titleUnknown')}
            data-testid="self-billing-replaces"
          >
            {draft ? t('selfBilling.detail.replaces.body') : null}
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-2" data-testid="self-billing-actions">
          {issuable ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => setDialog('issue')} data-testid="self-billing-issue">
              {t('selfBilling.detail.issue.button')}
            </Button>
          ) : null}
          {discardable ? (
            <Button type="button" size="sm" variant="danger-outline" disabled={busy} onClick={() => setDialog('discard')} data-testid="self-billing-discard">
              {t('selfBilling.detail.discard.button')}
            </Button>
          ) : null}
          {correctable ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => onCorrect(invoice)} aria-label={t('selfBilling.correct.buttonLabel', { title: `${invoice.holderName} · ${invoice.portalName}` })} data-testid="self-billing-correct">
              {t('selfBilling.correct.button')}
            </Button>
          ) : null}
          {closable ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onCloseNotDue(invoice)} aria-label={t('selfBilling.close.buttonLabel', { title: `${invoice.holderName} · ${invoice.portalName}` })} data-testid="self-billing-close">
              {t('selfBilling.close.button')}
            </Button>
          ) : null}
          {issued ? (
            <>
              <Button type="button" size="sm" variant="outline" disabled={busy || download.isPending} loading={download.isPending && download.variables?.format === 'pdf'} onClick={() => download.mutate({ document: { id: invoice.id, source: 'CasaZen', number: invoice.number }, format: 'pdf' })} data-testid="self-billing-pdf">
                {t('selfBilling.detail.pdf')}
              </Button>
              {detail.hasXml ? (
                <Button type="button" size="sm" variant="outline" disabled={busy || download.isPending} loading={download.isPending && download.variables?.format === 'xml'} onClick={() => download.mutate({ document: { id: invoice.id, source: 'CasaZen', number: invoice.number }, format: 'xml' })} data-testid="self-billing-xml">
                  {t('selfBilling.detail.xml')}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>

        {issued ? (
          <DocumentSdiPanel
            document={{ id: invoice.id, source: 'CasaZen', status: invoice.status, sdiStatus: invoice.sdiStatus, purpose: 'SelfBilling', kind: 'Invoice', number: invoice.number, issueDate: invoice.issueDate }}
            flags={flags}
            canWrite={canSend}
            onCorrect={() => undefined}
          />
        ) : null}

        {dialog === 'issue' ? <IssueDialog detail={detail} onClose={() => setDialog(null)} onRedoDrafts={onRedoDrafts} /> : null}
        {dialog === 'discard' ? <DiscardDialog id={id} onClose={() => setDialog(null)} onDiscarded={onClose} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <SheetHeader>
        <SheetTitle>{detail ? t('selfBilling.detail.titleFor', { month: month(detail.invoice.periodYear, detail.invoice.periodMonth) }) : t('selfBilling.detail.title')}</SheetTitle>
        <SheetDescription>{t('selfBilling.detail.description')}</SheetDescription>
      </SheetHeader>
      <div className="px-6">{content}</div>
    </div>
  );
}
