import { useEffect, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isArchiveCallCancelled } from '@/api/document-archive.api';
import { ReportAccessDeniedError } from '@/api/report-files';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { isFeatureEnabled } from '@/config/feature-flags';
import { defaultPackagePeriod, parsePackagePeriod, periodChoices, periodKey } from '@/features/accountant/accountant-package-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { useExportOwnerIssuedDocuments } from '@/queries/use-owner-issuer-profile';

interface IssuedDocumentsExportProps {
  /** The test id of the block: the agency page and the portal each have their own. */
  testId: string;
  /** Downloads the ZIP of the period (`2026-10` for a month, `2026` for a year) and saves it. It rejects with the failure, which `problemOf` turns into words. A call the person stopped is not one. */
  download: (request: { period: string; signal: AbortSignal }) => Promise<void>;
  /** What a failed download says, in words. */
  problemOf: (error: unknown) => string;
  /** The words of the button: the owner says «for your accountant», the agency «for the accountant of the owner». */
  downloadLabel: string;
}

/**
 * «Scarica per il tuo commercialista» (E17/F03/US01/T03, NF-116): the month or the year of the documents CasaZen issued in the name of an owner, as one ZIP for the accountant of the owner (the PDF and
 * the XML of every document, their register and the index with the SHA-256 of each file). The same block is on the page of the owner of the agency and in the portal of the owner: only the call
 * differs. The period is chosen from the last months and the last years (the month that is over is the first), the button takes no second press while the file comes, and a failure is told next to it in
 * words, never as a file that is empty. Whatever way the page goes away the download goes with it.
 */
export function IssuedDocumentsExport({ testId, download, problemOf, downloadLabel }: IssuedDocumentsExportProps) {
  const { t } = useTranslation();
  const { month } = useOwnerFormat();
  const [today] = useState(() => todayInRome());
  const [selected, setSelected] = useState(() => defaultPackagePeriod(today));
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );

  const key = periodKey(selected);
  const choices = periodChoices(today, selected);

  const start = async () => {
    if (pending) return;
    setProblem(null);
    setPending(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      await download({ period: key, signal: controller.signal });
      toast.success(t('issuedDocuments.export.done'));
    } catch (error) {
      // A call the person stopped (the page went away) is not a failure to tell.
      if (!isArchiveCallCancelled(error)) setProblem(problemOf(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3" data-testid={testId}>
      <p className="break-words text-sm text-foreground/70">{t('issuedDocuments.export.description')}</p>
      <div className="grid gap-3 sm:max-w-md sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label={t('issuedDocuments.export.period')}>
          <Select
            value={key}
            onChange={(event) => {
              const next = parsePackagePeriod(event.target.value);
              if (next) {
                setSelected(next);
                setProblem(null);
              }
            }}
            disabled={pending}
            data-testid={`${testId}-period`}
          >
            <optgroup label={t('issuedDocuments.export.months')}>
              {choices.months.map((value) => {
                const parsed = parsePackagePeriod(value);
                return (
                  <option key={value} value={value}>
                    {parsed?.kind === 'month' ? month(parsed.year, parsed.month) : value}
                  </option>
                );
              })}
            </optgroup>
            <optgroup label={t('issuedDocuments.export.years')}>
              {choices.years.map((value) => (
                <option key={value} value={value}>
                  {t('issuedDocuments.export.year', { year: value })}
                </option>
              ))}
            </optgroup>
          </Select>
        </Field>
        <Button type="button" className="h-auto min-h-11 whitespace-normal py-2" loading={pending} disabled={pending} onClick={() => void start()} data-testid={`${testId}-download`}>
          {downloadLabel}
        </Button>
      </div>
      {pending ? (
        <p role="status" className="text-sm text-foreground/70" data-testid={`${testId}-progress`}>
          {t('issuedDocuments.export.preparing')}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-sm text-destructive" data-testid={`${testId}-problem`}>
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/** What a failed export of the agency says, in words: a refusal of the role or of the reach (403), the module being off or an owner that is not there (404), and the sentence of the code of any other. */
function exportProblemOf(error: unknown, t: TFunction): string {
  if (error instanceof ReportAccessDeniedError) return t('issuedDocuments.export.forbidden');
  if (getHttpStatus(error) === 404) return t('issuedDocuments.export.unavailable');
  return getProblemMessage(error, t) ?? t('issuedDocuments.export.failed');
}

/**
 * The export for the accountant of an owner on the financial page of the owner (E17/F03/US01/T03): the documents CasaZen issued in the owner's name, the same ZIP the owner downloads in its portal. It exists
 * only while the issuance of fiscal documents is on (off: nothing is drawn). The server decides who may download it (`agency.statement.view` and the whole organization): a refusal is told here in words.
 */
export function OwnerIssuedDocumentsSection({ ownerId }: { ownerId: string }) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const exporter = useExportOwnerIssuedDocuments();
  if (!isFeatureEnabled(flags, 'fiscalDocumentIssuance')) return null;

  return (
    <PlainSection title={t('issuedDocuments.agency.title')} data-testid="owner-issued-documents-section">
      <IssuedDocumentsExport testId="owner-issued-export" download={({ period, signal }) => exporter.mutateAsync({ ownerId, period, signal })} problemOf={(error) => exportProblemOf(error, t)} downloadLabel={t('issuedDocuments.agency.download')} />
    </PlainSection>
  );
}
