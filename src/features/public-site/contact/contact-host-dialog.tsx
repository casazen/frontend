import { useId, useState, type ReactElement } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import { z } from 'zod';
import { publicOrgApi } from '@/api/public-org.api';
import { FormFieldError } from '@/components/shared/form-field-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePortalRootProps } from '@/features/public-site/site-appearance-context';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import { languageOfTag } from '@/lib/site-language';
import { cn } from '@/lib/utils';
import type { HostContactPayload } from '@/types';

// The limits of the backend (`HostContactRules`): the screen says them before the host's server has to.
const MESSAGE_MIN = 5;
const MESSAGE_MAX = 2000;
const NAME_MAX = 100;
const EMAIL_MAX = 254;

// The messages are i18n keys: `Field` / `FormFieldError` translate them when rendering.
const contactSchema = z.object({
  name: z.string().trim().max(NAME_MAX, 'hostContact.errors.name'),
  email: z.string().trim().min(1, 'hostContact.errors.email').max(EMAIL_MAX, 'hostContact.errors.email').email('hostContact.errors.email'),
  message: z.string().trim().min(MESSAGE_MIN, 'hostContact.errors.message').max(MESSAGE_MAX, 'hostContact.errors.message'),
  consent: z.boolean().refine((value) => value, 'hostContact.errors.consent'),
  website: z.string(),
});

type ContactForm = z.infer<typeof contactSchema>;

/** What the answer of the backend asks the form to say, by field: a code it refuses a body with, else a sentence for the whole form. */
function readSendError(error: unknown): { field?: 'email' | 'message' | 'consent'; key: string } {
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  if (code === 'host_contact_email_invalid') return { field: 'email', key: 'hostContact.errors.email' };
  if (code === 'host_contact_message_invalid') return { field: 'message', key: 'hostContact.errors.message' };
  if (code === 'host_contact_consent_required') return { field: 'consent', key: 'hostContact.errors.consent' };
  return { key: getHttpStatus(error) === 429 ? 'hostContact.errors.tooMany' : 'hostContact.errors.failed' };
}

function ContactHostForm({
  site,
  host,
  propertyId,
  onClose,
}: {
  site: string;
  host: string;
  propertyId?: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const online = useOnlineStatus();
  const consentId = useId();
  const offlineId = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', message: '', consent: false, website: '' },
  });
  const message = useWatch({ control, name: 'message' });
  const send = useMutation({ mutationFn: (payload: HostContactPayload) => publicOrgApi.sendHostContact(site, payload) });

  const submit = handleSubmit((values) => {
    setFormError(null);
    const lang = languageOfTag(i18n.language) ?? undefined;
    send.mutate(
      {
        email: values.email,
        message: values.message,
        ...(values.name ? { name: values.name } : {}),
        ...(propertyId ? { propertyId } : {}),
        ...(lang ? { lang } : {}),
        consent: true,
        ...(values.website ? { website: values.website } : {}),
      },
      {
        onError: (error) => {
          const { field, key } = readSendError(error);
          if (field) setError(field, { message: key });
          else setFormError(key);
        },
      },
    );
  });

  if (send.isSuccess) {
    return (
      <div className="grid justify-items-start gap-3 py-2" role="status" data-testid="host-contact-done">
        <CheckCircle2 className="h-8 w-8 text-[var(--cz-public-primary-text)]" aria-hidden />
        <p className="text-base font-semibold">{t('hostContact.doneTitle')}</p>
        <p className="text-sm text-foreground/70">{t('hostContact.doneText', { host })}</p>
        <Button type="button" className="public-site-cta border-0" onClick={onClose}>
          {t('shared.close')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" data-testid="host-contact-form">
      <Field label={t('hostContact.nameLabel')} optional error={errors.name}>
        <Input autoComplete="name" disabled={send.isPending} {...register('name')} />
      </Field>
      <Field label={t('hostContact.emailLabel')} hint={t('hostContact.emailHint', { host })} error={errors.email}>
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t('publicBooking.emailPlaceholder')}
          disabled={send.isPending}
          {...register('email')}
        />
      </Field>
      <Field
        label={t('hostContact.messageLabel')}
        hint={t('hostContact.messageHint')}
        counter={`${message.trim().length}/${MESSAGE_MAX}`}
        error={errors.message}
      >
        <Textarea rows={5} disabled={send.isPending} {...register('message')} />
      </Field>

      <Controller
        name="consent"
        control={control}
        render={({ field }) => (
          <div className="grid gap-1.5">
            <div className="flex items-start gap-3">
              <Checkbox
                id={consentId}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                disabled={send.isPending}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? `${consentId}-error` : undefined}
                // The border of the app is a pale line: the ring keeps the box visible against the card (AA 1.4.11).
                className="mt-0.5 h-5 w-5 ring-1 ring-[var(--cz-public-muted)] data-[state=checked]:ring-0"
              />
              <Label htmlFor={consentId} className="text-sm font-normal leading-snug">
                {t('hostContact.consent', { host })}
              </Label>
            </div>
            <FormFieldError error={errors.consent} id={`${consentId}-error`} />
          </div>
        )}
      />

      {/* The honeypot: a field no person sees or reaches. A message that fills it is dropped by the backend, with the same answer. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label>
          {t('hostContact.honeypot')}
          <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
        </label>
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-[color:var(--color-danger-foreground,#b4232a)]" data-testid="host-contact-error">
          {t(formError)}
        </p>
      ) : null}
      {!online ? (
        <p id={offlineId} role="status" className="flex items-start gap-2 text-sm text-foreground/70">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('hostContact.offline')}
        </p>
      ) : null}
      <Button
        type="submit"
        className="public-site-cta w-full border-0"
        disabled={send.isPending || !online}
        aria-describedby={!online ? offlineId : undefined}
      >
        {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
        {send.isPending ? t('hostContact.sending') : t('hostContact.send')}
      </Button>
    </form>
  );
}

/**
 * "Scrivi a {host}" (DB-02b): a visitor who has no booking yet writes a few lines to the host, who gets them by email and answers
 * from their own mailbox. The dialog (a sheet from the bottom on a phone, themed like the site) asks for an address the host can
 * answer to, the message and the consent to send both to the host; it says how to fix what is wrong, shows when the message went, and
 * does not send while the guest is offline. The `trigger` is the button that opens it, drawn by the page (a link in the footer, a
 * button where there is nothing else to do); `propertyId` ties the message to the home the visitor was looking at.
 */
export function ContactHostDialog({
  site,
  hostName,
  propertyId,
  trigger,
}: {
  /** The slug of the booking site. */
  site: string;
  /** How the host is named ("Giulia"), or the name of the site. */
  hostName: string;
  propertyId?: string;
  trigger: ReactElement;
}) {
  const { t } = useTranslation();
  const portal = usePortalRootProps();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent {...portal} className={cn(portal.className, 'sm:max-w-md')}>
        <DialogHeader>
          <DialogTitle className="public-display text-xl">{t('hostContact.title', { host: hostName })}</DialogTitle>
          <DialogDescription>{t('hostContact.description', { host: hostName })}</DialogDescription>
        </DialogHeader>
        <ContactHostForm site={site} host={hostName} propertyId={propertyId} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
