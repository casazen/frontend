import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import { WizardSummary, type WizardSummaryItem } from '@/components/shared/wizard/wizard-summary';
import { Alert } from '@/components/ui/alert';
import { billingItemTextKey, billingStepOfItem } from '@/lib/onboarding-billing';
import type { AccountantPackageSettings, BillingSetup, FiscalIssuerPreview } from '@/types';
import { BILLING_STEPS, type BillingStepId } from '../billing-wizard-ids';
import { addressLine, currencyOfCountry, missingItemsOf, ownerIssuersMissing, regimeOfValues } from '../billing-wizard-model';
import { PORTAL_SOURCES, type BillingWizardValues } from '../billing-wizard-schema';
import { DocumentExample } from './document-example';

interface SummaryStepProps {
  /** The setup as the server has it now: what is missing is what the server says, never what the form seems to hold. */
  setup: BillingSetup | undefined;
  /** The answers of the whole wizard. */
  values: BillingWizardValues;
  /** The steps this person has: an item opens its step only when the step is one of them. */
  steps: readonly BillingStepId[];
  /** The tax rule in force, for the example. */
  preview: Pick<UseQueryResult<FiscalIssuerPreview>, 'data' | 'isPending' | 'isError'>;
  /**
   * The settings of the send to the accountant as the server has them now, `null` while they cannot be read: the row of the step «Commercialista» says what is SAVED (the monthly send only
   * happens if it is), and never writes the address of a third party on the page.
   */
  accountant?: AccountantPackageSettings | null;
}

/**
 * The last step, «Riepilogo»: what is still missing, each item with the step that fixes it («Completa» opens it), what was answered, each answer with «Modifica», and the
 * example document with the rates in force in the currency of the issuer. Nothing is saved here: «Fatto» closes the wizard, and the part «Fatturazione» of the guide is done
 * only when the server says nothing is missing, so a wizard closed with something left is never told as done.
 */
export function SummaryStep({ setup, values, steps, preview, accountant }: SummaryStepProps) {
  const { t } = useTranslation();
  const wizard = useOptionalWizard();
  const missing = missingItemsOf(setup);
  const currency = currencyOfCountry(values.countryCode);
  const stepLabel = (id: BillingStepId) => wizard?.steps.find((step) => step.id === id)?.label ?? '';
  const has = (id: BillingStepId) => steps.includes(id);

  const regime = regimeOfValues(values);
  const items: WizardSummaryItem[] = [
    { id: 'country', label: t('billingWizard.summary.items.country'), value: values.countryCode ? t(`billingWizard.issuer.country.${values.countryCode}.title`) : null, stepId: BILLING_STEPS.issuer },
    { id: 'name', label: t('billingWizard.summary.items.name'), value: values.legalName.trim(), stepId: BILLING_STEPS.issuer },
    { id: 'address', label: t('billingWizard.summary.items.address'), value: addressLine(values), stepId: BILLING_STEPS.issuer },
    { id: 'regime', label: t('billingWizard.summary.items.regime'), value: regime ? t(`billingWizard.labels.regime.${regime}`) : null, stepId: BILLING_STEPS.vat },
    {
      id: 'numbering',
      label: t('billingWizard.summary.items.numbering'),
      value: values.guestDocumentSeries.trim() && values.ownerInvoiceSeries.trim() ? t('billingWizard.summary.numbering', { guest: values.guestDocumentSeries.trim(), owner: values.ownerInvoiceSeries.trim() }) : null,
      stepId: BILLING_STEPS.numbering,
    },
  ];
  if (values.countryCode === 'CH') {
    const byPortal = PORTAL_SOURCES.filter((portal) => values.touristTaxCollectors[portal] === 'portal').map((portal) => t(`booking.source.${portal}`));
    const answered = PORTAL_SOURCES.every((portal) => values.touristTaxCollectors[portal] === 'portal' || values.touristTaxCollectors[portal] === 'host');
    items.push({
      id: 'touristTax',
      label: t('billingWizard.summary.items.touristTax'),
      value: answered ? (byPortal.length > 0 ? t('billingWizard.summary.touristTax.portals', { portals: byPortal.join(', ') }) : t('billingWizard.summary.touristTax.none')) : null,
      stepId: BILLING_STEPS.touristTax,
    });
  }
  if (has(BILLING_STEPS.channels)) {
    items.push({
      id: 'channels',
      label: t('billingWizard.summary.items.channels'),
      value: t(`billingWizard.channels.holder.names.${values.portalAccountHolder}`),
      stepId: BILLING_STEPS.channels,
    });
  }
  items.push({
    id: 'issuing',
    label: t('billingWizard.summary.items.issuing'),
    value: t('billingWizard.summary.issuing', {
      auto: t(values.autoIssueGuestDocuments ? 'billingWizard.summary.automatic' : 'billingWizard.summary.manual'),
      email: t(values.emailGuestDocuments ? 'billingWizard.summary.emailYes' : 'billingWizard.summary.emailNo'),
    }),
    stepId: BILLING_STEPS.issuing,
  });
  // The owners who issue the documents of their stays (E17/F03/US01/T01): a row only where the step exists. It is answered when the setup says no owner misses a profile, and the count is the server's.
  if (has(BILLING_STEPS.ownerIssuers)) {
    const owners = ownerIssuersMissing(setup);
    items.push({
      id: 'ownerIssuers',
      label: t('billingWizard.summary.items.ownerIssuers'),
      value: setup && owners === 0 ? t('billingWizard.summary.ownerIssuers.ready') : null,
      stepId: BILLING_STEPS.ownerIssuers,
    });
  }
  // The optional step of the accountant: a row only where the step exists. «Nessun invio automatico» is an answer too (the step may be left as it is); a setting that cannot be read is not.
  if (has(BILLING_STEPS.accountant)) {
    items.push({
      id: 'accountant',
      label: t('billingWizard.summary.items.accountant'),
      value: accountant ? (accountant.enabled ? t('billingWizard.summary.accountant.monthly', { day: accountant.sendDay }) : t('billingWizard.summary.accountant.none')) : null,
      stepId: BILLING_STEPS.accountant,
    });
  }
  // A row has a link to its step only where the person has the step.
  const rows = items.map((item) => ({ ...item, stepId: item.stepId && has(item.stepId as BillingStepId) ? item.stepId : undefined }));

  return (
    <>
      {missing.length > 0 ? (
        <Alert variant="warning" title={t('billingWizard.summary.missing.title', { count: missing.length })} data-testid="billing-missing">
          <ul role="list" className="mt-1 space-y-1">
            {missing.map((item) => {
              const step = billingStepOfItem(item);
              const link = step && has(step) && wizard ? step : null;
              return (
                <li key={`${item.section}-${item.key}`} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1" data-testid={`billing-missing-${item.key}`}>
                  <span className="min-w-0 break-words">{t(billingItemTextKey(item.key), item.count === undefined ? {} : { count: item.count })}</span>
                  {link && wizard ? (
                    <Link
                      to={wizard.hrefFor(link)}
                      aria-label={t('billingWizard.summary.missing.openStep', { step: stepLabel(link) })}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t('billingWizard.summary.missing.complete')}
                    </Link>
                  ) : (
                    <span className="shrink-0 text-sm text-foreground/70">{t('billingWizard.summary.missing.byAdmin')}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Alert>
      ) : setup ? (
        <Alert variant="success" icon={CheckCircle2} title={t('billingWizard.summary.complete.title')} data-testid="billing-complete">
          {t('billingWizard.summary.complete.text')}
        </Alert>
      ) : null}

      <div className="@container">
        <div className="grid min-w-0 gap-5 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @4xl:items-start">
          <WizardSummary items={rows} />
          <DocumentExample
            rule={preview.data?.rule}
            state={preview.isPending ? 'loading' : preview.isError ? 'error' : 'ready'}
            currency={currency}
          />
        </div>
      </div>
    </>
  );
}
