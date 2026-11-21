import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleHelp, Info, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatStayDate } from '@/lib/stay-dates';
import type { StatusTone } from '@/lib/status-dictionary';
import { cn } from '@/lib/utils';
import { SWISS_NOTIFICATION_KEY, useDeclareSwissDay, useUndeclareSwissDay } from '@/queries/swissCompliance';
import type { SwissNotificationDay } from '@/types/swissCompliance.types';
import { TicinoGuestsEditor } from '../ticino/ticino-guests-editor';
import { SWISS_STEPS, certaintyOf, dayStateOf, firstStepOf, isFutureDay, regimeTextKey, stepStateOf, type SwissStepId } from './swiss-day-model';
import { stateLineOf } from './swiss-day-text';
import { SwissGuestsStep } from './swiss-guests-step';
import { SwissDeclareStep, SwissPortalStep } from './swiss-portal-declare-steps';
import { SwissStepSection } from './swiss-step-section';

interface SwissDayViewProps {
  day: SwissNotificationDay;
  /**
   * When the day was read (a time in ms): what is overdue and what has not started yet is told from it, because a render never reads the clock by itself, and a day that is read again
   * says it anew.
   */
  asOf: number;
  /** The first action on a day that was asked without a date pins it to the day the server picked: declaring it must leave it on screen, closed, not move on to the next one. */
  onPin: () => void;
  /** Another day of the property still to notify. */
  onPickDay: (day: string) => void;
  close: () => void;
}

/** The certainty is a word and an icon, never red (decision D5): an uncertain rule is told, not alarmed. */
const CERTAINTY_TONES: Record<ReturnType<typeof certaintyOf>, StatusTone> = { Verified: 'success', Partial: 'info', Unverified: 'neutral' };
const CERTAINTY_ICONS: Record<StatusTone, LucideIcon> = { success: CheckCircle2, info: Info, neutral: CircleHelp, warning: Info, danger: Info };

/** The line under the title of the day: what it is, how it stands, and by when it is due. */
function DayHeader({ day, asOf, busy, onPickDay }: { day: SwissNotificationDay; asOf: number; busy: boolean; onPickDay: (day: string) => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const dayName = formatStayDate(day.day, locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const otherDays = day.pendingDays.filter((pending) => pending.day !== day.day);

  return (
    <header className="space-y-2" data-testid="swiss-day-header">
      <h3 className="text-base font-semibold" data-testid="swiss-day-title">
        {t('swissNotification.day.title', { day: dayName })}
      </h3>
      <p className="text-sm text-foreground/70" data-testid="swiss-day-state">
        {stateLineOf(day, t, locale, asOf)}
      </p>
      {otherDays.length > 0 ? (
        <p className="flex flex-wrap items-center gap-x-2 text-sm" data-testid="swiss-other-days">
          <span className="text-foreground/70">{t('swissNotification.day.otherDays')}</span>
          {otherDays.map((pending) => (
            <Button
              key={pending.day}
              type="button"
              variant="link"
              size="sm"
              className="h-auto min-h-11 p-0"
              disabled={busy}
              onClick={() => onPickDay(pending.day)}
              data-testid="swiss-pick-day"
            >
              {formatStayDate(pending.day, locale, { day: 'numeric', month: 'long' })}
            </Button>
          ))}
        </p>
      ) : null}
    </header>
  );
}

/**
 * What the canton asks, in the words of the regime: how the notification is made, the deadline and how sure the source is, always with the sentence that sends the host to check with the
 * municipality or the police (CasaZen gives no legal advice). An uncertain source is told as such and never in red.
 */
function CantonBlock({ day }: { day: SwissNotificationDay }) {
  const { t } = useTranslation();
  const certainty = certaintyOf(day);
  const tone = CERTAINTY_TONES[certainty];
  const CertaintyIcon = CERTAINTY_ICONS[tone];
  const note = day.deadlineNote?.trim();

  return (
    <section className="space-y-2" aria-labelledby="swiss-canton-title" data-testid="swiss-canton" data-certainty={certainty}>
      <h3 id="swiss-canton-title" className="text-sm font-semibold">
        {day.cantonCode ? t('swissNotification.canton.titleFor', { canton: day.cantonCode }) : t('swissNotification.canton.title')}
      </h3>
      <p className="text-sm" data-testid="swiss-canton-channel">
        {t(regimeTextKey('channel', day.channel))}
      </p>
      <p className="text-sm" data-testid="swiss-canton-deadline">
        {t(regimeTextKey('deadline', day.deadlineKind))}
        {note ? <span className="block text-foreground/70">{note}</span> : null}
      </p>
      <div className="space-y-1">
        <span className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', STATUS_TONE_CLASSES[tone])} data-testid="swiss-certainty">
          <CertaintyIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="min-w-0 break-words">{t(`guestRegistration.certainty.${certainty}.label`)}</span>
        </span>
        <p className="text-sm text-foreground/70">{t(`swissNotification.certainty.${certainty}`)}</p>
      </div>
    </section>
  );
}

/**
 * The guided notification of the guests of an arrival day of a property in a canton other than Ticino (E31/F02/US02/T02, NF-131, casazen/backend#979), as the layer of the cockpit shows
 * it: the guests as data ready to copy, the portal of the canton, the declaration that it was done. CasaZen transmits nothing and never logs into a portal (decision D1): the host copies
 * the data, notifies on the portal and says so here. Every state comes from the day the server sends (nothing of the progress is kept here), so the layer can be left and come back
 * to. The buttons of the layer wait while any request of it is on its way.
 */
export function SwissDayView({ day, asOf, onPin, onPickDay, close }: SwissDayViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspace();
  const propertyId = day.propertyId;
  const canSubmit = hasPermission('short-rent', 'alloggiati.submit');
  const canEditGuests = hasPermission('short-rent', 'booking.write');

  const declare = useDeclareSwissDay(propertyId);
  const undeclare = useUndeclareSwissDay(propertyId);
  // Every button of the layer waits while any request of it is on its way.
  const busy = declare.isPending || undeclare.isPending;

  // The step the person opened (`none`: they closed the open one); until then the one the day is at, so the layer opens where it was left.
  const [chosen, setChosen] = useState<SwissStepId | 'none' | null>(null);
  const open: SwissStepId | null = chosen === null ? firstStepOf(day) : chosen === 'none' ? null : chosen;
  // The stay whose guests are being completed.
  const [editing, setEditing] = useState<string | null>(null);

  const toggle = (step: SwissStepId) => setChosen(open === step ? 'none' : step);
  const dutyAnswered = day.effectiveDuty === 'Ask' || day.effectiveDuty === 'NotRequired';

  const content = (step: SwissStepId) => {
    switch (step) {
      case 'guests':
        return <SwissGuestsStep day={day} canEditGuests={canEditGuests} busy={busy} onComplete={setEditing} onNext={() => setChosen('portal')} />;
      case 'portal':
        return <SwissPortalStep day={day} busy={busy} onOpened={() => setChosen('declare')} />;
      case 'declare':
        return (
          <SwissDeclareStep
            day={day}
            canSubmit={canSubmit}
            future={isFutureDay(day, new Date(asOf))}
            busy={busy}
            onDeclare={() => {
              onPin();
              declare.mutate({ arrivalDay: day.day });
            }}
            onUndeclare={() => {
              onPin();
              undeclare.mutate(day.day, { onSuccess: () => setChosen('declare') });
            }}
            onBackToPortal={() => setChosen('portal')}
          />
        );
    }
  };

  return (
    <div className="space-y-5 pb-2" data-testid="swiss-layer" aria-busy={busy || undefined}>
      <p className="text-sm text-foreground/70">{t('swissNotification.layer.intro')}</p>
      <DayHeader day={day} asOf={asOf} busy={busy} onPickDay={onPickDay} />
      <CantonBlock day={day} />

      {dutyAnswered ? (
        <p className="text-sm text-foreground/70" data-testid="swiss-duty">
          {t(`swissNotification.duty.${day.effectiveDuty}`)}
        </p>
      ) : null}

      {dayStateOf(day) !== 'none' ? (
        <ol aria-label={t('swissNotification.layer.steps')} className="divide-y divide-border border-y border-border" data-testid="swiss-steps">
          {SWISS_STEPS.map((step, index) => (
            <SwissStepSection key={step} id={step} position={index + 1} state={stepStateOf(step, day)} open={open === step} onToggle={() => toggle(step)}>
              {content(step)}
            </SwissStepSection>
          ))}
        </ol>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={close} data-testid="swiss-later">
          {t('swissNotification.layer.later')}
        </Button>
      </div>

      {/* Next to the steps, not inside any form: the editor of the guests is a dialog of its own, and its events go up the tree of the page. */}
      {editing ? (
        <TicinoGuestsEditor
          bookingId={editing}
          onClose={() => {
            setEditing(null);
            // The guests were corrected (or not): the data of the day say who is complete now.
            void queryClient.invalidateQueries({ queryKey: [SWISS_NOTIFICATION_KEY, propertyId] });
          }}
        />
      ) : null}
    </div>
  );
}
