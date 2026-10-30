import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, IdCard, ShieldCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBooking } from '@/features/public-booking/booking/booking-context';
import { detailsSchema, type DetailsFormValues } from '@/features/public-booking/checkout/details-schema';
import { arrivalSlots, suggestEmail, type DetailsValues } from '@/features/public-booking/checkout/checkout-model';
import { shortTime } from '@/features/public-booking/lib/property-profile';
import { getCountryOptions } from '@/lib/countries';
import { cn } from '@/lib/utils';
import '@/features/public-booking/checkout/checkout.css';

const SELECT_CLASS =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface StepDetailsProps {
  values: DetailsValues;
  /** Called on every change, so going back and forth between the steps loses nothing. */
  onChange: (values: DetailsValues) => void;
  /** The site has a text for the optional «send me offers» consent (its version): only then the box is there. */
  offersVersion: string | null | undefined;
  siteName: string;
  onBack: () => void;
  onNext: () => void;
}

/**
 * Step 2, «I tuoi dati» (DB-05): who books. Name and surname in two fields (the API asks for two), the email with a gentle correction
 * when its domain looks like a typo, the phone if the guest wants, the country, the expected arrival time if the check-in window is
 * known, and the optional offers box (never ticked for the guest, and only when the site has a text for it). Errors say how to fix
 * and take the focus to the first wrong field. The documents of the travellers are asked later, with the online check-in.
 */
export function StepDetails({ values, onChange, offersVersion, siteName, onBack, onNext }: StepDetailsProps) {
  const { t, i18n } = useTranslation();
  const { property } = useBooking();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<DetailsFormValues>({ resolver: zodResolver(detailsSchema), mode: 'onTouched', defaultValues: values });
  const countryOptions = useMemo(() => getCountryOptions(i18n.language), [i18n.language]);

  // Kept as the guest types (and only the values that are valid are not required to be): the draft survives a step back.
  const watched = useWatch({ control });
  useEffect(() => {
    onChange({
      firstName: watched.firstName ?? '',
      lastName: watched.lastName ?? '',
      email: watched.email ?? '',
      phone: watched.phone ?? '',
      country: watched.country ?? '',
      arrival: watched.arrival ?? '',
      offers: watched.offers ?? false,
    });
  }, [watched.firstName, watched.lastName, watched.email, watched.phone, watched.country, watched.arrival, watched.offers, onChange]);

  const email = watched.email ?? '';
  const suggestion = suggestEmail(email.trim());

  const from = shortTime(property.checkInFrom);
  const to = shortTime(property.checkInTo);
  const slots = from && to ? arrivalSlots(from, to) : [];

  const submit = handleSubmit(() => onNext());

  return (
    <form onSubmit={(event) => void submit(event)} noValidate data-testid="checkout-step-details">
      <section className="co-section" aria-labelledby="co-who-title">
        <h2 id="co-who-title">{t('publicCheckout.details.whoTitle')}</h2>
        <div className="co-fields">
          <div className="co-row">
            <Field label={t('publicBooking.firstName')} error={errors.firstName}>
              <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
            </Field>
            <Field label={t('publicBooking.lastName')} error={errors.lastName}>
              <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
            </Field>
          </div>
          <div className="space-y-2">
            <Field label={t('publicBooking.email')} hint={t('publicCheckout.details.emailHint')} error={errors.email}>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={t('publicBooking.emailPlaceholder')}
                {...register('email')}
              />
            </Field>
            {suggestion ? (
              <p className="flex flex-wrap items-center gap-x-2 text-sm" role="status" data-testid="checkout-email-suggestion">
                <span>{t('publicCheckout.details.emailDidYouMean', { email: suggestion })}</span>
                <button
                  type="button"
                  className="min-h-11 font-semibold underline underline-offset-4"
                  onClick={() => setValue('email', suggestion, { shouldDirty: true, shouldValidate: true })}
                >
                  {t('publicCheckout.details.emailUse', { email: suggestion })}
                </button>
              </p>
            ) : null}
          </div>
          <div className="co-row">
            <Field label={t('publicBooking.phone')} hint={t('publicCheckout.details.phoneHint')} optional error={errors.phone}>
              <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" {...register('phone')} />
            </Field>
            <Field label={t('publicBooking.country')} error={errors.country}>
              <select id="country" autoComplete="country" className={SELECT_CLASS} {...register('country')}>
                <option value="">{t('publicBooking.countryPlaceholder')}</option>
                {countryOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </section>

      {slots.length > 0 ? (
        <section className="co-section" aria-labelledby="co-arrival-title">
          <h2 id="co-arrival-title">{t('publicCheckout.details.arrivalTitle')}</h2>
          <Field
            label={t('publicCheckout.details.arrivalLabel')}
            hint={t('publicCheckout.details.arrivalHint', { from, to })}
            optional
          >
            <select id="arrival" className={SELECT_CLASS} {...register('arrival')}>
              <option value="">{t('publicCheckout.details.arrivalUnknown')}</option>
              {slots.map((slot, index) => (
                <option key={slot} value={slot}>
                  {`${slot} – ${slots[index + 1] ?? to}`}
                </option>
              ))}
              <option value="late">{t('publicCheckout.details.arrivalLate', { time: to })}</option>
            </select>
          </Field>
        </section>
      ) : null}

      <section className={cn('co-section', 'space-y-3')}>
        {offersVersion ? (
          <Controller
            control={control}
            name="offers"
            render={({ field }) => (
              <div className="flex items-start gap-3">
                <Checkbox id="offers" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                <Label htmlFor="offers" className="cursor-pointer text-sm leading-relaxed">
                  {t('publicCheckout.details.offers', { name: siteName })}
                  <small className="block text-[var(--cz-public-muted)]">
                    {t('publicCheckout.details.offersHint')} {t('publicCheckout.optional')}
                  </small>
                </Label>
              </div>
            )}
          />
        ) : null}
        <p className="co-note">
          <IdCard aria-hidden />
          <span>{t('publicCheckout.details.documentsNote')}</span>
        </p>
      </section>

      <div className="co-submit">
        <button type="submit" className="public-site-cta co-cta border-0" data-testid="checkout-next">
          <span>{t('publicCheckout.details.next')}</span>
          <ArrowRight aria-hidden />
        </button>
        <p className="co-submit__after">
          <ShieldCheck aria-hidden />
          <span>{t('publicCheckout.payNothingYet')}</span>
        </p>
      </div>
      <button type="button" className="co-backlink" onClick={onBack} data-testid="checkout-back">
        <ArrowLeft aria-hidden />
        <span>{t('publicCheckout.details.back')}</span>
      </button>
    </form>
  );
}
