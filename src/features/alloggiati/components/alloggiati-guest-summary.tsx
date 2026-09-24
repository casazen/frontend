import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyTextToClipboard } from '@/lib/utils';
import { getDocumentTypeLabel, getGenderLabel } from '@/lib/i18n-labels';
import { useAlloggiatiGuestSummary } from '@/queries/use-alloggiati';
import type { AlloggiatiGuestRowDto, AlloggiatiRecordField } from '@/types/alloggiati.types';
import { formatRecordDate } from '../alloggiati-status.utils';

/**
 * Fields in the order of the Alloggiati Web record (`.claude/context/regulations/alloggiati.md`, "Tracciato
 * record"): kind, arrival date, days of stay, surname, name, sex, date of birth, place of birth, citizenship,
 * document type, document number, place of issue.
 */
const RECORD_FIELDS: AlloggiatiRecordField[] = [
  'kind',
  'arrivalDate',
  'stayDays',
  'lastName',
  'firstName',
  'gender',
  'dateOfBirth',
  'placeOfBirth',
  'citizenship',
  'documentType',
  'documentNumber',
  'documentIssuePlace',
];

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** Text to copy on the portal: the value stored in CasaZen, never a table code. Empty when missing. */
function fieldValue(guest: AlloggiatiGuestRowDto, field: AlloggiatiRecordField, t: TranslateFn): string {
  switch (field) {
    case 'kind':
      return t(`alloggiati.guestKind.${guest.kind}`);
    case 'arrivalDate':
      return formatRecordDate(guest.arrivalDate);
    case 'stayDays':
      return String(guest.stayDays);
    case 'gender':
      return guest.gender === 'Male' || guest.gender === 'Female' ? getGenderLabel(guest.gender, t) : '';
    case 'dateOfBirth':
      return guest.dateOfBirth ? formatRecordDate(guest.dateOfBirth) : '';
    case 'documentType':
      return guest.documentType ? getDocumentTypeLabel(guest.documentType, t) : '';
    default:
      return guest[field].trim();
  }
}

interface AlloggiatiGuestSummaryProps {
  bookingId: string;
}

/** Per-guest data the host copies on the Questura portal (CO-11, decision D6). */
export function AlloggiatiGuestSummary({ bookingId }: AlloggiatiGuestSummaryProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useAlloggiatiGuestSummary(bookingId);

  async function copy(text: string) {
    try {
      await copyTextToClipboard(text);
      toast.success(t('alloggiati.guestSummary.copied'));
    } catch {
      toast.error(t('alloggiati.guestSummary.copyFailed'));
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="alloggiati-guest-summary-loading">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('alloggiati.guestSummary.loading')}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-2" data-testid="alloggiati-guest-summary-error">
        <p className="text-sm text-destructive">{t('alloggiati.guestSummary.error')}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {t('alloggiati.guestSummary.retry')}
        </Button>
      </div>
    );
  }

  const unregistered = Math.max(0, data.declaredGuests - data.guests.length);

  return (
    <div className="space-y-4" data-testid="alloggiati-guest-summary">
      <div>
        <h3 className="text-sm font-semibold">{t('alloggiati.guestSummary.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('alloggiati.guestSummary.description')}</p>
      </div>

      {data.stayExceedsMaxDays && (
        <p className="flex items-start gap-2 text-sm text-orange-600" data-testid="alloggiati-stay-exceeds-max">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {t('alloggiati.guestSummary.stayExceedsMaxDays', { days: data.stayDays })}
        </p>
      )}
      {unregistered > 0 && (
        <p className="flex items-start gap-2 text-sm text-orange-600" data-testid="alloggiati-unregistered-guests">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {t('alloggiati.guestSummary.unregisteredGuests', { count: unregistered })}
        </p>
      )}
      {data.guests.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('alloggiati.guestSummary.empty')}</p>
      )}

      {data.guests.map((guest, index) => {
        const rows = RECORD_FIELDS.map((field) => ({
          field,
          label: t(`alloggiati.recordField.${field}`),
          value: fieldValue(guest, field, t),
          missing: guest.missingFields.includes(field),
        }));
        const allText = rows.map((row) => `${row.label}: ${row.value}`).join('\n');

        return (
          <div key={guest.guestId} className="rounded-md border" data-testid={`alloggiati-guest-${index}`}>
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <span className="text-sm font-medium">
                {t('alloggiati.guestSummary.guestHeading', { index: index + 1 })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(allText)}
                data-testid={`alloggiati-guest-${index}-copy-all`}
              >
                <Copy className="mr-2 h-3.5 w-3.5" />
                {t('alloggiati.guestSummary.copyAll')}
              </Button>
            </div>
            <dl className="divide-y text-sm">
              {rows.map((row) => (
                <div
                  key={row.field}
                  className="flex items-center justify-between gap-3 px-3 py-1.5"
                  data-testid={`alloggiati-field-${row.field}`}
                >
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="flex items-center gap-2 text-right">
                    {row.missing || !row.value ? (
                      <span className="text-destructive">{t('alloggiati.guestSummary.missing')}</span>
                    ) : (
                      <>
                        <span className="font-medium break-all">{row.value}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copy(row.value)}
                          aria-label={t('alloggiati.guestSummary.copyField', { field: row.label })}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
