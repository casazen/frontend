import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toBillingProfileRequest } from '@/features/billing/billing-profile.schema';
import { BillingProfileForm } from '@/features/billing/components/billing-profile-form';
import { getCountryOptions } from '@/lib/countries';
import { useUpdateBillingProfile } from '@/queries/use-billing';
import type { BillingSubscription } from '@/types';
import { BillingDisclosure } from './billing-disclosure';

/**
 * "Dati di fatturazione": what the invoices of the subscription are made out with. Country and VAT number are the form the billing
 * page has always had (same endpoint, same checks); the data of the Italian e-invoice that the backend keeps (SDI code, PEC, tax
 * code) are shown as they are, with no form yet.
 */
export function BillingDataSection({ subscription }: { subscription: BillingSubscription }) {
  const { t, i18n } = useTranslation();
  const updateProfile = useUpdateBillingProfile();

  const countryName = useMemo(
    () => getCountryOptions(i18n.language).find((option) => option.code === subscription.billingCountry)?.name,
    [i18n.language, subscription.billingCountry],
  );
  const summary = [countryName ?? subscription.billingCountry, subscription.vatId].filter(Boolean).join(' · ') || t('accountBilling.data.empty');

  const eInvoice: { label: string; value: string | null | undefined }[] = [
    { label: t('accountBilling.data.sdi'), value: subscription.sdiRecipientCode },
    { label: t('accountBilling.data.pec'), value: subscription.pecEmail },
    { label: t('accountBilling.data.fiscalCode'), value: subscription.fiscalCode },
  ];
  const filled = eInvoice.filter((row) => !!row.value);

  return (
    <BillingDisclosure testId="account-billing-data" title={t('accountBilling.data.title')} summary={summary}>
      <p className="text-sm text-foreground/70">{t('billing.profile.description')}</p>
      <BillingProfileForm
        // The form takes its values once: after a save the page reads the subscription again, and the form starts over from what was kept.
        key={`${subscription.billingCountry ?? ''}|${subscription.vatId ?? ''}`}
        idPrefix="billing-profile"
        defaultValues={{ billingCountry: subscription.billingCountry ?? '', vatId: subscription.vatId ?? '' }}
        submitLabel={t('billing.profile.save')}
        pendingLabel={t('billing.profile.saving')}
        isPending={updateProfile.isPending}
        onSubmit={(values) => updateProfile.mutate(toBillingProfileRequest(values))}
      />
      {filled.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t('accountBilling.data.eInvoice')}</h3>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
            {filled.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-foreground/70">{row.label}</dt>
                <dd className="break-words font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </BillingDisclosure>
  );
}
