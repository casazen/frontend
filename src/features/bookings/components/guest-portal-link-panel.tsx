import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';

interface PortalLink {
  url: string | null;
  eligible: boolean;
}

export function GuestPortalLinkPanel({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation();
  const endpoint = `/bookings/${bookingId}/guest-portal`;
  const queryKey = ['guest-portal-link', bookingId];
  const client = useQueryClient();
  const [confirmation, setConfirmation] = useState<'rotate' | 'revoke' | null>(null);
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | null>(null);
  const link = useQuery({ queryKey, queryFn: () => ApiClient.get<PortalLink>(endpoint), retry: false, gcTime: 0 });
  const change = useMutation({
    mutationFn: async (action: 'issue' | 'rotate' | 'revoke' | 'resend'): Promise<PortalLink | void> => {
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
  async function copyLink(value: string) {
    try {
      await navigator.clipboard.writeText(new URL(value, window.location.origin).href);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }
  return (
    <section className="grid gap-3 rounded-lg border bg-card p-4">
      <h2 className="font-medium">{t('guestPortal.host.title')}</h2>
      {link.isPending && <p role="status">{t('guestPortal.host.loading')}</p>}
      {link.isError && <p role="alert">{t('guestPortal.host.unavailable')}</p>}
      {url && (
        <a className="break-all underline" href={url} rel="noreferrer" target="_blank">{url}</a>
      )}
      {link.data?.eligible && (
        <div className="flex flex-wrap gap-2">
          {!url && <Button disabled={change.isPending} onClick={() => change.mutate('issue')}>{t('guestPortal.host.generate')}</Button>}
          {url && <Button variant="outline" onClick={() => void copyLink(url)}>{t('guestPortal.host.copy')}</Button>}
          {url && !confirmation && (
            <>
              <Button variant="outline" disabled={change.isPending} onClick={() => setConfirmation('rotate')}>{t('guestPortal.host.rotate')}</Button>
              <Button variant="outline" disabled={change.isPending} onClick={() => setConfirmation('revoke')}>{t('guestPortal.host.revoke')}</Button>
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
