import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Circle, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getProblemMessage } from '@/lib/api-errors';
import { formatCurrency } from '@/lib/utils';
import { formatRomeDateTime, formatStayDate } from '@/lib/stay-dates';
import {
  getAlloggiatiStatusLabel,
  getBookingSourceLabel,
  getServiceCategoryLabel,
  getServiceRequestStatusLabel,
} from '@/lib/i18n-labels';
import { useServiceRequests, useSuppliersByProperty } from '@/queries/use-service-requests';
import { ServiceCategorySelect } from '@/features/service-requests/components/service-category-picker';
import { guestDataCompletionPath } from '@/features/bookings/lib/stay-actions';
import {
  CHECKOUT_WIZARD_STEPS,
  TOURIST_TAX_COLLECTIONS,
  type CheckoutWizardState,
  type CheckoutWizardStepId,
  type TouristTaxCollection,
} from '@/types/compliance.types';
import { canOpenStep, isStepAnswered, type CheckoutDraft } from '../checkout-wizard-model';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type DraftChange = (change: Partial<CheckoutDraft>) => void;

/** Progress of the 5 steps: each one can be opened once the steps before it are answered (CO-17). */
export function CheckoutStepper({
  draft,
  onSelect,
}: {
  draft: CheckoutDraft;
  onSelect: (step: CheckoutWizardStepId) => void;
}) {
  const { t } = useTranslation();
  const answered = CHECKOUT_WIZARD_STEPS.filter((step) => isStepAnswered(draft, step)).length;

  return (
    <nav aria-label={t('compliance.checkout.progress', { done: answered, total: CHECKOUT_WIZARD_STEPS.length })}>
      <ol className="flex flex-wrap gap-2" data-testid="checkout-wizard-progress">
        {CHECKOUT_WIZARD_STEPS.map((step, index) => {
          const current = step === draft.step;
          const done = isStepAnswered(draft, step);
          return (
            <li key={step}>
              <button
                type="button"
                data-testid={`checkout-step-${step}`}
                data-status={done ? 'complete' : 'pending'}
                aria-current={current ? 'step' : undefined}
                disabled={!canOpenStep(draft, step)}
                onClick={() => onSelect(step)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${
                  current ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" aria-hidden />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                )}
                <span>{`${index + 1}. ${t(`compliance.checkout.steps.${step}.title`)}`}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SummaryRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

/** Step 1: the stay being closed and the confirmation that the guest left. */
export function StaySummaryStep({
  state,
  draft,
  onChange,
}: {
  state: CheckoutWizardState;
  draft: CheckoutDraft;
  onChange: DraftChange;
}) {
  const { t, i18n } = useTranslation();
  const { stay } = state;

  return (
    <div className="space-y-4" data-testid="checkout-step-panel-stay-summary">
      <dl className="divide-y rounded-md border px-4 py-2">
        <SummaryRow label={t('compliance.checkout.stay.guest')} value={stay.guestName || t('compliance.checkout.guestFallback')} />
        <SummaryRow label={t('compliance.checkout.stay.property')} value={stay.propertyName} testId="checkout-stay-property" />
        <SummaryRow
          label={t('compliance.checkout.stay.dates')}
          value={t('compliance.checkout.stay.datesValue', {
            from: formatStayDate(stay.checkInDate, i18n.language),
            to: formatStayDate(stay.checkOutDate, i18n.language),
            count: stay.nights,
          })}
          testId="checkout-stay-dates"
        />
        <SummaryRow
          label={t('compliance.checkout.stay.guests')}
          value={t('compliance.checkout.stay.guestsValue', {
            count: stay.numberOfGuests,
            children: stay.numberOfChildren,
          })}
        />
        <SummaryRow label={t('compliance.checkout.stay.source')} value={getBookingSourceLabel(stay.source, t)} />
      </dl>
      <div className="flex items-start gap-3">
        <Checkbox
          id="confirm-departure"
          data-testid="checkout-confirm-departure"
          checked={draft.departureConfirmed}
          onCheckedChange={(checked) => onChange({ departureConfirmed: checked === true })}
        />
        <Label htmlFor="confirm-departure" className="leading-relaxed">
          {t('compliance.checkout.confirmDepartureLabel')}
        </Label>
      </div>
    </div>
  );
}

/** Step 2: the Alloggiati Web communication of the stay; never blocking, with the link where the host sends it. */
export function AlloggiatiStep({ state }: { state: CheckoutWizardState }) {
  const { t, i18n } = useTranslation();
  const { alloggiati } = state;
  const failed = alloggiati.status === 'Errore' || alloggiati.status === 'Rifiutato';

  return (
    <div className="space-y-4" data-testid="checkout-step-panel-alloggiati">
      <p className="text-sm">
        {t('compliance.checkout.alloggiati.status')}{' '}
        <span className="font-medium" data-testid="checkout-alloggiati-status">
          {getAlloggiatiStatusLabel(alloggiati.status, t)}
        </span>
      </p>
      {alloggiati.sent ? (
        <p className="flex items-center gap-2 text-sm text-green-700" data-testid="checkout-alloggiati-sent">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {t('compliance.checkout.alloggiati.sentHint')}
        </p>
      ) : (
        <div
          className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          data-testid="checkout-alloggiati-to-send"
          role="status"
        >
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {failed ? t('compliance.checkout.alloggiati.failedHint') : t('compliance.checkout.alloggiati.toSendHint')}
          </p>
          {alloggiati.isOverdue && (
            <p data-testid="checkout-alloggiati-overdue">
              {t('compliance.checkout.alloggiati.overdue', {
                deadline: formatRomeDateTime(alloggiati.deadlineAt, i18n.language),
              })}
            </p>
          )}
          {!alloggiati.dataComplete && <p>{t('compliance.checkout.alloggiati.dataIncomplete')}</p>}
        </div>
      )}
      <Link
        to={guestDataCompletionPath(state.bookingId)}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        data-testid="checkout-alloggiati-link"
      >
        {t('compliance.checkout.alloggiati.open')}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

/**
 * Step 3: cleaning request to a supplier active in the property's comune for the category, or "skip". The request is
 * created with the check-out, tied to the stay (SU-07); the requests already sent for the stay are listed.
 */
export function CleaningStep({
  state,
  draft,
  onChange,
}: {
  state: CheckoutWizardState;
  draft: CheckoutDraft;
  onChange: DraftChange;
}) {
  const { t } = useTranslation();
  const requesting = draft.cleaningChoice === 'Request';
  const category = draft.serviceCategory || undefined;
  const suppliers = useSuppliersByProperty(requesting && category ? state.stay.propertyId : undefined, category);
  const supplierOptions = suppliers.data?.items ?? [];
  const existing = useServiceRequests({ bookingId: state.bookingId, pageSize: 20 });

  return (
    <div className="space-y-4" data-testid="checkout-step-panel-cleaning">
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('compliance.checkout.cleaning.existingTitle')}</p>
        {existing.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('serviceRequest.listLoading')}
          </p>
        ) : existing.isError ? (
          <p role="alert" className="text-sm text-destructive" data-testid="checkout-cleaning-existing-error">
            {getProblemMessage(existing.error, t) ?? t('serviceRequest.listLoadError')}
          </p>
        ) : (existing.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="checkout-cleaning-existing-empty">
            {t('serviceRequest.emptyForStay')}
          </p>
        ) : (
          <ul className="space-y-1 text-sm" data-testid="checkout-cleaning-existing">
            {existing.data?.items.map((request) => (
              <li key={request.id}>
                {`${getServiceCategoryLabel(request.category, t)} · ${request.supplierName ?? ''} · ${getServiceRequestStatusLabel(request.status, t)}`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('compliance.checkout.cleaning.question')}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="checkout-cleaning"
            data-testid="checkout-cleaning-request"
            checked={requesting}
            onChange={() => onChange({ cleaningChoice: 'Request' })}
          />
          {t('compliance.checkout.cleaning.request')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="checkout-cleaning"
            data-testid="checkout-cleaning-skip"
            checked={draft.cleaningChoice === 'Skip'}
            onChange={() => onChange({ cleaningChoice: 'Skip' })}
          />
          {t('compliance.checkout.cleaning.skip')}
        </label>
      </fieldset>

      {requesting && (
        <div className="space-y-4 rounded-md border p-4">
          <div className="space-y-2">
            <Label htmlFor="checkout-cleaning-category">{t('serviceRequest.category')}</Label>
            <ServiceCategorySelect
              id="checkout-cleaning-category"
              value={draft.serviceCategory}
              onChange={(value) => onChange({ serviceCategory: value, supplierOrgId: null })}
              data-testid="checkout-cleaning-category"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkout-cleaning-supplier">{t('serviceRequest.supplier')}</Label>
            {suppliers.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="checkout-suppliers-loading">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('serviceRequest.suppliersLoading')}
              </p>
            ) : suppliers.isError ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert" data-testid="checkout-suppliers-error">
                <span>{getProblemMessage(suppliers.error, t) ?? t('serviceRequest.suppliersLoadError')}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => void suppliers.refetch()}>
                  {t('serviceRequest.retry')}
                </Button>
              </div>
            ) : supplierOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="checkout-suppliers-empty">
                {t('compliance.checkout.cleaning.noSuppliers', { city: state.stay.propertyCity })}
              </p>
            ) : (
              <select
                id="checkout-cleaning-supplier"
                className={selectClass}
                value={supplierOptions.some((s) => s.orgId === draft.supplierOrgId) ? (draft.supplierOrgId ?? '') : ''}
                onChange={(e) => onChange({ supplierOrgId: e.target.value || null })}
                data-testid="checkout-cleaning-supplier"
              >
                <option value="">{t('serviceRequest.selectSupplier')}</option>
                {supplierOptions.map((supplier) => (
                  <option key={supplier.orgId} value={supplier.orgId}>
                    {supplier.legalName}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkout-cleaning-notes">{t('compliance.checkout.serviceNotes')}</Label>
            <Textarea
              id="checkout-cleaning-notes"
              value={draft.serviceNotes}
              maxLength={1000}
              onChange={(e) => onChange({ serviceNotes: e.target.value })}
              rows={3}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Step 4: the tourist tax recorded on the booking (BK-03) and how it was collected. Without an amount CasaZen says so
 * and never invents one; the host declares the collection anyway.
 */
export function TouristTaxStep({
  state,
  draft,
  onChange,
}: {
  state: CheckoutWizardState;
  draft: CheckoutDraft;
  onChange: DraftChange;
}) {
  const { t } = useTranslation();
  const { touristTax } = state;

  return (
    <div className="space-y-4" data-testid="checkout-step-panel-tourist-tax">
      {touristTax.recordedAmount !== null ? (
        <p className="text-sm" data-testid="checkout-tourist-tax-amount">
          {t('compliance.checkout.touristTax.recorded', {
            amount: formatCurrency(touristTax.recordedAmount, touristTax.currency),
          })}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="checkout-tourist-tax-unknown">
          {t('compliance.checkout.touristTax.notRecorded')}
        </p>
      )}
      {touristTax.collectedWithOnlinePayment && (
        <p className="text-sm text-muted-foreground" data-testid="checkout-tourist-tax-paid-online">
          {t('compliance.checkout.touristTax.paidOnline')}
        </p>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('compliance.checkout.touristTax.question')}</legend>
        {TOURIST_TAX_COLLECTIONS.map((collection: TouristTaxCollection) => (
          <label key={collection} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="checkout-tourist-tax"
              data-testid={`checkout-tourist-tax-${collection}`}
              checked={draft.touristTaxCollection === collection}
              onChange={() => onChange({ touristTaxCollection: collection })}
            />
            {t(`compliance.checkout.touristTax.collection.${collection}`)}
          </label>
        ))}
      </fieldset>
      {draft.touristTaxCollection === 'NotCollected' && (
        <p className="flex items-start gap-2 text-sm text-amber-800" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('compliance.checkout.touristTax.notCollectedHint')}
        </p>
      )}
    </div>
  );
}

/** Step 5: the property is ready for the next guest, or not yet (it stays in the cockpit), with notes. */
export function PropertyReadyStep({ draft, onChange }: { draft: CheckoutDraft; onChange: DraftChange }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4" data-testid="checkout-step-panel-property-ready">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('compliance.checkout.propertyReady.question')}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="checkout-property-ready"
            data-testid="checkout-property-ready-yes"
            checked={draft.propertyReady === true}
            onChange={() => onChange({ propertyReady: true })}
          />
          {t('compliance.checkout.propertyReady.yes')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="checkout-property-ready"
            data-testid="checkout-property-ready-no"
            checked={draft.propertyReady === false}
            onChange={() => onChange({ propertyReady: false })}
          />
          {t('compliance.checkout.propertyReady.no')}
        </label>
      </fieldset>
      {draft.propertyReady === false && (
        <p className="text-sm text-muted-foreground">{t('compliance.checkout.propertyReady.notReadyHint')}</p>
      )}
      <div className="space-y-2">
        <Label htmlFor="checkout-property-notes">{t('compliance.checkout.propertyReady.notes')}</Label>
        <Textarea
          id="checkout-property-notes"
          data-testid="checkout-property-notes"
          value={draft.propertyNotes}
          maxLength={1000}
          onChange={(e) => onChange({ propertyNotes: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
}
