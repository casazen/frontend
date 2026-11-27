import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { ChartColumn } from 'lucide-react';
import { ApiClient } from '@/api/client';
import { InfoCard } from '@/components/shared/calm';
import { ManualHint } from '@/components/shared/manual-hint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkspace } from '@/hooks/use-workspace';
import { todayInRome } from '@/lib/stay-dates';

interface Preview { hash: string; arrivals: number; departures: number; state: string; accepted: number; rejected: number; records: { key: string; state: string }[] }
interface Capacity { open: boolean; occupiedRooms: number; availableRooms: number; availableBeds: number }

export function Ross1000Panel({ propertyId, canWrite, canSend = false }: { propertyId: string; canWrite: boolean; canSend?: boolean }) {
  const { hasPermission } = useWorkspace();
  if (!canWrite || !hasPermission('short-rent', 'guest.read')) return null;
  return <DayPanel key={propertyId} propertyId={propertyId} canSend={canSend} />;
}

function DayPanel({ propertyId, canSend }: { propertyId: string; canSend: boolean }) {
  const { t } = useTranslation();
  const [day, setDay] = useState(todayInRome());
  const [open, setOpen] = useState(true);
  const [rooms, setRooms] = useState('');
  const [occupied, setOccupied] = useState('');
  const [beds, setBeds] = useState('');
  const submit = useMutation({
    retry: false,
    mutationFn: ({ action, capacity, hash }: { action: 'preview' | 'send'; capacity: Capacity; hash?: string }) =>
      ApiClient.post<Preview>(`/properties/${propertyId}/ross1000/${day}/${action}`,
        action === 'preview' ? capacity : { capacity, hash }),
  });
  const info = submit.data;
  const maySend = canSend && !!info && ['ready', 'correction', 'rejected', 'credentials_rejected'].includes(info.state);
  const capacity = {
    open,
    occupiedRooms: open ? Number(occupied) : 0,
    availableRooms: open ? Number(rooms) : 0,
    availableBeds: open ? Number(beds) : 0,
  };
  const preview = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!submit.isPending) submit.mutate({ action: 'preview', capacity });
  };
  let errorCode = isAxiosError(submit.error) ? submit.error.response?.data?.code : undefined;
  if (typeof errorCode !== 'string' || !/^[a-z_]+$/.test(errorCode)) errorCode = 'request_failed';

  return (
    <InfoCard
      icon={ChartColumn}
      title={t('ross1000.title')}
      hint={
        <ManualHint page="alloggiati-istat" anchor="comunicare-l-istat-della-tua-regione" title={t('ross1000.title')}>
          {t('ross1000.description')}
        </ManualHint>
      }
      data-testid="ross1000-panel"
    >
      <form onSubmit={preview} onChange={() => submit.reset()} className="space-y-3">
        <fieldset disabled={submit.isPending} className="grid gap-3 sm:grid-cols-2">
          <label>{t('ross1000.day')}<Input type="date" required max={todayInRome()} value={day} onChange={e => setDay(e.target.value)} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={open} onChange={e => setOpen(e.target.checked)} />{t('ross1000.open')}</label>
          {open && <>
            <label>{t('ross1000.rooms')}<Input type="number" min={1} required value={rooms} onChange={e => setRooms(e.target.value)} /></label>
            <label>{t('ross1000.beds')}<Input type="number" min={1} required value={beds} onChange={e => setBeds(e.target.value)} /></label>
            <label>{t('ross1000.occupied')}<Input type="number" min={0} required value={occupied} onChange={e => setOccupied(e.target.value)} /></label>
          </>}
        </fieldset>
        <Button type="submit" variant="outline" disabled={submit.isPending}>{t('ross1000.preview')}</Button>
      </form>
      {submit.isError && <p role="alert">{t(`ross1000.errors.${errorCode}`, { defaultValue: t('ross1000.errors.request_failed') })}</p>}
      {info && <div className="space-y-2" role="status">
        <p>{t('ross1000.totals', { arrivals: info.arrivals, departures: info.departures })}</p>
        <p>{t(`ross1000.states.${info.state}`, { accepted: info.accepted, rejected: info.rejected })}</p>
        {!!info.records?.length && <details>
          <summary>{t('ross1000.recordOutcomes')}</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {info.records.map(record => <li key={record.key} className="flex gap-2">
              <code>{record.key}</code><span>{t(record.state === 'accepted' ? 'ross1000.recordAccepted' : 'ross1000.recordRejected')}</span>
            </li>)}
          </ul>
        </details>}
        {maySend && <Button type="button" disabled={submit.isPending}
          onClick={() => submit.mutate({ action: 'send', capacity, hash: info.hash })}>{t('ross1000.send')}</Button>}
      </div>}
    </InfoCard>
  );
}
