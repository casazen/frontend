import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimulateRoutine } from '@/queries/routines';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useWorkspace } from '@/hooks/use-workspace';
import { actionLabelKey, executionCodeKey } from '@/lib/routine-model';
import { describeRoutineError } from '@/lib/routine-errors';
import { formatStayDate } from '@/lib/stay-dates';
import { useBookingList } from '@/queries/use-bookings';

export function RoutineSimulation({ routineId }: { routineId: string }) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canRead = hasPermission('short-rent', 'booking.read');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [bookingId, setBookingId] = useState('');
  const bookings = useBookingList({ q: query || undefined, page: 1, pageSize: 25 }, { enabled: canRead });
  const simulation = useSimulateRoutine();
  const items = bookings.data?.items ?? [];
  const selected = items.find(booking => booking.id === bookingId);
  const result = simulation.data;
  const reason = executionCodeKey(result?.code ?? undefined);
  function search(event: FormEvent) {
    event.preventDefault();
    setBookingId('');
    simulation.reset();
    setQuery(text.trim());
  }
  if (!canRead) return <p role="status">{t('routines.flow.noBookingAccess')}</p>;
  return (
    <div className="min-w-0 space-y-4">
      <form onSubmit={search} className="space-y-2">
        <Label htmlFor="simulation-search">{t('routines.flow.search')}</Label>
        <div className="flex flex-wrap gap-2">
          <Input id="simulation-search" className="min-w-32 flex-1" value={text} onChange={event => setText(event.target.value)} disabled={simulation.isPending} />
          <Button type="submit" variant="outline" disabled={simulation.isPending}>{t('routines.flow.searchButton')}</Button>
        </div>
      </form>
      {bookings.isFetching ? <p role="status">{t('routines.loading')}</p> : bookings.isError ? (
        <div role="alert" className="space-y-2">
          <p>{t('routines.flow.bookingsError')}</p>
          <Button variant="outline" onClick={() => void bookings.refetch()}>{t('routines.flow.retry')}</Button>
        </div>
      ) : items.length === 0 ? <p role="status">{t('routines.flow.noBookings')}</p> : (
        <div className="space-y-2">
          <Label htmlFor="simulation-booking">{t('routines.flow.chooseBooking')}</Label>
          <Select id="simulation-booking" value={bookingId} disabled={simulation.isPending} onChange={event => { setBookingId(event.target.value); simulation.reset(); }}>
            <option value="">{t('routines.flow.chooseBooking')}</option>
            {items.map(booking => <option key={booking.id} value={booking.id}>{[booking.bookingCode, booking.propertyName, formatStayDate(booking.checkInDate, i18n.language)].filter(Boolean).join(' · ')}</option>)}
          </Select>
          {bookings.data && bookings.data.totalCount > items.length && <p className="text-xs text-muted-foreground">{t('routines.flow.refine', { count: items.length })}</p>}
        </div>
      )}
      <Button disabled={!selected || bookings.isFetching || bookings.isError || simulation.isPending} onClick={() => selected && simulation.mutate({ id: routineId, payload: { bookingId: selected.id } })}>{t('routines.flow.try')}</Button>
      {simulation.isError && <p role="alert" className="text-sm text-destructive">{describeRoutineError(simulation.error, t) ?? t('routines.simulateError')}</p>}
      {result && <section aria-live="polite" className="space-y-3 rounded-lg border bg-muted/50 p-4">
        <h3 className="font-semibold">{t('routines.flow.result')}</h3>
        <p>{t(reason ?? (result.code ? 'routines.flow.invalid' : !result.conditionsMatched ? 'routines.flow.unmatched' : result.wouldExecute ? 'routines.flow.matched' : 'routines.flow.skipped'))}</p>
        {result.conditionsMatched && result.actions.length > 0 && <ul className="space-y-2 text-sm">{result.actions.map(action => {
          const why = executionCodeKey(action.code ?? undefined);
          return <li key={action.index}><strong>{t(actionLabelKey(action.type) ?? 'routines.log.unknownAction')}</strong><span className="ml-2">{t(action.wouldBlock ? 'routines.flow.blocked' : result.wouldExecute ? 'routines.flow.possible' : 'routines.flow.skippedAction')}</span>{why && <p>{t(why)}</p>}</li>;
        })}</ul>}
      </section>}
    </div>
  );
}
