import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarCheck, Clock, RotateCw, type LucideIcon } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useCalendarChange } from '@/queries/use-calendar-changes';
import { useProperties } from '@/queries/use-properties';
import type { CalendarChange } from '@/types/calendar-changes.types';
import { nextStepOfChange, type ChangeNextStep } from '../lib/calendar-change-words';
import type { BulkChangeValues } from '../lib/bulk-change-model';
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
  /** The days the summary said would change (the preview the host confirmed), of every property added up; the result says no number of days when it is not known. */
  changedDays?: number;
}

/**
 * "What happens now" after a bulk change (E08/F05/US03/T03, NF-05, NF-36, NF-02): the change is saved in CasaZen, and one line per property says what the channel manager did with
 * it, with the same words as the panel of the days (`CalendarChangeLines`): waiting, being sent, accepted by the channel manager, not sent with the reason and "Retry now", or not
 * connected (the change stays in CasaZen). Never "published on the channels". One next step is suggested; the only way out is "Save and exit", back to the calendar.
 */
export function BulkChangeDone({ change, values, changedDays }: BulkChangeDoneProps) {
  const { t } = useTranslation();
  const properties = useProperties({ mode: 'short' });
  const mayRead = useContext(WorkspaceContext)?.hasPermission('short-rent', 'property.read') ?? false;
  // With the connector of the channel manager off nothing is sent there: nothing is followed or asked, and the one step is to look at the calendar.
  const connectorOn = useFeatureFlags().flags.octorateConnector;
  const canFollow = mayRead && connectorOn;
  // The same read as the lines (one entry of the cache): the suggested step follows the state the lines show.
  const detail = useCalendarChange(change.id, { enabled: canFollow, initial: change });
  const current = detail.data ?? change;
  const next = NEXT_STEP[
    connectorOn ? nextStepOfChange(current, detail.watchOver || (!canFollow && (current.state === 'Queued' || current.state === 'Sending'))) : 'calendar'
  ];
  const names = new Map((Array.isArray(properties.data) ? properties.data : []).map((property) => [property.id, property.name] as const));

  return (
    <WizardDone
      title={t('booking.calendar.bulk.done.title')}
      description={
        changedDays === undefined
          ? undefined
          : t('booking.calendar.bulk.done.description', { days: t('booking.calendar.bulk.period.days', { count: changedDays }), count: change.propertyCount || values.propertyIds.length })
      }
      whatNext={[{ text: t(next.key), icon: next.icon }]}
      primary={{ label: t('booking.calendar.bulk.saveAndExit'), to: CALENDAR_PATH }}
    >
      <CalendarChangeLines change={change} propertyName={(id) => names.get(id) ?? t('booking.calendar.bulk.done.propertyFallback')} />
    </WizardDone>
  );
}
