import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarCheck, Clock, RotateCw, type LucideIcon } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useCalendarChange } from '@/queries/use-calendar-changes';
import { useProperties } from '@/queries/use-properties';
import type { CalendarChange } from '@/types/calendar-changes.types';
import { nextStepOfChange, type ChangeNextStep } from '../lib/calendar-change-words';
import { periodDays, type BulkChangeValues } from '../lib/bulk-change-model';
import { CalendarChangeLines } from './calendar-change-lines';

const CALENDAR_PATH = '/app/short-rent/bookings/calendar';

const NEXT_STEP: Record<ChangeNextStep, { key: string; icon: LucideIcon }> = {
  retry: { key: 'booking.calendar.bulk.done.next.retry', icon: RotateCw },
  wait: { key: 'booking.calendar.bulk.done.next.wait', icon: Clock },
  checkAgain: { key: 'booking.calendar.bulk.done.next.checkAgain', icon: AlertTriangle },
  calendar: { key: 'booking.calendar.bulk.done.next.calendar', icon: CalendarCheck },
};

interface BulkChangeDoneProps {
  /** The change the API answered when the last button was pressed: the process that sends it to the channel manager. */
  change: CalendarChange;
  values: BulkChangeValues;
}

/**
 * "What happens now" after a bulk change (E08/F05/US03/T03, NF-05, NF-36, NF-02): the change is saved in CasaZen, and one line per property says what the channel manager did with
 * it, with the same words as the panel of the days (`CalendarChangeLines`): waiting, being sent, accepted by the channel manager, not sent with the reason and "Retry now", or not
 * connected (the change stays in CasaZen). Never "published on the channels". One next step is suggested; the only way out is "Save and exit", back to the calendar.
 */
export function BulkChangeDone({ change, values }: BulkChangeDoneProps) {
  const { t } = useTranslation();
  const properties = useProperties({ mode: 'short' });
  const mayRead = useContext(WorkspaceContext)?.hasPermission('short-rent', 'property.read') ?? false;
  // The same read as the lines (one entry of the cache): the suggested step follows the state the lines show.
  const detail = useCalendarChange(change.id, { enabled: mayRead, initial: change });
  const current = detail.data ?? change;
  const next = NEXT_STEP[nextStepOfChange(current, detail.watchOver || (!mayRead && (current.state === 'Queued' || current.state === 'Sending')))];
  const names = new Map((Array.isArray(properties.data) ? properties.data : []).map((property) => [property.id, property.name] as const));

  return (
    <WizardDone
      title={t('booking.calendar.bulk.done.title')}
      description={t('booking.calendar.bulk.done.description', { days: periodDays(values.from, values.to), count: change.propertyCount || values.propertyIds.length })}
      whatNext={[{ text: t(next.key), icon: next.icon }]}
      primary={{ label: t('booking.calendar.bulk.saveAndExit'), to: CALENDAR_PATH }}
    >
      <CalendarChangeLines change={change} propertyName={(id) => names.get(id) ?? t('booking.calendar.bulk.done.propertyFallback')} />
    </WizardDone>
  );
}
