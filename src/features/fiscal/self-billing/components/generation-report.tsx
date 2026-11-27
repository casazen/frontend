import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { hasCurrencyCode } from '@/features/fiscal/documents/document-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import type { SelfBillingGeneration } from '@/types';
import { codeWords, keptWords, money } from '../self-billing-words';
import { CurrencyMissing } from './currency-missing';

/**
 * What the drafts of the month did, in words: the counts, the owner ledger of the month when it is not posted yet (the drafts read it), the holders that need an invoice and cannot get one yet with what their issuer
 * profile misses, the commissions that are not self-billed with the reason, and the drafts that hold the number of a rejected TD17 and that nothing gives now (kept, with their number and why). It says «fatto» only for
 * what was done: a holder that could not get its draft, and a number that is held, are told, never left out and never read as «nothing to do».
 * The report is what the run found, but a draft it listed as kept that the list says was closed since (`closedIds`) holds nothing any more: it is left out, so the report never contradicts the list below it.
 */
export function GenerationReport({ generation, closedIds, mayClose }: { generation: SelfBillingGeneration; closedIds: ReadonlySet<string>; mayClose: boolean }) {
  const { t, i18n } = useTranslation();
  const { month } = useOwnerFormat();
  const kept = generation.kept.filter((row) => !closedIds.has(row.documentId));
  const problems = generation.failed.length > 0 || kept.length > 0 || !generation.ledgerPosted;

  return (
    <Alert variant={problems ? 'warning' : 'success'} title={t('selfBilling.drafts.report.title', { month: month(generation.year, generation.month) })} role="status" data-testid="self-billing-report">
      <div className="space-y-2">
        {!generation.ledgerPosted ? (
          <p className="break-words" data-testid="self-billing-ledger-not-posted">
            {t('selfBilling.drafts.report.ledgerNotPosted')}
          </p>
        ) : null}
        <p className="break-words" data-testid="self-billing-report-counts">
          {t('selfBilling.drafts.report.counts', { created: generation.created, updated: generation.updated, issued: generation.alreadyIssued, discarded: generation.discarded })}
        </p>
        {generation.failed.length > 0 ? (
          <div data-testid="self-billing-report-failed">
            <p className="font-medium">{t('selfBilling.drafts.report.failed', { count: generation.failed.length })}</p>
            <ul role="list" className="mt-1 list-disc space-y-1 pl-5">
              {generation.failed.map((failure, index) => (
                <li key={`${failure.holderKind}-${failure.holderOwnerId ?? ''}-${failure.portalName}-${index}`} className="break-words">
                  {t('selfBilling.drafts.report.failedRow', {
                    holder: t(`selfBilling.holder.${failure.holderKind === 'Owner' ? 'Owner' : 'Agency'}`),
                    portal: failure.portalName,
                    reason: codeWords('selfBilling.reason', failure.code, t, i18n.exists),
                  })}
                  {failure.fields.length > 0 ? ` ${t('selfBilling.drafts.report.fields', { fields: failure.fields.map((field) => (i18n.exists(`ownerIssuer.fields.${field}.label`) ? t(`ownerIssuer.fields.${field}.label`) : field)).join(', ') })}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {kept.length > 0 ? (
          <div data-testid="self-billing-report-kept">
            <p className="font-medium">{t('selfBilling.drafts.report.kept', { count: kept.length })}</p>
            <ul role="list" className="mt-1 list-disc space-y-1 pl-5">
              {kept.map((row) => {
                const holder = t(`selfBilling.holder.${row.holderKind === 'Owner' ? 'Owner' : 'Agency'}`);
                return (
                  <li key={row.documentId} className="break-words" data-testid="self-billing-report-kept-row">
                    <span className="font-medium">
                      {row.number ? t('selfBilling.drafts.report.keptRow', { holder, portal: row.portalName, number: row.number }) : t('selfBilling.drafts.report.keptRowNoNumber', { holder, portal: row.portalName })}
                    </span>
                    <span className="block">{keptWords(t, row.reason, mayClose)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {generation.notDue.length > 0 ? (
          <div data-testid="self-billing-report-not-due">
            <p className="font-medium">{t('selfBilling.drafts.report.notDue')}</p>
            <ul role="list" className="mt-1 list-disc space-y-1 pl-5">
              {generation.notDue.map((row, index) => (
                <li key={`${row.channel}-${row.reason}-${index}`} className="break-words">
                  {t('selfBilling.drafts.report.notDueRow', {
                    channel: row.channel,
                    count: row.stays,
                    amount: money(row.amount, row.currency, i18n.language),
                    reason: codeWords('selfBilling.notDue', row.reason, t, i18n.exists),
                  })}
                </li>
              ))}
            </ul>
            {generation.notDue.some((row) => !hasCurrencyCode(row.currency)) ? <CurrencyMissing /> : null}
          </div>
        ) : null}
      </div>
    </Alert>
  );
}
