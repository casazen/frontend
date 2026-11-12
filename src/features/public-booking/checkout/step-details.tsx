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
import { translateValidationMessage } from '@/i18n/validation-message';
import { getCountryOptions } from '@/lib/countries';
import { cn } from '@/lib/utils';
import '@/features/public-booking/checkout/checkout.css';

const SELECT_CLASS =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface StepDetailsProps {
  values: DetailsValues;
  /** Called on every change, so going back and forth between the steps loses nothing. */
  onChange: (values: DetailsValues) => void;
  /** The site has a text for the optional «send me offers» consent (its version): only then the two boxes (E-mail, WhatsApp) are there. */
  offersVersion: string | null | undefined;
  /** The site has a soft opt-in notice (art. 130 c. 4, its version): only then the notice is shown under the e-mail field. */
  softOptInNoticeVersion?: string | null;
  siteName: string;
  onBack: () => void;
  onNext: () => void;
}

/**
 * Step 2, «I tuoi dati» (DB-05): who books. Name and surname in two fields (the API asks for two), the email with a gentle correction
 * when its domain looks like a typo (and, when the site has one, the soft opt-in notice: a paragraph, not a box, that blocks nothing), the
 * phone if the guest wants, the country, the expected arrival time if the check-in window is known, and the optional offers boxes, one
 * per channel (NF-90: «E-mail» and «WhatsApp», never ticked for the guest, only when the site has a text for them; WhatsApp waits for a
 * phone number). Errors say how to fix and take the focus to the first wrong field. The documents of the travellers are asked later,
 * with the online check-in.
 */
export function StepDetails({ values, onChange, offersVersion, softOptInNoticeVersion, siteName, onBack, onNext }: StepDetailsProps) {
  const { t, i18n } = useTranslation();
  const { property } = useBooking();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
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
      offersEmail: watched.offersEmail ?? false,
      offersWhatsApp: watched.offersWhatsApp ?? false,
    });
  }, [
    watched.firstName,
    watched.lastName,
    watched.email,
    watched.phone,
    watched.country,
    watched.arrival,
    watched.offersEmail,
    watched.offersWhatsApp,
    onChange,
  ]);

  const email = watched.email ?? '';
  const suggestion = suggestEmail(email.trim());
  // The WhatsApp box needs a number: until one is typed it cannot be ticked (a box already ticked stays free, so it can be unticked).
  const phoneTyped = (watched.phone ?? '').trim() !== '';
  const whatsAppError = translateValidationMessage(errors.offersWhatsApp?.message, t, i18n);
  // The number is only for the arrival, until the guest chooses to be written to on WhatsApp with it: the hint says both.
  const phoneHint = offersVersion ? t('publicCheckout.details.phoneHintOffers') : t('publicCheckout.details.phoneHint');

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
            {/* The soft opt-in notice (art. 130 c. 4, PO-07): a notice, not a box. It asks nothing and blocks nothing; the version goes with the booking. */}
            {softOptInNoticeVersion ? (
              <p className="text-sm leading-relaxed text-[var(--cz-public-muted)]" data-testid="checkout-soft-opt-in-notice">
                {t('publicCheckout.details.softOptInNotice', { name: siteName })}
              </p>
            ) : null}
          </div>
          <div className="co-row">
            <Field label={t('publicBooking.phone')} hint={phoneHint} optional error={errors.phone}>
              {/* A number typed or cleared changes what the WhatsApp box may do: its message is checked again at once, not at the next press. */}
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                {...register('phone', { onChange: () => void trigger('offersWhatsApp') })}
              />
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
          <fieldset className="space-y-3" data-testid="checkout-offers">
            <legend className="text-sm leading-relaxed">
              {t('publicCheckout.details.offersLegend', { name: siteName })}{' '}
              <span className="text-[var(--cz-public-muted)]">{t('publicCheckout.optional')}</span>
            </legend>
            <Controller
              control={control}
              name="offersEmail"
              render={({ field }) => (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="offersEmail"
                    ref={field.ref}
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    data-testid="checkout-offers-email"
                  />
                  <Label htmlFor="offersEmail" className="cursor-pointer text-sm leading-relaxed">
                    {t('publicCheckout.details.offersEmail')}
                  </Label>
                </div>
              )}
            />
            <Controller
              control={control}
              name="offersWhatsApp"
              render={({ field }) => (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="offersWhatsApp"
                    ref={field.ref}
                    checked={field.value}
                    disabled={!phoneTyped && !field.value}
                    aria-describedby={[!phoneTyped ? 'offersWhatsApp-hint' : '', whatsAppError ? 'offersWhatsApp-error' : ''].filter(Boolean).join(' ') || undefined}
                    aria-invalid={whatsAppError ? true : undefined}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    data-testid="checkout-offers-whatsapp"
                  />
                  <Label htmlFor="offersWhatsApp" className={cn('text-sm leading-relaxed', phoneTyped || field.value ? 'cursor-pointer' : 'cursor-not-allowed')}>
                    {t('publicCheckout.details.offersWhatsApp')}
                    {!phoneTyped ? (
                      <small id="offersWhatsApp-hint" className="block text-[var(--cz-public-muted)]" data-testid="checkout-offers-whatsapp-hint">
                        {t('publicCheckout.details.offersWhatsAppNeedsPhone')}
                      </small>
                    ) : null}
                  </Label>
                </div>
              )}
            />
            {whatsAppError ? (
              <p id="offersWhatsApp-error" role="alert" className="text-sm text-destructive" data-testid="checkout-offers-whatsapp-error">
                {whatsAppError}
              </p>
            ) : null}
            <p className="text-sm text-[var(--cz-public-muted)]">{t('publicCheckout.details.offersHint')}</p>
          </fieldset>
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
