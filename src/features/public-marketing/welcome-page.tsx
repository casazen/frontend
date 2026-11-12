import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Check, House, Link2Off, Loader2, MailCheck, WifiOff } from 'lucide-react';
import { z } from 'zod';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hasInternationalPrefix, isValidPhone } from '@/features/public-booking/checkout/details-schema';
import { LEGAL_DOCUMENT_PATHS } from '@/features/legal/legal-paths';
import { translateValidationMessage } from '@/i18n/validation-message';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { useSeoMeta } from '@/lib/seo-meta';
import { useSubmitWelcomeConsent, useWelcomePage } from '@/queries/welcome';
import type { WelcomePageData } from '@/types/welcome.types';
import { MarketingLinkCard } from './marketing-link-card';

/** Same limits as the API (`WelcomeConsentRequest`). */
const EMAIL_MAX_LENGTH = 255;
const PHONE_MAX_LENGTH = 40;

/** The code the API gives when the text of the consent changed since the page was loaded (409). */
const CONSENT_OUTDATED_CODE = 'welcome_consent_outdated';

/**
 * What the guest types and ticks. The messages are i18n keys that `Field` translates. The e-mail is needed only with the E-mail box (the
 * confirmation goes there, and the API reads the address only then: data minimisation), the phone only with the WhatsApp box. The rules are
 * the API's (`WelcomeConsentService`): of age, at least one channel, and a number for WhatsApp, which must say its country (`+` or `00`).
 * Nothing is ticked at the start.
 */
const welcomeFormSchema = z
  .object({
    email: z.string().trim().max(EMAIL_MAX_LENGTH),
    phone: z
      .string()
      .trim()
      .max(PHONE_MAX_LENGTH, 'publicBooking.validation.phoneInvalid')
      .refine((value) => value === '' || isValidPhone(value), 'publicBooking.validation.phoneInvalid'),
    consentEmail: z.boolean(),
    consentWhatsApp: z.boolean(),
    adultConfirmed: z.boolean(),
  })
  .superRefine((values, context) => {
    if (!values.consentEmail && !values.consentWhatsApp) {
      context.addIssue({ code: 'custom', path: ['consentEmail'], message: 'marketing.welcome.errors.channelRequired' });
    }
    // A guest who only wants WhatsApp types no address: it would be asked for nothing and never sent.
    if (values.consentEmail && values.email === '') {
      context.addIssue({ code: 'custom', path: ['email'], message: 'publicBooking.validation.emailRequired' });
    } else if (values.consentEmail && !z.regexes.email.test(values.email)) {
      context.addIssue({ code: 'custom', path: ['email'], message: 'publicBooking.validation.emailInvalid' });
    }
    if (values.consentWhatsApp && values.phone === '') {
      context.addIssue({ code: 'custom', path: ['consentWhatsApp'], message: 'publicBooking.validation.whatsAppNeedsPhone' });
    } else if (values.consentWhatsApp && isValidPhone(values.phone) && !hasInternationalPrefix(values.phone)) {
      // The server puts its own calling code in front of a number that does not say its country (`+` or `00`): the consent would be for a
      // stranger's number. A number that is not a number at all is told on the phone field.
      context.addIssue({ code: 'custom', path: ['consentWhatsApp'], message: 'publicBooking.validation.whatsAppNeedsPrefix' });
    }
    if (!values.adultConfirmed) {
      context.addIssue({ code: 'custom', path: ['adultConfirmed'], message: 'marketing.welcome.errors.adultRequired' });
    }
  });

type WelcomeFormValues = z.infer<typeof welcomeFormSchema>;

const EMPTY_FORM: WelcomeFormValues = { email: '', phone: '', consentEmail: false, consentWhatsApp: false, adultConfirmed: false };

type WelcomeState = 'loading' | 'inactive' | 'error' | 'welcome' | 'ask' | 'done';

interface WelcomeFormProps {
  page: WelcomePageData;
  /** The version of the consent text the page shows, which the consent sent back names. */
  version: string;
  submit: ReturnType<typeof useSubmitWelcomeConsent>;
}

/** The guest's form: e-mail, optional phone, the two channel boxes, the declaration of age and the text of the consent with its version. */
function WelcomeForm({ page, version, submit }: WelcomeFormProps) {
  const { t, i18n } = useTranslation();
  const {
    register,
    handleSubmit,
    control,
    reset,
    trigger,
    formState: { errors },
  } = useForm<WelcomeFormValues>({ resolver: zodResolver(welcomeFormSchema), mode: 'onTouched', defaultValues: EMPTY_FORM });

  // The WhatsApp box waits for a number (a box already ticked stays free, so it can be unticked).
  const phoneTyped = useWatch({ control, name: 'phone' }).trim() !== '';
  const channelError = translateValidationMessage(errors.consentEmail?.message, t, i18n);
  const whatsAppError = translateValidationMessage(errors.consentWhatsApp?.message, t, i18n);
  const adultError = translateValidationMessage(errors.adultConfirmed?.message, t, i18n);
  const language = i18n.language.toLowerCase().startsWith('en') ? 'en' : 'it';

  const send = handleSubmit((values) => {
    submit.mutate(
      {
        // What is not consented to is not sent: the address only with the e-mail box, the number only with the WhatsApp box.
        ...(values.consentEmail ? { email: values.email } : {}),
        ...(values.consentWhatsApp ? { phone: values.phone } : {}),
        consentEmail: values.consentEmail,
        consentWhatsApp: values.consentWhatsApp,
        adultConfirmed: values.adultConfirmed,
        consentVersion: version,
        language,
      },
      {
        // The text changed while the guest was reading: what they ticked was for the old one. The page shows the new text, unticked.
        onError: (error) => {
          if (isAxiosError(error) && getProblemCode(error.response?.data) === CONSENT_OUTDATED_CODE) {
            reset({ ...values, consentEmail: false, consentWhatsApp: false, adultConfirmed: false });
          }
        },
      },
    );
  });

  return (
    <form onSubmit={(event) => void send(event)} noValidate className="space-y-5 text-left" data-testid="welcome-form">
      <Field label={t('publicBooking.email')} hint={t('marketing.welcome.emailHint')} optional error={errors.email}>
        <Input
          id="welcome-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          {...register('email')}
        />
      </Field>
      <Field label={t('publicBooking.phone')} hint={t('marketing.welcome.phoneHint')} optional error={errors.phone}>
        {/* A number typed or cleared changes what the WhatsApp box may do: its message is checked again at once, not at the next press. */}
        <Input
          id="welcome-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          {...register('phone', { onChange: () => void trigger('consentWhatsApp') })}
        />
      </Field>

      <fieldset className="space-y-3" data-testid="welcome-channels">
        <legend className="text-sm font-medium leading-relaxed">{t('marketing.welcome.legend', { host: page.orgName })}</legend>
        <Controller
          control={control}
          name="consentEmail"
          render={({ field }) => (
            <div className="flex items-start gap-3">
              <Checkbox
                id="welcome-consent-email"
                ref={field.ref}
                checked={field.value}
                onCheckedChange={(checked) => {
                  field.onChange(checked === true);
                  // The address is needed only with this box: a message already on it is checked again at once, not at the next press.
                  if (errors.email) void trigger('email');
                }}
                aria-describedby={channelError ? 'welcome-channels-error' : undefined}
                data-testid="welcome-consent-email"
              />
              <Label htmlFor="welcome-consent-email" className="cursor-pointer text-sm leading-relaxed">
                {t('marketing.welcome.emailChannel')}
              </Label>
            </div>
          )}
        />
        <Controller
          control={control}
          name="consentWhatsApp"
          render={({ field }) => (
            <div className="flex items-start gap-3">
              <Checkbox
                id="welcome-consent-whatsapp"
                ref={field.ref}
                checked={field.value}
                disabled={!phoneTyped && !field.value}
                aria-describedby={[!phoneTyped ? 'welcome-whatsapp-hint' : '', whatsAppError ? 'welcome-whatsapp-error' : ''].filter(Boolean).join(' ') || undefined}
                aria-invalid={whatsAppError ? true : undefined}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                data-testid="welcome-consent-whatsapp"
              />
              <Label htmlFor="welcome-consent-whatsapp" className={phoneTyped || field.value ? 'cursor-pointer text-sm leading-relaxed' : 'cursor-not-allowed text-sm leading-relaxed'}>
                {t('marketing.welcome.whatsAppChannel')}
                {!phoneTyped ? (
                  <small id="welcome-whatsapp-hint" className="block text-muted-foreground" data-testid="welcome-whatsapp-hint">
                    {t('marketing.welcome.whatsAppNeedsPhone')}
                  </small>
                ) : null}
              </Label>
            </div>
          )}
        />
        {channelError ? (
          <p id="welcome-channels-error" role="alert" className="text-sm text-destructive" data-testid="welcome-channels-error">
            {channelError}
          </p>
        ) : null}
        {whatsAppError ? (
          <p id="welcome-whatsapp-error" role="alert" className="text-sm text-destructive" data-testid="welcome-whatsapp-error">
            {whatsAppError}
          </p>
        ) : null}
        <p className="text-sm leading-relaxed text-muted-foreground" data-testid="welcome-consent-text">
          {t('marketing.welcome.consentText', { host: page.orgName })}
        </p>
        <p className="text-xs text-muted-foreground" data-testid="welcome-consent-version">
          {t('marketing.welcome.consentVersion', { version })}
        </p>
      </fieldset>

      {/* The page collects an address and a number from a person who may not have booked: the privacy notice is one click away before anything is sent. */}
      <p className="text-xs leading-relaxed text-muted-foreground" data-testid="welcome-privacy">
        <Trans
          i18nKey="marketing.welcome.privacyNotice"
          components={{ privacy: <Link to={LEGAL_DOCUMENT_PATHS.privacy} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" /> }}
        />
      </p>

      <div className="space-y-1.5">
        <Controller
          control={control}
          name="adultConfirmed"
          render={({ field }) => (
            <div className="flex items-start gap-3">
              <Checkbox
                id="welcome-adult"
                ref={field.ref}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                aria-describedby={adultError ? 'welcome-adult-error' : undefined}
                aria-invalid={adultError ? true : undefined}
                data-testid="welcome-adult"
              />
              <Label htmlFor="welcome-adult" className="cursor-pointer text-sm leading-relaxed">
                {t('marketing.welcome.adultLabel')}
              </Label>
            </div>
          )}
        />
        {adultError ? (
          <p id="welcome-adult-error" role="alert" className="text-sm text-destructive" data-testid="welcome-adult-error">
            {adultError}
          </p>
        ) : null}
      </div>

      {submit.isError ? (
        <Alert variant="danger" data-testid="welcome-submit-error">
          {getProblemMessage(submit.error, t) ?? t('marketing.welcome.errors.generic')}
        </Alert>
      ) : null}

      <Button type="submit" block size="lg" loading={submit.isPending} data-testid="welcome-submit">
        {t('marketing.welcome.submit')}
      </Button>
    </form>
  );
}

/**
 * `/benvenuto/:token`: the page a guest reaches by scanning the QR code in the apartment (E07/F04/US02/T02, NF-90, CRM-03). It welcomes the guest
 * with the names of the property and of the host; when the consent text has a version it also asks for an e-mail address, an optional phone
 * number, the channels the guest wants to be written to on (two boxes, never ticked, WhatsApp only with a number) and a declaration of age,
 * with the text of the consent and its version (the address only with the E-mail box). Whatever the server answers to the consent, the page says
 * the same thing, «controlla la tua e-mail» (or, for a guest who chose WhatsApp only, that the choice was received), so it can never be used to
 * learn who is already a customer. A code that is unknown or was replaced says the page is not active.
 * Public and never behind the CRM flag (a code already printed must keep working), not indexed, with no menu and no analytics.
 */
export function WelcomePage() {
  const { t } = useTranslation();
  const { token = '' } = useParams<{ token: string }>();
  useSeoMeta({ title: t('marketing.welcome.pageTitle'), noindex: true });
  const page = useWelcomePage(token);
  const submit = useSubmitWelcomeConsent(token);

  const version = page.data?.marketingConsentVersion ?? null;
  let state: WelcomeState;
  if (submit.isSuccess) state = 'done';
  else if (token === '' || (page.isError && getHttpStatus(page.error) === 404)) state = 'inactive';
  else if (page.data) state = version ? 'ask' : 'welcome';
  else if (page.isError) state = 'error';
  else state = 'loading';

  if (state === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4" data-testid="welcome-page" data-state="loading">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          {t('marketing.welcome.loading')}
        </p>
      </main>
    );
  }

  const names = { property: page.data?.propertyName ?? '', host: page.data?.orgName ?? '' };
  // The words of the end depend on what the guest chose (no e-mail to check for who chose WhatsApp only), never on what the server answered.
  const confirmedByEmail = submit.variables?.consentEmail === true;
  const cards = {
    inactive: { tone: 'broken', icon: Link2Off, title: t('marketing.welcome.inactive.title'), description: t('marketing.welcome.inactive.description') },
    error: { tone: 'broken', icon: WifiOff, title: t('marketing.welcome.loadError.title'), description: t('marketing.welcome.loadError.description') },
    welcome: { tone: 'ask', icon: House, title: t('marketing.welcome.title', names), description: t('marketing.welcome.welcomeOnly', names) },
    ask: { tone: 'ask', icon: House, title: t('marketing.welcome.title', names), description: t('marketing.welcome.description', names) },
    done: confirmedByEmail
      ? { tone: 'done', icon: MailCheck, title: t('marketing.welcome.done.title'), description: t('marketing.welcome.done.description') }
      : { tone: 'done', icon: Check, title: t('marketing.welcome.doneWhatsApp.title'), description: t('marketing.welcome.doneWhatsApp.description') },
  } as const;

  return (
    <MarketingLinkCard state={state} testId="welcome-page" {...cards[state]}>
      {state === 'ask' && page.data && version ? <WelcomeForm page={page.data} version={version} submit={submit} /> : null}
      {state === 'error' ? (
        <>
          <p className="text-sm text-muted-foreground" role="status" data-testid="welcome-load-problem">
            {getProblemMessage(page.error, t) ?? t('marketing.welcome.loadError.hint')}
          </p>
          <Button block size="lg" loading={page.isFetching} onClick={() => void page.refetch()} data-testid="welcome-retry">
            {t('marketing.welcome.loadError.retry')}
          </Button>
        </>
      ) : null}
      {/* A guest from abroad reads the page in their own language: the same switch the app has, and the consent goes in the language of the page. */}
      <div className="flex justify-center pt-1">
        <LanguageSwitcher />
      </div>
    </MarketingLinkCard>
  );
}
