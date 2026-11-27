import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarOff, CircleDollarSign, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { addDays } from '@/lib/stay-dates';
import type { CalendarChange } from '@/types/calendar-changes.types';
import type { CalendarDayInfo } from '@/types/calendar-days.types';
import { useApplyCalendarChange } from '@/queries/use-calendar-changes';
import type { DayLayerProperty } from '../lib/day-layer';
import { selectedDays, selectionDatesText, type DaySelection } from '../lib/day-selection';
import { CalendarChangeLines } from './calendar-change-lines';
import { DayRulesForm } from './day-rules-form';
import { ManualBlockForm } from './manual-block-form';

type PanelAction = 'block' | 'price' | 'restrictions';

interface DayPanelProps {
  selection: DaySelection;
  propertyName: string;
  /** The day layer of the property (its currency and its nights), when the caller may read it: the current values and the taken nights are told from it. */
  layer?: DayLayerProperty;
  /** Today in the calendar (Europe/Rome): the days before it cannot be changed. */
  today: string;
  /** The panel is closed (Escape, the close button, "Close"): the selection is dropped. */
  onClose: () => void;
  /** The focus goes into the panel when it opens. Not when the days are selected from the keyboard on the calendar: the focus stays on the day, so that Shift plus arrow goes on extending the selection. */
  moveFocus?: boolean;
}

/**
 * The panel of the days selected on the calendar (E08/F05/US03/T02, NF-78, NF-36): the property, the dates and the number of nights ("12-15 settembre · Appartamento X · 3
 * notti") and three actions in a segmented control. "Block" is the form of the manual block, with a note when a night of the selection is taken; "Price" is one price per night
 * with where the current one comes from and a way back to the usual one; "Restrictions" are the stay and advance rules and the closures, each with its current value and a
 * "Clear". Past days cannot be changed or blocked, and the panel says why. After a change it says in plain words what happened to each part (`CalendarChangeLines`).
 *
 * It sits beside the calendar and does not cover it, so the selection can still be extended with the next click, Shift plus click or Shift plus arrow; the buttons stay off while
 * a request of the panel is on its way.
 */
export function DayPanel({ selection, propertyName, layer, today, onClose, moveFocus = true }: DayPanelProps) {
  const { t, i18n } = useTranslation();
  const phone = useMediaQuery(PHONE_QUERY);
  const [action, setAction] = useState<PanelAction>('block');
  const apply = useApplyCalendarChange();
  // A block of the days is a request of its own (the form owns it) and is on its way: the panel keeps its tabs and its close off, as for a change of price or rules.
  const [blocking, setBlocking] = useState(false);
  const busy = apply.isPending || blocking;
  const [applied, setApplied] = useState<{ key: string; change: CalendarChange } | null>(null);

  const key = `${selection.propertyId}|${selection.from}|${selection.to}`;
  const days = useMemo(() => selectedDays(selection), [selection]);
  const futureDays = useMemo(() => days.filter((day) => day >= today), [days, today]);
  const pastCount = days.length - futureDays.length;
  const allPast = futureDays.length === 0;
  // What the days hold now, for the nights that change; the nights taken by a booking, a hold, a request or a block, for the note of the block.
  const layerDays = useMemo(() => (layer ? futureDays.map((day) => layer.days.get(day)).filter((day): day is CalendarDayInfo => day !== undefined) : undefined), [layer, futureDays]);
  const takenCount = layerDays?.filter((day) => day.taken).length ?? 0;

  const result = applied?.key === key ? applied.change : null;
  const activeAction: PanelAction = allPast ? 'block' : action;

  const submit = (request: Parameters<typeof apply.mutate>[0]) => {
    apply.mutate(request, { onSuccess: (change) => setApplied({ key, change }) });
  };

  const title = t('booking.calendar.panel.title', { dates: selectionDatesText(selection, i18n.language), property: propertyName, count: days.length });

  return (
    <Sheet
      open
      modal={false}
      onOpenChange={(open) => {
        // A request on its way is not abandoned by a press of Escape: the panel stays until it has answered.
        if (!open && !busy) onClose();
      }}
    >
      <SheetContent
        side={phone ? 'bottom' : 'right'}
        overlay={false}
        // The calendar beside the panel stays in use (the next click extends the selection): a press outside does not close it.
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          if (!moveFocus) event.preventDefault();
        }}
        className="w-full overflow-y-auto sm:max-w-md"
        data-testid="day-panel"
      >
        <SheetHeader>
          <SheetTitle data-testid="day-panel-title">{title}</SheetTitle>
          <SheetDescription>{t('booking.calendar.panel.description')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-6 pb-6">
          {result ? (
            <div className="space-y-4" data-testid="day-panel-result">
              <CalendarChangeLines change={result} propertyName={() => propertyName} />
              <Button type="button" onClick={onClose} data-testid="day-panel-done">
                {t('booking.calendar.panel.done')}
              </Button>
            </div>
          ) : (
            <>
              <Segmented<PanelAction>
                label={t('booking.calendar.panel.actions')}
                value={activeAction}
                onValueChange={setAction}
                options={[
                  { value: 'block', label: t('booking.calendar.panel.block'), icon: CalendarOff, disabled: allPast || busy, testId: 'day-panel-block' },
                  { value: 'price', label: t('booking.calendar.panel.price'), icon: CircleDollarSign, disabled: allPast || busy, testId: 'day-panel-price' },
                  { value: 'restrictions', label: t('booking.calendar.panel.restrictions'), icon: SlidersHorizontal, disabled: allPast || busy, testId: 'day-panel-restrictions' },
                ]}
              />

              {allPast ? (
                <p role="status" className="rounded-md border bg-muted px-3 py-2 text-sm" data-testid="day-panel-past">
                  {t('booking.calendar.panel.allPast')}
                </p>
              ) : pastCount > 0 ? (
                <p role="status" className="text-sm text-muted-foreground" data-testid="day-panel-some-past">
                  {t('booking.calendar.panel.somePast', { count: pastCount })}
                </p>
              ) : null}

              {activeAction === 'block' ? (
                <div className="space-y-3">
                  {takenCount > 0 ? (
                    <p role="status" className="rounded-md border border-[color:var(--color-warning)] bg-[color:var(--color-warning-soft)] px-3 py-2 text-sm text-[color:var(--color-warning-foreground)]" data-testid="day-panel-taken">
                      {t('booking.calendar.panel.taken', { count: takenCount })}
                    </p>
                  ) : null}
                  {allPast ? null : (
                    <ManualBlockForm
                      key={key}
                      propertyId={selection.propertyId}
                      initialStart={selection.from}
                      initialEnd={addDays(selection.to, 1)}
                      onCreated={onClose}
                      onCancel={onClose}
                      onPendingChange={setBlocking}
                    />
                  )}
                </div>
              ) : (
                <DayRulesForm
                  key={`${key}|${activeAction}`}
                  mode={activeAction}
                  selection={selection}
                  days={layerDays}
                  currency={layer?.currency ?? 'EUR'}
                  pending={apply.isPending}
                  error={apply.isError ? apply.error : null}
                  onSubmit={submit}
                />
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

