import { useState } from 'react';
import { ArrowUpRight, Copy, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';

interface PortalLink {
  url: string | null;
  eligible: boolean;
}

export function GuestPortalLinkPanel({ bookingId, checkIn }: {
  bookingId: string;
  checkIn?: { ready: boolean; prepare?: () => Promise<unknown> };
}) {
  const { t } = useTranslation();
  const endpoint = `/bookings/${bookingId}/guest-portal`;
  const queryKey = ['guest-portal-link', bookingId];
  const client = useQueryClient();
  const [confirmation, setConfirmation] = useState<'rotate' | 'revoke' | null>(null);
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | null>(null);
  const link = useQuery({ queryKey, queryFn: () => ApiClient.get<PortalLink>(endpoint), retry: false, gcTime: 0 });
  const change = useMutation({
    mutationFn: async (action: 'issue' | 'rotate' | 'revoke' | 'resend'): Promise<PortalLink | void> => {
      if (action === 'issue' && !checkIn?.ready) await checkIn?.prepare?.();
      if (action === 'revoke') return ApiClient.delete<void>(endpoint);
      if (action === 'resend') return ApiClient.post<void>(`${endpoint}/resend`);
      return ApiClient.post<PortalLink>(action === 'rotate' ? `${endpoint}/regenerate` : endpoint);
    },
    onSuccess: (data, action) => {
      if (data && (action === 'rotate' || action === 'issue')) client.setQueryData(queryKey, data);
      if (action === 'revoke') void client.invalidateQueries({ queryKey });
      setConfirmation(null);
    },
  });
  const url = link.data?.url;
  const needsPreparation = checkIn && !checkIn.ready;
  const checkInUrl = checkIn && url ? new URL(url, window.location.origin) : null;
  if (checkInUrl) checkInUrl.searchParams.set('page', 'checkin');
  const shareUrl = checkInUrl?.href ?? url;
  async function copyLink(value: string) {
    try {
      await navigator.clipboard.writeText(new URL(value, window.location.origin).href);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }
  return (
    <section id={checkIn ? "booking-guest-checkin-link" : undefined} tabIndex={checkIn ? -1 : undefined} className="grid gap-5 rounded-xl border bg-card p-5 sm:p-7">
      <header className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><Link2 className="size-5" aria-hidden="true" /></span>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{t(checkIn ? 'guestPortal.host.checkInAccess' : 'guestPortal.host.accessSection')}</h2>
          <p className="text-sm text-muted-foreground">{t(checkIn ? 'guestPortal.host.checkInAccessDescription' : 'guestPortal.host.accessDescription')}</p>
        </div>
      </header>
      {link.isPending && <p role="status">{t('guestPortal.host.loading')}</p>}
      {link.isError && <p role="alert">{t('guestPortal.host.unavailable')}</p>}
      {link.data?.eligible && (
        <div className="flex flex-wrap gap-2">
          {(!url || needsPreparation) && (!needsPreparation || checkIn.prepare) && (
            <Button loading={change.isPending} onClick={() => change.mutate('issue')}>
              {t(needsPreparation ? 'guestPortal.host.prepareCheckIn' : 'guestPortal.host.generate')}
            </Button>
          )}
          {shareUrl && !needsPreparation && (
            <>
              <Button className="min-h-11" onClick={() => void copyLink(shareUrl)}>
                <Copy aria-hidden="true" className="size-4" />{t('guestPortal.host.copy')}
              </Button>
              <Button asChild className="min-h-11" variant="outline">
                <a href={shareUrl} rel="noreferrer" target="_blank">
                  {t('guestPortal.host.preview')}<ArrowUpRight aria-hidden="true" className="size-4" />
                </a>
              </Button>
            </>
          )}
          {url && !needsPreparation && !confirmation && (
            <>
              {!checkIn && (
                <details className="rounded-lg px-2">
                  <summary className="cursor-pointer py-3 text-sm font-medium">{t('nav.settings')}</summary>
                  <div className="flex flex-wrap gap-2 pb-2">
                  <Button variant="outline" disabled={change.isPending} onClick={() => setConfirmation('rotate')}>{t('guestPortal.host.rotate')}</Button>
                  <Button variant="outline" disabled={change.isPending} onClick={() => setConfirmation('revoke')}>{t('guestPortal.host.revoke')}</Button>
                  </div>
                </details>
              )}
              <Button variant="outline" disabled={change.isPending} onClick={() => change.mutate('resend')}>{t('guestPortal.host.resend')}</Button>
            </>
          )}
          {confirmation && (
            <>
              <p className="basis-full">{t('guestPortal.host.rotateNotice')}</p>
              <Button disabled={change.isPending} onClick={() => {
                setCopyStatus(null);
                change.mutate(confirmation);
              }}>{t(confirmation === 'revoke' ? 'guestPortal.host.confirmRevoke' : 'guestPortal.host.confirm')}</Button>
              <Button variant="outline" disabled={change.isPending} onClick={() => setConfirmation(null)}>{t('guestPortal.host.cancel')}</Button>
            </>
          )}
        </div>
      )}
      {copyStatus === 'copied' && <p role="status">{t('guestPortal.host.copied')}</p>}
      {copyStatus === 'failed' && <p role="alert">{t('guestPortal.host.copyError')}</p>}
      {change.isSuccess && change.variables === 'resend' && <p role="status">{t('guestPortal.host.resent')}</p>}
      {change.isError && <p role="alert">{t('guestPortal.host.changeError')}</p>}
    </section>
  );
}
