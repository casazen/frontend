import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isCancel } from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { archiveExportTooLarge } from '@/api/document-archive.api';
import type { ReportPeriod } from '@/api/reports.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PERIOD_PRESETS, basicPeriodProblem, presetPeriod, type PeriodPresetId } from '@/features/reports/report-period';
import { getProblemMessage } from '@/lib/api-errors';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { useExportArchive } from '@/queries/use-document-archive';
import type { ArchiveDocumentType, ArchiveExportTooLarge, ArchiveTypeCount } from '@/types';
import { formatFileSize } from './document-file';
import { archiveTypeMeta } from './document-type';

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** The box of a choice (a type of document): 44 px high, and it shows when it is on and when the keyboard is on it. */
const CHOICE =
  'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring';

interface ArchiveExportDialogProps {
  open: boolean;
  onClose: () => void;
  /** The types the server says the caller may read: the dialog offers these and no other. */
  types: readonly ArchiveTypeCount[];
  /** The properties of the caller, for the choice of one. */
  properties: ReadonlyArray<{ id: string; name: string }>;
  /** The property the list is narrowed to: the archive starts from it. */
  propertyId?: string;
}

/**
 * "Scarica l'archivio" (NF-99): asks for the period (always, at most 24 months: the presets of the reports, or the days to type), the
 * types of document and, when the caller has several, a property, and downloads the ZIP the server streams. While it comes the dialog says
 * so (with the bytes that arrived: the server does not know the size beforehand) and everything waits; closing the dialog stops the
 * download. The server refuses an archive that is too large before the first byte (422): the dialog then says how many files it found and
 * asks for a shorter period or fewer types.
 */
export function ArchiveExportDialog({ open, onClose, types, properties, propertyId }: ArchiveExportDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {open ? <ExportForm onClose={onClose} types={types} properties={properties} propertyId={propertyId} /> : null}
    </Dialog>
  );
}

function ExportForm({ onClose, types, properties, propertyId }: Omit<ArchiveExportDialogProps, 'open'>) {
  const { t, i18n } = useTranslation();
  const today = todayInRome();
  const exportArchive = useExportArchive();
  const pending = exportArchive.isPending;

  const [preset, setPreset] = useState<PeriodPresetId>('thisYear');
  const [custom, setCustom] = useState<ReportPeriod>(() => presetPeriod('thisYear', today));
  // What the person turned off, not what is on: every type the server offers is on, whenever the list of types arrives.
  const [off, setOff] = useState<ReadonlySet<ArchiveDocumentType>>(() => new Set());
  const [property, setProperty] = useState(propertyId ?? '');
  const [failure, setFailure] = useState<string | null>(null);
  const [tooLarge, setTooLarge] = useState<ArchiveExportTooLarge | null>(null);
  const [received, setReceived] = useState(0);

  // Whatever way the dialog closes (Cancel, Escape, a page that goes away) the form goes, and the download that was under way with it.
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );

  const period = preset === 'custom' ? custom : presetPeriod(preset, today);
  const periodProblem = basicPeriodProblem(period);
  const chosen = types.map((entry) => entry.type).filter((type) => !off.has(type));
  const noTypes = types.length > 0 && chosen.length === 0;
  const language = i18n.language;
  const from = formatStayDate(period.from, language, SHORT_DATE);
  const to = formatStayDate(period.to, language, SHORT_DATE);

  const forget = () => {
    setFailure(null);
    setTooLarge(null);
  };
  const choosePreset = (next: PeriodPresetId) => {
    // The days to type start from the ones the person was looking at.
    if (next === 'custom') setCustom(period);
    forget();
    setPreset(next);
  };
  const changeCustom = (change: Partial<ReportPeriod>) => {
    forget();
    setCustom((current) => ({ ...current, ...change }));
  };
  const toggleType = (type: ArchiveDocumentType) => {
    forget();
    setOff((current) => {
      const next = new Set(current);
      if (!next.delete(type)) next.add(type);
      return next;
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (periodProblem || noTypes || pending) return;

    forget();
    setReceived(0);
    const controller = new AbortController();
    request.current = controller;
    exportArchive.mutate(
      {
        query: { from: period.from, to: period.to, types: types.length > 0 ? chosen : undefined, propertyId: property || undefined },
        signal: controller.signal,
        onProgress: setReceived,
      },
      {
        onSuccess: () => {
          toast.success(t('documentArchive.export.done'));
          onClose();
        },
        onError: (error) => {
          if (isCancel(error)) return;
          const large = archiveExportTooLarge(error);
          if (large) setTooLarge(large);
          else setFailure(getProblemMessage(error, t) ?? t('documentArchive.export.failed'));
        },
      },
    );
  };

  return (
    <DialogContent data-testid="archive-export-dialog">
      <DialogHeader>
        <DialogTitle>{t('documentArchive.export.title')}</DialogTitle>
        <DialogDescription>{t('documentArchive.export.description')}</DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} noValidate aria-busy={pending || undefined}>
        <fieldset disabled={pending} className="m-0 min-w-0 space-y-4 border-0 p-0">
          <Field label={t('documentArchive.export.period')}>
            <Select value={preset} onChange={(event) => choosePreset(event.target.value as PeriodPresetId)} data-testid="archive-export-period">
              {PERIOD_PRESETS.map((id) => (
                <option key={id} value={id}>
                  {t(`reports.preset.${id}`)}
                </option>
              ))}
            </Select>
          </Field>

          {preset === 'custom' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('reports.dialog.customFrom')}>
                <Input
                  type="date"
                  value={custom.from}
                  min="2000-01-01"
                  max="2100-12-31"
                  onChange={(event) => changeCustom({ from: event.target.value })}
                  data-testid="archive-export-from"
                />
              </Field>
              <Field label={t('reports.dialog.customTo')}>
                <Input
                  type="date"
                  value={custom.to}
                  min="2000-01-01"
                  max="2100-12-31"
                  onChange={(event) => changeCustom({ to: event.target.value })}
                  data-testid="archive-export-to"
                />
              </Field>
            </div>
          ) : from && to ? (
            <p className="text-sm text-foreground/70" data-testid="archive-export-range">
              {t('reports.dialog.range', { from, to })}
            </p>
          ) : null}

          {types.length > 0 ? (
            <fieldset className="min-w-0 space-y-2 border-0 p-0">
              <legend className="text-sm font-medium">{t('documentArchive.export.types')}</legend>
              <div className="flex flex-wrap gap-2">
                {types.map(({ type }) => {
                  const meta = archiveTypeMeta(type);
                  const Icon = meta.icon;
                  return (
                    <label key={type} className={CHOICE}>
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={!off.has(type)}
                        onChange={() => toggleType(type)}
                        data-testid={`archive-export-type-${type}`}
                      />
                      <Icon className="size-4" aria-hidden="true" />
                      {t(meta.labelKey)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {properties.length > 1 ? (
            <Field label={t('documentArchive.export.property')}>
              <Select
                value={property}
                onChange={(event) => {
                  forget();
                  setProperty(event.target.value);
                }}
                data-testid="archive-export-property"
              >
                <option value="">{t('documentArchive.filters.allProperties')}</option>
                {properties.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </fieldset>

        {pending ? (
          <p role="status" className="mt-4 text-sm text-foreground/70" data-testid="archive-export-progress">
            {received > 0 ? t('documentArchive.export.received', { size: formatFileSize(received, language) }) : t('documentArchive.export.preparing')}
          </p>
        ) : null}
        {periodProblem ? (
          <p role="alert" className="mt-4 text-sm text-destructive" data-testid="archive-export-problem">
            {t(`documentArchive.export.error.${periodProblem}`)}
          </p>
        ) : null}
        {noTypes ? (
          <p role="alert" className="mt-4 text-sm text-destructive" data-testid="archive-export-no-types">
            {t('documentArchive.export.error.noTypes')}
          </p>
        ) : null}
        {tooLarge ? (
          <p role="alert" className="mt-4 text-sm text-destructive" data-testid="archive-export-too-large">
            {tooLarge.fileCount === null ? t('apiErrors.codes.archiveExportTooLarge') : t('documentArchive.export.tooLarge', { count: tooLarge.fileCount })}
          </p>
        ) : null}
        {failure ? (
          <p role="alert" className="mt-4 text-sm text-destructive" data-testid="archive-export-failure">
            {failure}
          </p>
        ) : null}

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('shared.cancel')}
          </Button>
          <Button type="submit" loading={pending} disabled={periodProblem !== null || noTypes} data-testid="archive-export-start">
            {failure || tooLarge ? t('documentArchive.export.retry') : t('documentArchive.export.start')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
