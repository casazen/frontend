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
import { InviteQrCard } from '@/features/admin/invite-qr-card';
import { HOST_INVITE_LOCALES, type HostInviteLocale, type HostInviteResult } from '@/types/host-invites';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 500;

export function HostInviteForm({ scope, blocked = false }: { scope: HostInviteScope; blocked?: boolean }) {
  const { t, i18n } = useTranslation();
  const create = useCreateHostInvite(scope);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [locale, setLocale] = useState<HostInviteLocale | ''>('');
  const [qrInvite, setQrInvite] = useState<HostInviteResult | null>(null);
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
      if (scope === 'admin') setQrInvite(result);
      setEmail('');
      setMessage('');
      setLocale('');
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('hostInvites.toast.error'));
    }
  };

  const disabled = create.isPending || blocked;

  return (
    <div className="grid gap-6">
      <Card data-testid="host-invite-form-card">
        <CardHeader>
          <CardTitle>{t(scope === 'admin' ? 'admin.staffInvite.formTitle' : 'hostInvites.form.title')}</CardTitle>
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
                onChange={(e) => { setEmail(e.target.value); setQrInvite(null); }}
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
              {create.isPending ? t('hostInvites.form.sending') : t(scope === 'admin' ? 'admin.staffInvite.create' : 'hostInvites.form.send')}
            </Button>
          </form>
        </CardContent>
      </Card>
      {scope === 'admin' && qrInvite?.url && <div className="grid gap-3">
        <p role="status" className="text-sm">{t('admin.staffInvite.expires', { date: new Date(qrInvite.expiresAt).toLocaleDateString(i18n.language) })}</p>
        <InviteQrCard testId="qr-agency" title={t('admin.staffInvite.qrTitle')} description={t('admin.staffInvite.personalQr')}
          printSubtitle={t('admin.staffInvite.qrTitle')} url={qrInvite.url} />
      </div>}
    </div>
  );
}
