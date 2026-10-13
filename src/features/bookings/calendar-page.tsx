import { useCallback, useContext, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BookingCalendar } from './components/booking-calendar';
import { useBookingCalendar } from '@/queries/use-bookings';
import { useProperties } from '@/queries/use-properties';
import { CalendarOff, CalendarPlus, List, Trash2, X } from 'lucide-react';
import { WorkspaceContext } from '@/contexts/workspace-context';
import type { Booking } from '@/types';
import { OtaStayForm } from './components/ota-stay-form';
import { ManualBlockForm } from './components/manual-block-form';
import { useDeleteManualBlock } from '@/queries/use-manual-blocks';
import type { SlotInfo } from 'react-big-calendar';
import { getProblemMessage } from '@/lib/api-errors';
import { addDays, formatStayDate, toStayDate, todayInRome } from '@/lib/stay-dates';
import {
  blockSourceLabel,
  hostCalendarRange,
  toHostCalendarEvents,
  type HostCalendarBlockEvent,
  type HostCalendarEvent,
  type HostCalendarView,
} from './lib/host-calendar';

interface BlockDetailsProps {
  block: HostCalendarBlockEvent;
  propertyId: string;
  onClose: () => void;
  /** The host may create stays (`booking.write`). */
  canWrite: boolean;
  /** The host may remove a manual block (`property.write`, PC-09). */
  canWriteProperty: boolean;
  onStayCreated: (booking: Booking) => void;
  onBlockDeleted: () => void;
}

interface ManualBlockActionsProps {
  block: HostCalendarBlockEvent;
  propertyId: string;
  canWriteProperty: boolean;
  onDeleted: () => void;
}

/**
 * Note and "Elimina blocco" of dates the host closed by hand (PC-09). Removing asks for a confirmation: the nights become
 * bookable again on the site and free on the channels that read the export.
 */
function ManualBlockActions({ block, propertyId, canWriteProperty, onDeleted }: ManualBlockActionsProps) {
  const { t } = useTranslation();
  const deleteBlock = useDeleteManualBlock();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-2">
      {block.summary && (
        <p className="text-muted-foreground">{t('booking.calendar.manualBlock.noteLabel', { note: block.summary })}</p>
      )}
      <p className="text-muted-foreground">{t('booking.calendar.manualBlock.explanation')}</p>
      {!canWriteProperty ? (
        <p className="text-muted-foreground">{t('booking.calendar.manualBlock.readOnly')}</p>
      ) : confirming ? (
        <div className="space-y-2 rounded-md border bg-white px-3 py-2" data-testid="manual-block-delete-confirm">
          <p>{t('booking.calendar.manualBlock.deleteConfirm')}</p>
          {deleteBlock.isError && (
            <p className="text-sm text-destructive" role="alert">
              {getProblemMessage(deleteBlock.error, t) ?? t('booking.calendar.manualBlock.deleteFailed')}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                deleteBlock.reset();
                setConfirming(false);
              }}
              disabled={deleteBlock.isPending}
            >
              {t('booking.calendar.manualBlock.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteBlock.isPending}
              onClick={() => deleteBlock.mutate({ propertyId, blockId: block.id }, { onSuccess: () => onDeleted() })}
            >
              {deleteBlock.isPending
                ? t('booking.calendar.manualBlock.deleting')
                : t('booking.calendar.manualBlock.deleteConfirmAction')}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)} data-testid="manual-block-delete">
          <Trash2 className="mr-2 h-4 w-4" />
          {t('booking.calendar.manualBlock.delete')}
        </Button>
      )}
    </div>
  );
}

/**
 * Dates taken on another channel, opened from the calendar: where they come from and the stay dates. A block is not a
 * CasaZen booking, so there is no booking detail to open; an imported block can become an OTA stay ("Crea soggiorno
 * OTA", CO-21, decision D7), from which the guest check-in link, Alloggiati Web and the cockpit start.
 */
function BlockDetails({
  block,
  propertyId,
  onClose,
  canWrite,
  canWriteProperty,
  onStayCreated,
  onBlockDeleted,
}: BlockDetailsProps) {
  const { t, i18n } = useTranslation();
  const [creating, setCreating] = useState(false);
  return (
    <section
      aria-labelledby="calendar-block-title"
      className="space-y-2 rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="calendar-block-title" className="font-medium">
          {block.manual
            ? t('booking.calendar.manualBlock.title', { reason: blockSourceLabel(block, t) })
            : t('booking.calendar.block.title', { source: blockSourceLabel(block, t) })}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('booking.calendar.block.close')}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p>
        {t('booking.calendar.dates', {
          arrival: formatStayDate(block.arrival, i18n.language),
          departure: formatStayDate(block.departure, i18n.language),
          count: block.nights,
        })}
      </p>
      {block.manual ? (
        <ManualBlockActions
          block={block}
          propertyId={propertyId}
          canWriteProperty={canWriteProperty}
          onDeleted={onBlockDeleted}
        />
      ) : (
        <>
          {block.summary && (
            <p className="text-muted-foreground">{t('booking.calendar.block.summary', { summary: block.summary })}</p>
          )}
          <p className="text-muted-foreground">{t('booking.calendar.block.notABooking')}</p>
        </>
      )}
      {block.stayId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-white px-3 py-2">
          <span>{t('booking.icalBlock.converted')}</span>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/app/short-rent/bookings/${block.stayId}`} data-testid="calendar-block-open-stay">
              {t('booking.icalBlock.openStay')}
            </Link>
          </Button>
        </div>
      ) : block.manual ? null : !block.convertible ? (
        <p className="text-muted-foreground" data-testid="calendar-block-not-convertible">
          {t('booking.icalBlock.notConvertible')}
        </p>
      ) : !canWrite ? (
        <p className="text-muted-foreground">{t('booking.icalBlock.readOnly')}</p>
      ) : creating ? (
        <div className="rounded-md border bg-white p-4">
          <OtaStayForm
            blockId={block.id}
            channel={block.channel}
            onCreated={onStayCreated}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground">{t('booking.icalBlock.convertHint')}</p>
          <Button size="sm" onClick={() => setCreating(true)} data-testid="calendar-block-create-stay">
            <CalendarPlus className="mr-2 h-4 w-4" />
            {t('booking.otaStay.action')}
          </Button>
        </div>
      )}
    </section>
  );
}

export function CalendarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: properties, isLoading: propertiesLoading } = useProperties();
  const propertyList = Array.isArray(properties) ? properties : [];
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [view, setView] = useState<HostCalendarView>('month');
  // The day around which the view is shown; "today" is the calendar date in Rome (QA-CLOCK-FE).
  const [shownDate, setShownDate] = useState<string>(() => todayInRome());
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  // "Crea soggiorno OTA" needs booking.write (CO-21); without a workspace (e.g. tests) nothing is offered.
  const workspace = useContext(WorkspaceContext);
  const canWriteBookings = workspace?.hasPermission('short-rent', 'booking.write') ?? false;
  // "Blocca date" and "Elimina blocco" need property.write (PC-09).
  const canWriteProperty = workspace?.hasPermission('short-rent', 'property.write') ?? false;
  // The "Blocca date" form, open with the nights selected on the calendar (or from today).
  const [blockDraft, setBlockDraft] = useState<{ start?: string; end?: string } | null>(null);

  const activePropertyId = selectedPropertyId || propertyList[0]?.id || '';
  // First and last stay date of the month, week or day shown, both included (backend MO-06): part of the query key,
  // so every navigation asks for its own range.
  const { startDate, endDate } = useMemo(() => hostCalendarRange(view, shownDate), [view, shownDate]);

  const {
    data: calendarResponse,
    isLoading: calendarLoading,
    isError,
    error,
    refetch,
  } = useBookingCalendar(activePropertyId ? { propertyId: activePropertyId, startDate, endDate } : undefined);

  const events = useMemo(() => toHostCalendarEvents(calendarResponse?.items ?? []), [calendarResponse]);
  const selectedBlock = events.find(
    (event): event is HostCalendarBlockEvent => event.kind === 'block' && event.id === selectedBlockId,
  );

  const handleSelectEvent = useCallback(
    (event: HostCalendarEvent) => {
      if (event.kind === 'booking') {
        navigate(`/app/short-rent/bookings/${event.id}`);
      } else {
        setBlockDraft(null);
        setSelectedBlockId(event.id);
      }
    },
    [navigate],
  );

  const handleNavigate = useCallback((date: string) => {
    if (date) setShownDate(date);
  }, []);

  // Days selected on the calendar: the nights from the first to the last selected day are closed.
  const handleSelectSlot = useCallback((slot: SlotInfo) => {
    const days = (slot.slots.length > 0 ? slot.slots : [slot.start]).map(toStayDate).filter(Boolean).sort();
    const first = days[0];
    const last = days[days.length - 1];
    if (!first || !last) return;
    setSelectedBlockId(null);
    setBlockDraft({ start: first, end: addDays(last, 1) });
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('booking.calendar.pageTitle')}
          description={t('booking.calendar.pageDescription')}
          action={
            <div className="flex flex-wrap justify-end gap-2">
              {canWriteProperty && propertyList.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedBlockId(null);
                    setBlockDraft({});
                  }}
                  data-testid="manual-block-open"
                >
                  <CalendarOff className="mr-2 h-4 w-4" />
                  {t('booking.calendar.manualBlock.action')}
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/app/short-rent/bookings')}>
                <List className="mr-2 h-4 w-4" />
                {t('booking.calendar.listView')}
              </Button>
            </div>
          }
        />

        {propertiesLoading ? (
          <div className="flex h-[600px] items-center justify-center" role="status">
            <p>{t('booking.calendar.loading')}</p>
          </div>
        ) : propertyList.length === 0 ? (
          <div className="flex h-[400px] flex-col items-center justify-center gap-2 text-center">
            <p className="font-medium">{t('booking.calendar.noProperties')}</p>
            <p className="text-sm text-muted-foreground">
              {t('booking.calendar.noPropertiesHint')}
            </p>
            <Button onClick={() => navigate('/app/short-rent/properties')}>{t('booking.calendar.goToProperties')}</Button>
          </div>
        ) : (
          <>
            <div className="max-w-sm space-y-2">
              <Label htmlFor="calendar-property">{t('booking.calendar.property')}</Label>
              <select
                id="calendar-property"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={activePropertyId}
                onChange={(e) => {
                  setSelectedPropertyId(e.target.value);
                  setSelectedBlockId(null);
                  setBlockDraft(null);
                }}
              >
                {propertyList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {blockDraft && activePropertyId && (
              <section
                aria-labelledby="manual-block-form-title"
                className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-4"
              >
                <h2 id="manual-block-form-title" className="font-medium">
                  {t('booking.calendar.manualBlock.formTitle')}
                </h2>
                <ManualBlockForm
                  key={`${activePropertyId}-${blockDraft.start ?? ''}-${blockDraft.end ?? ''}`}
                  propertyId={activePropertyId}
                  initialStart={blockDraft.start}
                  initialEnd={blockDraft.end}
                  onCreated={() => setBlockDraft(null)}
                  onCancel={() => setBlockDraft(null)}
                />
              </section>
            )}

            {isError ? (
              // An API error is never shown as an empty calendar.
              <div
                role="alert"
                className="flex h-[400px] flex-col items-center justify-center gap-3 rounded-lg border text-center"
              >
                <p className="font-medium text-destructive">{t('booking.calendar.loadError')}</p>
                {getProblemMessage(error, t) && (
                  <p className="max-w-md text-sm text-muted-foreground">{getProblemMessage(error, t)}</p>
                )}
                <Button variant="outline" onClick={() => void refetch()}>
                  {t('booking.calendar.retry')}
                </Button>
              </div>
            ) : (
              <>
                <BookingCalendar
                  events={calendarLoading ? [] : events}
                  date={shownDate}
                  view={view}
                  onNavigate={handleNavigate}
                  onView={setView}
                  onSelectEvent={handleSelectEvent}
                  onSelectSlot={canWriteProperty ? handleSelectSlot : undefined}
                  loading={calendarLoading}
                />
                {selectedBlock && (
                  <BlockDetails
                    key={selectedBlock.id}
                    block={selectedBlock}
                    propertyId={activePropertyId}
                    onClose={() => setSelectedBlockId(null)}
                    canWrite={canWriteBookings}
                    canWriteProperty={canWriteProperty}
                    onBlockDeleted={() => setSelectedBlockId(null)}
                    onStayCreated={(booking) => {
                      setSelectedBlockId(null);
                      // The guest tab: the check-in link of the new stay is sent from there (CO-09).
                      navigate(`/app/short-rent/bookings/${booking.id}?tab=guest`);
                    }}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
