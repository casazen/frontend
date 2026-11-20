import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatRomeDateTime, formatStayDate } from '@/lib/stay-dates';
import {
  TICINO_POLICE_KEY,
  isAlreadyDeclaredConflict,
  useDeclareTicinoDay,
  useDownloadGroupSheet,
  useDownloadTicinoFile,
  useRecordTicinoDocument,
  useUndeclareTicinoDay,
} from '@/queries/swissCompliance';
import type { SwissReceiptType, TicinoFileFormat, TicinoNotificationDay } from '@/types/swissCompliance.types';
import { TicinoStructureIdForm } from './ticino-structure-id-form';
import { TICINO_STEPS, dayStateOf, firstStepOf, isFutureDay, stepStateOf, type TicinoStepId } from './ticino-day-model';
import { closedLineOf } from './ticino-day-text';
import { TicinoFileStep } from './ticino-file-step';
import { TicinoGuestsEditor } from './ticino-guests-editor';
import { TicinoGuestsStep } from './ticino-guests-step';
import { TicinoDeclareStep, TicinoPortalStep } from './ticino-portal-declare-steps';
import { TicinoReceiptStep } from './ticino-receipt-step';
import { TicinoStepSection } from './ticino-step-section';

interface TicinoDayViewProps {
  day: TicinoNotificationDay;
  /**
   * When the day was read (a time in ms): what is overdue and what has not started yet is told from it, because a render never reads the clock by itself, and a day that
   * is read again says it anew.
   */
  asOf: number;
  /** The first action on a day that was asked without a date pins it to the day the server picked: declaring it must leave it on screen, closed, not move on to the next one. */
  onPin: () => void;
  /** Another day of the property still to notify. */
  onPickDay: (day: string) => void;
  close: () => void;
}

/** The line under the title of the day: what it is, how it stands, and by when it is due. */
function DayHeader({ day, asOf, busy, onPickDay }: { day: TicinoNotificationDay; asOf: number; busy: boolean; onPickDay: (day: string) => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const dayName = formatStayDate(day.day, locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const otherDays = day.pendingDays.filter((pending) => pending.day !== day.day);
  const closed = closedLineOf(day, t, locale);
  const dueWhen = formatRomeDateTime(day.dueAt, locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  let line: string;
  if (closed) line = closed;
  else if (dayStateOf(day) === 'none') line = t('swiss.day.none');
  else if (isFutureDay(day, new Date(asOf))) line = t('swiss.day.future');
  else line = t(new Date(day.dueAt).getTime() < asOf ? 'swiss.day.overdue' : 'swiss.day.due', { when: dueWhen });

  return (
    <header className="space-y-2" data-testid="ticino-day-header">
      <h3 className="text-base font-semibold" data-testid="ticino-day-title">
        {t('swiss.day.title', { day: dayName })}
      </h3>
      <p className="text-sm text-foreground/70" data-testid="ticino-day-state">
        {line}
      </p>
      {otherDays.length > 0 ? (
        <p className="flex flex-wrap items-center gap-x-2 text-sm" data-testid="ticino-other-days">
          <span className="text-foreground/70">{t('swiss.day.otherDays')}</span>
          {otherDays.map((pending) => (
            <Button
              key={pending.day}
              type="button"
              variant="link"
              size="sm"
              className="h-auto min-h-11 p-0"
              disabled={busy}
              onClick={() => onPickDay(pending.day)}
              data-testid="ticino-pick-day"
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
 * The guided notification of the guests of an arrival day of a Ticino property to the cantonal police (E30/F02/US03/T02, casazen/backend#979), as the layer of the cockpit
 * shows it: who is notified, the file, the portal, the declaration that it was uploaded and the proof. CasaZen transmits nothing (decision D1): the host uploads the file on
 * the portal and says so here. Every state comes from the day the server sends (nothing of the progress is kept here), so the layer can be left and come back to. The buttons of
 * the layer wait while any request of it is on its way, and a file of a day that is closed asks the person first (the portal may create duplicates).
 */
export function TicinoDayView({ day, asOf, onPin, onPickDay, close }: TicinoDayViewProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspace();
  const propertyId = day.propertyId;
  const canRead = hasPermission('short-rent', 'guest.read');
  const canSubmit = hasPermission('short-rent', 'alloggiati.submit');
  const canEditGuests = hasPermission('short-rent', 'booking.write');
  const canEditProperty = hasPermission('short-rent', 'property.write');

  const download = useDownloadTicinoFile(propertyId);
  const groupSheet = useDownloadGroupSheet(propertyId);
  const declare = useDeclareTicinoDay(propertyId);
  const undeclare = useUndeclareTicinoDay(propertyId);
  const record = useRecordTicinoDocument(propertyId);
  // Every button of the layer waits while any request of it is on its way.
  const busy = download.isPending || groupSheet.isPending || declare.isPending || undeclare.isPending || record.isPending;

  // The step the person opened (`none`: they closed the open one); until then the one the day is at, so the layer opens where it was left.
  const [chosen, setChosen] = useState<TicinoStepId | 'none' | null>(null);
  const open: TicinoStepId | null = chosen === null ? firstStepOf(day) : chosen === 'none' ? null : chosen;
  // The format of a file waiting for the person's yes (the day is closed: the portal may create duplicates), and the stay whose guests are being completed.
  const [pendingFormat, setPendingFormat] = useState<TicinoFileFormat | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const requestFile = (format: TicinoFileFormat, confirmed: boolean) => {
    onPin();
    download.mutate(
      { reportDate: day.day, format, confirmRegenerate: confirmed },
      {
        // The file is down: the next thing is the portal.
        onSuccess: () => setChosen('portal'),
        // The day was closed meanwhile (a co-host declared it): the person is asked, as if the layer had known.
        onError: (error) => {
          if (isAlreadyDeclaredConflict(error)) setPendingFormat(format);
        },
      },
    );
  };

  const downloadFile = (format: TicinoFileFormat) => {
    if (day.alreadyDeclared) setPendingFormat(format);
    else requestFile(format, false);
  };

  const recordDocument = async (type: SwissReceiptType, reference: string, file: File): Promise<boolean> => {
    onPin();
    try {
      await record.mutateAsync({ type, reportDate: day.day, reference, file });
      return true;
    } catch {
      // The failure is told by the toast of the mutation; the file stays chosen.
      return false;
    }
  };

  const closedLine = closedLineOf(day, t, i18n.language);
  const hasArrivals = day.stayCount > 0;
  const toggle = (step: TicinoStepId) => setChosen(open === step ? 'none' : step);

  const content = (step: TicinoStepId) => {
    switch (step) {
      case 'guests':
        return <TicinoGuestsStep day={day} canEditGuests={canEditGuests} busy={busy} onComplete={setEditing} onNext={() => setChosen('file')} />;
      case 'file':
        return (
          <TicinoFileStep
            day={day}
            canDownload={canRead}
            busy={busy}
            onDownload={downloadFile}
            onGroupSheet={(bookingId) => {
              onPin();
              groupSheet.mutate({ bookingId, day: day.day });
            }}
          />
        );
      case 'portal':
        return <TicinoPortalStep day={day} onOpened={() => setChosen('declare')} />;
      case 'declare':
        return (
          <TicinoDeclareStep
            day={day}
            canSubmit={canSubmit}
            future={isFutureDay(day, new Date(asOf))}
            busy={busy}
            onDeclare={() => {
              onPin();
              declare.mutate({ arrivalDay: day.day }, { onSuccess: () => setChosen('receipt') });
            }}
            onUndeclare={() => {
              onPin();
              undeclare.mutate(day.day, { onSuccess: () => setChosen('declare') });
            }}
            onBackToPortal={() => setChosen('portal')}
          />
        );
      case 'receipt':
        return <TicinoReceiptStep day={day} canSubmit={canSubmit} busy={busy} onRecord={recordDocument} />;
    }
  };

  return (
    <div className="space-y-5 pb-2" data-testid="ticino-layer" aria-busy={busy || undefined}>
      <p className="text-sm text-foreground/70">{t('swiss.layer.intro')}</p>
      <DayHeader day={day} asOf={asOf} busy={busy} onPickDay={onPickDay} />

      {hasArrivals && !day.structureId ? (
        <section className="space-y-2" aria-labelledby="ticino-structure-title" data-testid="ticino-structure-missing">
          <h3 id="ticino-structure-title" className="text-sm font-semibold">
            {t('swiss.structureId.title')}
          </h3>
          <p className="text-sm text-foreground/70">{t('swiss.structureId.missing')}</p>
          {canEditProperty ? (
            <TicinoStructureIdForm propertyId={propertyId} value={day.structureId} onSaved={() => void queryClient.invalidateQueries({ queryKey: [TICINO_POLICE_KEY, propertyId] })} />
          ) : (
            <p className="text-sm text-foreground/70" data-testid="ticino-structure-readonly">
              {t('swiss.structureId.readOnly')}
            </p>
          )}
        </section>
      ) : null}

      {hasArrivals && day.structureId ? (
        <ol aria-label={t('swiss.layer.steps')} className="divide-y divide-border border-y border-border" data-testid="ticino-steps">
          {TICINO_STEPS.map((step, index) => (
            <TicinoStepSection key={step} id={step} position={index + 1} state={stepStateOf(step, day)} open={open === step} onToggle={() => toggle(step)}>
              {content(step)}
            </TicinoStepSection>
          ))}
        </ol>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={close} data-testid="ticino-later">
          {t('swiss.layer.later')}
        </Button>
      </div>

      {/* Next to the steps, not inside any form: the confirmation and the editor of the guests are dialogs of their own, and their events go up the tree of the page. */}
      <ConfirmationDialog
        open={pendingFormat !== null}
        onOpenChange={(next) => {
          if (!next) setPendingFormat(null);
        }}
        title={t('swiss.regenerate.title')}
        description={[closedLine, t('swiss.regenerate.risk')].filter(Boolean).join(' ')}
        consequences={[t('swiss.regenerate.consequence')]}
        confirmLabel={t('swiss.regenerate.confirm')}
        cancelLabel={t('swiss.regenerate.cancel')}
        isLoading={download.isPending}
        onConfirm={() => {
          if (pendingFormat) requestFile(pendingFormat, true);
        }}
      />
      {editing ? (
        <TicinoGuestsEditor
          bookingId={editing}
          onClose={() => {
            setEditing(null);
            // The guests were corrected (or not): the file of the day says who is in it now.
            void queryClient.invalidateQueries({ queryKey: [TICINO_POLICE_KEY, propertyId] });
          }}
        />
      ) : null}
    </div>
  );
}
