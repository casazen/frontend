import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';

interface StayChange {
  id: string;
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  previousTotal: number;
  newTotal: number;
  currency: string;
}

export function GuestStayChangePanel({ bookingId, onApproved }: { bookingId: string; onApproved: () => void }) {
  const { t, i18n } = useTranslation();
  const endpoint = `/bookings/${bookingId}/guest-stay-change`;
  const query = useQuery({
    queryKey: ['guest-stay-change', bookingId],
    queryFn: () => ApiClient.get<{ pending: StayChange | null }>(endpoint),
    retry: false,
    refetchInterval: 30000,
  });
  const decision = useMutation({
    mutationFn: (action: 'approve' | 'decline') => ApiClient.post<void>(`${endpoint}/${query.data!.pending!.id}/${action}`),
    onSuccess: (_, action) => {
      void query.refetch();
      if (action === 'approve') onApproved();
    },
  });
  const change = query.data?.pending;
  if (!change) return decision.isSuccess && decision.variables === 'approve' ? <p role="status">{t('guestPortal.host.stayChangeApproved')}</p> : null;
  const money = new Intl.NumberFormat(i18n.language, { style: 'currency', currency: change.currency });
  const dates = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' })
    .formatRange(new Date(change.arrival), new Date(change.departure));
  return (
    <section className="grid gap-3 rounded-lg border bg-card p-4">
      <h2 className="font-medium">{t('notifications.types.guestStayChange')}</h2>
      <p>{dates} · {t('guestPortal.host.stayChangeGuests', { adults: change.adults, children: change.children })}</p>
      <p>{t('guestPortal.host.stayChangeTotals', { previous: money.format(change.previousTotal), proposed: money.format(change.newTotal) })}</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={decision.isPending} onClick={() => decision.mutate('approve')}>{t('guestPortal.host.stayChangeApprove')}</Button>
        <Button variant="outline" disabled={decision.isPending} onClick={() => decision.mutate('decline')}>{t('guestPortal.host.stayChangeDecline')}</Button>
      </div>
      {decision.isError && <p role="alert">{t('guestPortal.host.stayChangeError')}</p>}
    </section>
  );
}
