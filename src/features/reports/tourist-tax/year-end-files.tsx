import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ReportAccessDeniedError, type ReportFileFormat } from '@/api/report-files';
import type { YearEndAccountCut } from '@/api/tourist-tax-summary.api';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { getTouristTaxErrorMessage } from '@/lib/tourist-tax-summary-errors';
import { useDownloadTouristTaxYearEndFile } from '@/queries/use-tourist-tax-year-end';
import { YEAR_END_ACCOUNT_CUTS, type YearEndFileRequest, type YearEndRow } from './tourist-tax-year-end-model';

/** Where the properties are listed and edited: where the municipality of a house in Switzerland is completed. */
const PROPERTIES_PATH = '/app/short-rent/properties';

/** The two formats of a file: the CSV for a spreadsheet set to Italian, the Excel file the accountant opens. */
const FORMATS: readonly ReportFileFormat[] = ['csv', 'xlsx'];

/** What a failed file says, in words: a caller who may not read it (no payments permission, or not the whole organization), the sentence of the code of any other, else that the file did not come. */
function failureText(error: unknown, t: TFunction): string {
  if (error instanceof ReportAccessDeniedError) return t('reports.touristTax.yearEnd.files.noAccess');
  return getTouristTaxErrorMessage(error, t) ?? t('reports.touristTax.yearEnd.files.failed');
}

interface FormatButtonsProps {
  id: string;
  /** What the file is, for a screen reader that reads the buttons of the page one after the other. */
  title: string;
  /** The format being made now (the request of this row that is on its way), if any. */
  pending: ReportFileFormat | null;
  disabled: boolean;
  onDownload: (format: ReportFileFormat) => void;
}

function FormatButtons({ id, title, pending, disabled, onDownload }: FormatButtonsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      {FORMATS.map((format) => (
        <Button
          key={format}
          type="button"
          size="sm"
          variant="outline"
          loading={pending === format}
          disabled={disabled}
          aria-label={t('reports.touristTax.yearEnd.files.formatFor', { format: t(`reports.touristTax.yearEnd.files.format.${format}`), title })}
          onClick={() => onDownload(format)}
          data-testid={`year-end-${id}-${format}`}
        >
          <Download aria-hidden="true" className="size-4" />
          {t(`reports.touristTax.yearEnd.files.format.${format}`)}
        </Button>
      ))}
    </div>
  );
}

interface FileRowProps extends FormatButtonsProps {
  description: string;
  failure: string | null;
  /** What the person chooses before the file is made (how the account is cut). */
  control?: ReactNode;
  /** What waits under the buttons: a note about what the file holds. */
  children?: ReactNode;
}

function FileRow({ id, title, description, control, pending, disabled, failure, children, onDownload }: FileRowProps) {
  return (
    <li className="min-w-0 space-y-2 py-3" data-testid={`year-end-${id}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <p className="break-words text-base font-semibold">{title}</p>
          <p className="break-words text-sm text-foreground/70">{description}</p>
        </div>
        <FormatButtons id={id} title={title} pending={pending} disabled={disabled} onDownload={onDownload} />
      </div>
      {control}
      {children}
      {failure ? (
        <p role="alert" className="break-words text-sm text-destructive" data-testid={`year-end-${id}-failure`}>
          {failure}
        </p>
      ) : null}
    </li>
  );
}

interface YearEndFilesProps {
  year: number;
  /** How the account of the agent is cut: the choice is the page's, because the account on screen is cut the same way. */
  by: YearEndAccountCut;
  onByChange: (by: YearEndAccountCut) => void;
  /** The caller holds `guest.read`: the declaration then counts the exemptions by reason; without it the server gives the age and one restricted row (art. 9 GDPR). The server decides again. */
  canReadReasons: boolean;
}

/**
 * The three files of the tourist tax at year end that the agency hands over (E18/F01/US02/T03, NF-117): the declaration to the comuni, the account of the agent (by month or by quarter) and the yearly count of the nights
 * of Ticino, each as a CSV or an Excel file. CasaZen prepares the data and files nothing, and says so. The same data is on screen in the sections of the page (`YearEndDetails`), but a file is never opened: the bytes go
 * to the disk as they came, the server neutralizes the cells that a spreadsheet would run as formulas, and the reasons of an exemption are the server's (they are in the file only for who holds `guest.read`: the page
 * says which of the two the caller gets, it never works a reason out).
 *
 * While one is on its way no other is asked, a second click does nothing, and a failure is told under the file it belongs to in words (a caller who does not reach the whole organization, a year the server does not
 * take), never as a file that is empty. A failure belongs to the year and the cut it was asked for.
 */
export function YearEndFiles({ year, by, onByChange, canReadReasons }: YearEndFilesProps) {
  const { t } = useTranslation();
  const download = useDownloadTouristTaxYearEndFile();
  const scope = `${year}-${by}`;
  const [asked, setFailure] = useState<{ row: YearEndRow; message: string; scope: string } | null>(null);
  const failure = asked?.scope === scope ? asked : null;
  // A request is on its way: the state of the mutation says it a moment later than the click, so a second one in between is stopped here.
  const sending = useRef(false);
  const working = download.isPending;
  const pendingRequest = download.isPending ? download.variables : undefined;
  const pendingFormat = (kind: YearEndRow): ReportFileFormat | null => (pendingRequest?.kind === kind ? pendingRequest.format : null);

  const start = async (request: YearEndFileRequest) => {
    if (sending.current) return;
    sending.current = true;
    setFailure(null);
    try {
      await download.mutateAsync(request);
    } catch (error) {
      setFailure({ row: request.kind, message: failureText(error, t), scope });
    } finally {
      sending.current = false;
    }
  };
  const failureOf = (row: YearEndRow) => (failure?.row === row ? failure.message : null);

  const declarationTitle = t('reports.touristTax.yearEnd.declaration.title', { year });
  const accountTitle = t('reports.touristTax.yearEnd.account.title', { year });
  const ticinoTitle = t('reports.touristTax.yearEnd.ticino.title', { year });

  return (
    <PlainSection title={t('reports.touristTax.yearEnd.files.title')} data-testid="year-end-files">
      <p className="break-words text-sm text-foreground/70">{t('reports.touristTax.yearEnd.files.note')}</p>
      <ul role="list" className="divide-y divide-border">
        <FileRow
          id="declaration"
          title={declarationTitle}
          description={t('reports.touristTax.yearEnd.declaration.description')}
          disabled={working}
          pending={pendingFormat('declaration')}
          failure={failureOf('declaration')}
          onDownload={(format) => void start({ kind: 'declaration', year, format })}
        >
          <p className="break-words text-sm" data-testid="year-end-declaration-reasons">
            {canReadReasons ? t('reports.touristTax.yearEnd.declaration.reasons') : t('reports.touristTax.yearEnd.declaration.reasonsRestricted')}
          </p>
        </FileRow>

        <FileRow
          id="agent-account"
          title={accountTitle}
          description={t('reports.touristTax.yearEnd.account.description')}
          disabled={working}
          pending={pendingFormat('agentAccount')}
          failure={failureOf('agentAccount')}
          control={
            <Field label={t('reports.touristTax.yearEnd.account.by.label')} className="w-full sm:w-56">
              <Select value={by} onChange={(event) => onByChange(event.target.value as YearEndAccountCut)} data-testid="year-end-agent-account-by">
                {YEAR_END_ACCOUNT_CUTS.map((cut) => (
                  <option key={cut} value={cut}>
                    {t(`reports.touristTax.yearEnd.account.by.${cut}`)}
                  </option>
                ))}
              </Select>
            </Field>
          }
          onDownload={(format) => void start({ kind: 'agentAccount', year, by, format })}
        />

        <FileRow
          id="ticino"
          title={ticinoTitle}
          description={t('reports.touristTax.yearEnd.ticino.description', { deadlineYear: year + 1 })}
          disabled={working}
          pending={pendingFormat('ticino')}
          failure={failureOf('ticino')}
          onDownload={(format) => void start({ kind: 'ticino', year, format })}
        >
          <p className="break-words text-sm" data-testid="year-end-ticino-canton">
            {t('reports.touristTax.yearEnd.ticino.cantonUnknown')}{' '}
            <Link to={PROPERTIES_PATH} className="font-medium text-primary underline underline-offset-4">
              {t('reports.touristTax.yearEnd.ticino.openProperties')}
            </Link>
          </p>
        </FileRow>
      </ul>
    </PlainSection>
  );
}
