import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/shared/form-field-error';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { formatBookingCode, isValidBookingCode } from '@/lib/booking-code';
import type { GuestBookingEmailLookup, GuestBookingPhoneLookup } from '@/types';

export type GuestAccessProof = Omit<GuestBookingEmailLookup, 'orgSlug'> | Omit<GuestBookingPhoneLookup, 'orgSlug'>;

type ProofMethod = 'email' | 'phone';

const bookingCodeField = z
  .string()
  .trim()
  .min(1, 'publicBooking.guestBookings.codeRequired')
  .refine(isValidBookingCode, 'publicBooking.guestBookings.codeInvalid');

const emailField = z
  .string()
  .trim()
  .min(1, 'publicBooking.guestBookings.emailRequired')
  .email('publicBooking.emailValidation');

const phoneLast4Field = z.string().trim().regex(/^\d{4}$/, 'publicBooking.guestBookings.proofPhoneInvalid');

const emailLookupSchema = z.object({ bookingCode: bookingCodeField, email: emailField, phoneLast4: z.string() });
const phoneLookupSchema = z.object({ bookingCode: bookingCodeField, email: z.string(), phoneLast4: phoneLast4Field });

type LookupForm = z.infer<typeof emailLookupSchema>;

interface GuestAccessFormProps {
  /** The code the form starts with: the one of the link of an email, or of the session that ended; empty otherwise. */
  initialCode: string;
  pending: boolean;
  onSubmit: (proof: GuestAccessProof) => void;
}

/**
 * The form that opens the guest session of a booking site: booking code and one proof (BK-11, DB-06c). It is mounted only while it is shown, so the proof is always empty when it
 * comes back (after "Esci" or when a session has ended) and the code starts as the one of the link or of the ended session; it is also what the guest-access widget of the embeddable
 * pages shows (NF-144).
 *
 * The proof is the email the booking was made with and, while the flag `whiteLabelHost` is on (NF-143), the last four digits of the guest's phone as a choice of its own (two radio buttons:
 * the keyboard moves between them with the arrows). With the flag off the form is the code and the email, as it always was. Whatever the guest types stays in the memory of the form: the digits
 * are never put in an address, in the storage of the browser, in a query key or in a log, and the form does not say which of the two halves is wrong: that is the answer of the page (one text
 * for every failure to find a booking).
 */
export function GuestAccessForm({ initialCode, pending, onSubmit }: GuestAccessFormProps) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const proofChoice = flags.whiteLabelHost;
  const [chosen, setChosen] = useState<ProofMethod>('email');
  const method: ProofMethod = proofChoice ? chosen : 'email';

  const {
    register,
    handleSubmit,
    resetField,
    clearErrors,
    formState: { errors },
  } = useForm<LookupForm>({
    resolver: zodResolver(method === 'phone' ? phoneLookupSchema : emailLookupSchema),
    defaultValues: { bookingCode: initialCode, email: '', phoneLast4: '' },
  });

  const chooseMethod = (next: ProofMethod) => {
    setChosen(next);
    resetField('email');
    resetField('phoneLast4');
    clearErrors(['email', 'phoneLast4']);
  };

  const submit = (data: LookupForm) => {
    const bookingCode = formatBookingCode(data.bookingCode) ?? data.bookingCode;
    onSubmit(method === 'phone' ? { bookingCode, phoneLast4: data.phoneLast4 } : { bookingCode, email: data.email });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate data-testid="guest-bookings-form">
      <div className="space-y-2">
        <Label htmlFor="guest-booking-code">{t('publicBooking.guestBookings.codeLabel')}</Label>
        <Input
          id="guest-booking-code"
          placeholder={t('publicBooking.guestBookings.codePlaceholder')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono uppercase tracking-wider"
          disabled={pending}
          aria-invalid={errors.bookingCode ? true : undefined}
          aria-describedby="guest-booking-code-hint"
          {...register('bookingCode')}
        />
        <p id="guest-booking-code-hint" className="text-xs text-muted-foreground">
          {t('publicBooking.guestBookings.codeHint')}
        </p>
        <FormFieldError error={errors.bookingCode} />
      </div>

      {proofChoice ? (
        <ChoiceGroup legend={t('publicBooking.guestBookings.proofLegend')} legendVisible minCardWidth={9}>
          <ChoiceCard
            name="guest-access-proof"
            value="email"
            title={t('publicBooking.guestBookings.proofEmail')}
            checked={method === 'email'}
            onChange={() => chooseMethod('email')}
            disabled={pending}
            data-testid="guest-access-proof-email"
          />
          <ChoiceCard
            name="guest-access-proof"
            value="phone"
            title={t('publicBooking.guestBookings.proofPhone')}
            checked={method === 'phone'}
            onChange={() => chooseMethod('phone')}
            disabled={pending}
            data-testid="guest-access-proof-phone"
          />
        </ChoiceGroup>
      ) : null}

      {method === 'phone' ? (
        <div className="space-y-2">
          <Label htmlFor="guest-booking-phone-last4">{t('publicBooking.guestBookings.proofPhoneLabel')}</Label>
          <Input
            id="guest-booking-phone-last4"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            spellCheck={false}
            className="font-mono tracking-widest"
            disabled={pending}
            aria-invalid={errors.phoneLast4 ? true : undefined}
            aria-describedby={errors.phoneLast4 ? 'guest-booking-phone-last4-hint guest-booking-phone-last4-error' : 'guest-booking-phone-last4-hint'}
            data-testid="guest-booking-phone-last4"
            {...register('phoneLast4')}
          />
          <p id="guest-booking-phone-last4-hint" className="text-xs text-muted-foreground">
            {t('publicBooking.guestBookings.proofPhoneHint')}
          </p>
          <FormFieldError error={errors.phoneLast4} id="guest-booking-phone-last4-error" />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="guest-booking-email">{t('publicBooking.guestBookings.emailLabel')}</Label>
          <Input
            id="guest-booking-email"
            type="email"
            autoComplete="email"
            placeholder={t('publicBooking.emailPlaceholder')}
            disabled={pending}
            aria-invalid={errors.email ? true : undefined}
            {...register('email')}
          />
          <FormFieldError error={errors.email} />
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {pending ? t('publicBooking.guestBookings.searching') : t('publicBooking.guestBookings.submit')}
      </Button>
    </form>
  );
}
