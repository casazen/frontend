import { readPendingStay, forgetPendingStay } from './guest-account-attachment';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getHttpStatus } from '@/lib/api-errors';
import { useSeoMeta } from '@/lib/seo-meta';
import { useAuth } from '@/hooks/use-auth';

export const guestAccountStaysPath = '/app/guest-stays';

interface Stay {
  id: string;
  property: string;
  host: string;
  checkInDate: string;
  checkOutDate: string;
}

export function GuestAccountStaysPage() {
  const { flags } = useFeatureFlags();
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  useSeoMeta({ title: t('guestPortal.account.title'), noindex: true });
  const stays = useQuery({
    queryKey: ['guest-account-stays'],
    queryFn: ({ signal }) => ApiClient.get<Stay[]>('/guest/stays', undefined, { signal, localAuthRecovery: true }),
    enabled: flags.guestPortal,
    gcTime: 0,
    retry: false,
  });
  const [pendingStay, setPendingStay] = useState(readPendingStay);
  const clearPending = () => {
    setPendingStay(null);
    forgetPendingStay();
  };
  const attach = useMutation({
    mutationFn: () => ApiClient.post('/guest/stays/attach', { token: readPendingStay() }, { localAuthRecovery: true }),
    onSuccess: () => { clearPending(); void stays.refetch(); },
  });
  const open = useMutation({
    mutationFn: (id: string) => ApiClient.post<{ url: string }>(`/guest/stays/${id}/open`, undefined, { localAuthRecovery: true }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const dates = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' });

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t('guestPortal.account.title')}</h1>
        <Button variant="outline" onClick={() => logout()}>{t('guestPortal.account.signOut')}</Button>
      </div>
      {!flags.guestPortal && <p>{t('guestPortal.host.unavailable')}</p>}
      {flags.guestPortal && stays.isPending && <p role="status">{t('guestPortal.host.loading')}</p>}
      {stays.isError && <p role="alert">
        {t(getHttpStatus(stays.error) === 403 ? 'guestPortal.account.verifyEmail' : 'guestPortal.host.unavailable')}
      </p>}
      {stays.isSuccess && pendingStay && flags.guestPortal && <div className="flex flex-wrap gap-3">
        <Button onClick={() => attach.mutate()} disabled={attach.isPending}>{t('guestPortal.account.attach')}</Button>
        <Button variant="outline" onClick={clearPending} disabled={attach.isPending}>{t('guestPortal.account.dismiss')}</Button>
        {attach.isError && <p role="alert">{t('guestPortal.account.attachError')}</p>}
      </div>}
      {open.isError && <p role="alert">{t('guestPortal.host.changeError')}</p>}
      {stays.data?.length === 0 && <p>{t('guestPortal.account.empty')}</p>}
      {stays.data?.map((stay) => (
        <article key={stay.id} className="grid gap-2 rounded-xl border p-4">
          <h2 className="font-medium">{stay.property}</h2>
          <p>{stay.host}</p>
          <p>{dates.formatRange(new Date(stay.checkInDate), new Date(stay.checkOutDate))}</p>
          <Button disabled={open.isPending} onClick={() => open.mutate(stay.id)}>{t('guestPortal.guide.openStay')}</Button>
        </article>
      ))}
    </main>
  );
}
