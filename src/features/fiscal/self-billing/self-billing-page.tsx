import { useTranslation } from 'react-i18next';
import { AgencyAccessRefused, AgencyFinanceGate } from '@/components/finance/agency-finance-gate';
import { PageHeader } from '@/components/layout/page-header';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { SkeletonCard } from '@/components/ui/skeleton';
import { hasCurrencyCode } from '@/features/fiscal/documents/document-model';
import { parsePeriod } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { getHttpStatus } from '@/lib/api-errors';
import { CloseNotDueDialog } from './components/close-not-due-dialog';
import { CorrectDialog } from './components/correct-dialog';
import { CurrencyMissing } from './components/currency-missing';
import { GenerationReport } from './components/generation-report';
import { SelfBillingDrawer } from './components/self-billing-drawer';
import { SelfBillingRow } from './components/self-billing-row';
import { useSelfBillingState } from './use-self-billing-state';

/**
 * «Autofatture (TD17)» (E17/F03/US01/T02, E17/F01/US03/T01, NF-116, D17): the invoices that CasaZen makes for an Italian account holder when a foreign portal charges it a commission with no VAT (TD17, the reverse
 * charge on a service from abroad). Per month: «Prepara le bozze» makes (or makes again) the drafts from the owner ledger of the month, one for each holder and portal; each draft is reviewed (its lines, one for each
 * property, the VAT integrated, and the part of the amount that is an estimate, which the person has to accept) and issued after a confirmation; an issued one has its PDF, its XML and its state towards the SDI, with the
 * panel that sends it or declares it. The choices of the accountant (the rate, the day, the series) are the configuration of the server (⚖), and the page says so. It is behind the role and the plan of the
 * agency's money (`AgencyFinanceGate`) and the flag of the issuance of fiscal documents (off: no page, no entry in the menu); the amounts are the server's, each in its own currency.
 *
 * A TD17 the SDI rejected is corrected from here («Correggi e rimanda», FIX/FE-TD17-CORRECTION, backend `POST api/fiscal/self-billing/{id}/correct`): it counts as not issued, stays in the list as history (with a reference to
 * what replaces it, and no action) and a draft with the same number replaces it, which is issued with the issue of the page and can never be discarded. A draft that holds such a number and that nothing gives any more is
 * kept, and says why. The action is for who may use the actions of the page and needs the flag of the sending to the SDI too; with the flag off nothing of it is drawn or asked.
 *
 * A kept replacement draft (it holds the number of a rejected TD17 and the month no longer supports it) leaves with «Chiudi come non più dovuta» (FIX/FE-TD17-CLOSE-NOT-DUE, backend
 * `POST api/fiscal/self-billing/{id}/close-not-due`), for the same people and with the same flags as the correction: the person says why (mandatory, three reasons) and may leave a note, and the draft is closed for
 * good, its number staying reserved (never given to another invoice, and listed for the accountant in the register of the unused numbers). The closed draft is history in the list and in its detail, with the reason, the
 * day, the name of the person (nothing when the person is not known any more, never an id) and the note, and with no action.
 */
export function SelfBillingPage() {
  const { t } = useTranslation();
  return (
    <AgencyFinanceGate testId="self-billing-page" title={t('selfBilling.page.title')} description={t('selfBilling.page.description')} loadingLabel={t('selfBilling.page.loading')}>
      <SelfBillingBody />
    </AgencyFinanceGate>
  );
}

function SelfBillingBody() {
  const { t } = useTranslation();
  const { month } = useOwnerFormat();
  const {
    thisMonth,
    period,
    setPeriod,
    openId,
    setOpenId,
    correcting,
    setCorrecting,
    closing,
    setClosing,
    generation,
    list,
    closedIds,
    drafts,
    busy,
    monthOptions,
    mayCorrect,
    mayClose,
    prepare,
    redoDrafts,
  } = useSelfBillingState(t);

  let content;
  if (getHttpStatus(list.error) === 404) {
    content = (
      <p className="break-words text-sm text-foreground/70" data-testid="self-billing-unavailable">
        {t('selfBilling.page.unavailable')}
      </p>
    );
  } else if (list.isPending) {
    content = <SkeletonCard lines={4} label={t('selfBilling.page.loading')} />;
  } else if (getHttpStatus(list.error) === 403) {
    content = <AgencyAccessRefused />;
  } else if (list.isError) {
    content = <ErrorState title={t('selfBilling.page.loadError')} error={list.error} onRetry={() => void list.refetch()} testId="self-billing-error" />;
  } else if (list.data.length === 0) {
    content = (
      <p className="break-words text-sm text-foreground/70" data-testid="self-billing-empty">
        {t(period === '' ? 'selfBilling.page.empty' : 'selfBilling.page.emptyMonth')}
      </p>
    );
  } else {
    content = (
      <PlainSection title={t('selfBilling.page.listTitle')} count={list.data.length} data-testid="self-billing-list">
        {list.data.some((item) => !hasCurrencyCode(item.currency)) ? <CurrencyMissing /> : null}
        <ul role="list" className="divide-y divide-border">
          {list.data.map((item) => (
            <SelfBillingRow
              key={item.id}
              item={item}
              mayCorrect={mayCorrect}
              mayClose={mayClose}
              replacementClosed={item.replacedByDocumentId !== null && closedIds.has(item.replacedByDocumentId)}
              onOpen={() => setOpenId(item.id)}
              onCorrect={() => setCorrecting(item)}
              onCloseNotDue={() => setClosing(item)}
              onOpenReplacement={setOpenId}
            />
          ))}
        </ul>
      </PlainSection>
    );
  }

  return (
    <div className="space-y-6" data-testid="self-billing-page">
      <PageHeader title={t('selfBilling.page.title')} description={t('selfBilling.page.description')} crumbs="auto" />
      <div className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
        <p className="max-w-prose break-words text-sm text-muted-foreground" data-testid="self-billing-note">
          {t('selfBilling.page.note')}
        </p>

        <div className="flex flex-wrap items-end gap-3" data-testid="self-billing-filters">
          <Field label={t('selfBilling.page.filterPeriod')} className="w-full sm:w-64">
            <Select value={period} onChange={(event) => setPeriod(event.target.value)} data-testid="self-billing-period">
              <option value="">{t('selfBilling.page.allMonths')}</option>
              {monthOptions.map((value) => {
                const parsed = parsePeriod(value, thisMonth);
                return (
                  <option key={value} value={value}>
                    {month(parsed.year, parsed.month)}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Button type="button" disabled={period === '' || busy} loading={drafts.isPending} onClick={() => prepare(period)} data-testid="self-billing-prepare">
            {t('selfBilling.drafts.button')}
          </Button>
        </div>
        {period === '' ? <p className="text-sm text-foreground/70">{t('selfBilling.drafts.needMonth')}</p> : null}

      </div>

      {generation ? <GenerationReport generation={generation} closedIds={closedIds} mayClose={mayClose} /> : null}
      {content}

      <SelfBillingDrawer
        id={openId}
        onClose={() => setOpenId(null)}
        mayCorrect={mayCorrect}
        mayClose={mayClose}
        closedIds={closedIds}
        onCorrect={setCorrecting}
        onCloseNotDue={setClosing}
        onRedoDrafts={redoDrafts}
        onOpenReplacement={setOpenId}
      />

      {correcting !== null ? (
        <CorrectDialog
          key={correcting.id}
          item={correcting}
          onClose={() => setCorrecting(null)}
          onCorrected={(replacement) => {
            if (replacement !== null) setOpenId(replacement.invoice.id);
          }}
        />
      ) : null}

      {closing !== null ? <CloseNotDueDialog key={closing.id} item={closing} onClose={() => setClosing(null)} /> : null}
    </div>
  );
}
