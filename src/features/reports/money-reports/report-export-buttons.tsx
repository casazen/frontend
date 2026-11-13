import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ReportAccessDeniedError, type ReportFileFormat } from '@/api/report-files';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';

interface ReportExportButtonsProps {
  /** What the file is asked for (the days and the property): a failure belongs to it and is not shown for another. */
  requestKey: string;
  /** The server is not asked for this file now (the days are wrong, the person may not read the report): both buttons are off. */
  disabled: boolean;
  /** The file from the authenticated API, as a Blob. Nothing keeps it: it is saved and let go of. */
  fetchFile: (format: ReportFileFormat) => Promise<Blob>;
  /** The name the file is saved under: the report and its days, never a property, a guest or an owner. */
  fileName: (format: ReportFileFormat) => string;
  /** Prefix of the test ids (`<prefix>-csv`, `-xlsx`, `-failure`). */
  testId: string;
}

/**
 * "Scarica CSV" and "Scarica Excel" of a money report. The file is read from the authenticated API (never from an address that the
 * browser opens without the token), saved and let go of: the Blob is held by no cache and its object address is revoked as soon as it is
 * saved. While a request is on its way both buttons are off, so a second click cannot ask for a second file. A failure is said in words
 * under the buttons (a file with too many rows tells the person to narrow the period), never as a file that did not come.
 */
export function ReportExportButtons({ requestKey, disabled, fetchFile, fileName, testId }: ReportExportButtonsProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<ReportFileFormat | null>(null);
  const [failure, setFailure] = useState<{ requestKey: string; message: string } | null>(null);
  // The state is read on the next render: a double click in the same tick must not start two requests.
  const inFlight = useRef(false);

  const download = async (format: ReportFileFormat) => {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setPending(format);
    setFailure(null);
    try {
      saveBlobAs(await fetchFile(format), fileName(format));
    } catch (error) {
      const message =
        error instanceof ReportAccessDeniedError
          ? t('reports.money.noAccess')
          : (getProblemMessage(error, t) ?? t('reports.money.export.failed'));
      setFailure({ requestKey, message });
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const busy = pending !== null;
  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          loading={pending === 'csv'}
          disabled={disabled || busy}
          onClick={() => void download('csv')}
          data-testid={`${testId}-csv`}
        >
          <Download aria-hidden="true" className="size-4" />
          {t('reports.money.export.csv')}
        </Button>
        <Button
          type="button"
          variant="outline"
          loading={pending === 'xlsx'}
          disabled={disabled || busy}
          onClick={() => void download('xlsx')}
          data-testid={`${testId}-xlsx`}
        >
          <Download aria-hidden="true" className="size-4" />
          {t('reports.money.export.xlsx')}
        </Button>
      </div>
      {failure && failure.requestKey === requestKey ? (
        <p role="alert" className="max-w-sm text-right text-sm text-destructive" data-testid={`${testId}-failure`}>
          {failure.message}
        </p>
      ) : null}
    </div>
  );
}
