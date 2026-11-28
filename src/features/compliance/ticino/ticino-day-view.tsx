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
  onPin: () => void;
  onPickDay: (day: string) => void;
  close: () => void;
}

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
    <header className="space-y-2 rounded-xl border bg-muted/40 p-4" data-testid="ticino-day-header">
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
  const busy = download.isPending || groupSheet.isPending || declare.isPending || undeclare.isPending || record.isPending;

  const [chosen, setChosen] = useState<TicinoStepId | 'none' | null>(null);
  const open: TicinoStepId | null = chosen === null ? firstStepOf(day) : chosen === 'none' ? null : chosen;
  const [pendingFormat, setPendingFormat] = useState<TicinoFileFormat | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const requestFile = (format: TicinoFileFormat, confirmed: boolean) => {
    onPin();
    download.mutate(
      { reportDate: day.day, format, confirmRegenerate: confirmed },
      {
        onSuccess: () => setChosen('portal'),
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
        <ol aria-label={t('swiss.layer.steps')} className="space-y-2" data-testid="ticino-steps">
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
            void queryClient.invalidateQueries({ queryKey: [TICINO_POLICE_KEY, propertyId] });
          }}
        />
      ) : null}
    </div>
  );
}
