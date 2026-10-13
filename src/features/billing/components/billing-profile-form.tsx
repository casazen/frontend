import { useMemo, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/shared/form-field-error';
import { getCountryOptions } from '@/lib/countries';
import { billingProfileSchema, type BillingProfileValues } from '../billing-profile.schema';

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface BillingProfileFormProps {
  /** Prefix of the field ids: the form can appear twice on a page (billing page and checkout dialog). */
  idPrefix: string;
  defaultValues: BillingProfileValues;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  onSubmit: (values: BillingProfileValues) => void;
  /** Rendered between the fields and the buttons (e.g. an error of the last submit). */
  children?: ReactNode;
  /** Extra button next to the submit one (e.g. "Annulla" in a dialog). */
  secondaryAction?: ReactNode;
}

/**
 * Country and VAT id of the org for the subscription invoices (spec-saas-billing AC12). The VAT id is only checked for
 * its shape here: the backend and Stripe verify it (VIES, task PL-13).
 */
export function BillingProfileForm({
  idPrefix,
  defaultValues,
  submitLabel,
  pendingLabel,
  isPending,
  onSubmit,
  children,
  secondaryAction,
}: BillingProfileFormProps) {
  const { t, i18n } = useTranslation();
  const countryOptions = useMemo(() => getCountryOptions(i18n.language), [i18n.language]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BillingProfileValues>({
    resolver: zodResolver(billingProfileSchema),
    mode: 'onTouched',
    defaultValues,
  });

  const countryId = `${idPrefix}-billing-country`;
  const vatId = `${idPrefix}-vat-id`;
  const vatHintId = `${idPrefix}-vat-id-hint`;

  return (
    <form className="space-y-4" noValidate onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
      <div className="space-y-2">
        <Label htmlFor={countryId}>{t('billing.profile.country')}</Label>
        <select
          id={countryId}
          autoComplete="country"
          className={selectClassName}
          aria-invalid={!!errors.billingCountry}
          disabled={isPending}
          {...register('billingCountry')}
        >
          <option value="">{t('billing.profile.countryPlaceholder')}</option>
          {countryOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
        <FormFieldError error={errors.billingCountry} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={vatId}>{t('billing.profile.vatId')}</Label>
        <Input
          id={vatId}
          autoComplete="off"
          maxLength={30}
          aria-invalid={!!errors.vatId}
          aria-describedby={vatHintId}
          disabled={isPending}
          {...register('vatId')}
        />
        <p id={vatHintId} className="text-xs text-muted-foreground">
          {t('billing.profile.vatIdHint')}
        </p>
        <FormFieldError error={errors.vatId} />
      </div>

      {children}

      <div className="flex flex-wrap justify-end gap-2">
        {secondaryAction}
        <Button type="submit" disabled={isPending}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
