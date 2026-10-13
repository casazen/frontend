import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getProblemMessage } from '@/lib/api-errors';
import { useCreateHostInvite } from '@/queries/use-host-invites';
import type { HostInviteScope } from '@/api/host-invites.api';
import { HOST_INVITE_LOCALES, type HostInviteLocale } from '@/types/host-invites';

/** Same shape the backend accepts ([EmailAddress]): one `@` with text on both sides; the server validates again. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 1000;

/**
 * Form to invite another independent host by email: email, optional message, optional language of the email. The
 * invite gives no role: the guest signs up as usual and the link binds the email and records who invited. The same
 * form serves the admin and the hosts; for a host `blocked` stops it when the daily quota is used up.
 */
export function HostInviteForm({ scope, blocked = false }: { scope: HostInviteScope; blocked?: boolean }) {
  const { t, i18n } = useTranslation();
  const create = useCreateHostInvite(scope);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [locale, setLocale] = useState<HostInviteLocale | ''>('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      return setEmailError(t(scope === 'host' ? 'hostInvites.form.errors.emailRequiredFriend' : 'hostInvites.form.errors.emailRequired'));
    }
    if (!EMAIL_PATTERN.test(trimmed)) return setEmailError(t('hostInvites.form.errors.emailInvalid'));
    setEmailError(null);
    try {
      const result = await create.mutateAsync({
        email: trimmed,
        message: message.trim() || undefined,
        locale: locale || undefined,
      });
      toast.success(
        t('hostInvites.toast.sent', {
          email: trimmed,
          expiresAt: new Date(result.expiresAt).toLocaleDateString(i18n.language),
        }),
      );
      setEmail('');
      setMessage('');
      setLocale('');
    } catch (error) {
      // host_invite_quota_exceeded (429), host_email_taken and duplicate_invite (409) have their own texts.
      toast.error(getProblemMessage(error, t) ?? t('hostInvites.toast.error'));
    }
  };

  const disabled = create.isPending || blocked;

  return (
    <Card className="mx-auto w-full max-w-2xl" data-testid="host-invite-form-card">
      <CardHeader>
        <CardTitle>{t('hostInvites.form.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="host-invite-email">{t(scope === 'host' ? 'hostInvites.form.emailFriend' : 'hostInvites.form.email')}</Label>
            <Input
              id="host-invite-email"
              type="email"
              autoComplete="off"
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? 'host-invite-email-error' : undefined}
              data-testid="host-invite-email"
            />
            {emailError && (
              <p id="host-invite-email-error" role="alert" className="text-sm text-destructive">
                {emailError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="host-invite-message">{t('hostInvites.form.message')}</Label>
            <Input
              id="host-invite-message"
              maxLength={MAX_MESSAGE_LENGTH}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              data-testid="host-invite-message"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="host-invite-locale">{t('hostInvites.form.locale')}</Label>
            <select
              id="host-invite-locale"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={locale}
              onChange={(e) => setLocale(e.target.value as HostInviteLocale | '')}
              data-testid="host-invite-locale"
            >
              <option value="">{t('hostInvites.form.localeDefault')}</option>
              {HOST_INVITE_LOCALES.map((value) => (
                <option key={value} value={value}>
                  {t(`hostInvites.form.localeOption.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={disabled} data-testid="host-invite-submit">
            {create.isPending ? t('hostInvites.form.sending') : t('hostInvites.form.send')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
