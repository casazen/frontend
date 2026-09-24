import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Copy, Loader2, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { copyTextToClipboard } from '@/lib/utils';
import { getDocumentTypeLabel, getGenderLabel } from '@/lib/i18n-labels';
import { useAlloggiatiGuestSummary } from '@/queries/use-alloggiati';
import type { AlloggiatiGuestRowDto, AlloggiatiRecordField } from '@/types/alloggiati.types';
import { formatRecordDate } from '../alloggiati-status.utils';
import { StayGuestsEditDialog } from './stay-guests-edit-dialog';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** Record fields whose official code the API reports in `codes` (the others have no table). */
const CODED_FIELDS: Partial<Record<AlloggiatiRecordField, keyof AlloggiatiGuestRowDto['codes']>> = {
  type: 'type',
  birthComune: 'birthComune',
  birthCountry: 'birthCountry',
  citizenship: 'citizenship',
  documentType: 'documentType',
  documentIssuePlace: 'documentIssuePlace',
};

/**
 * Fields of a guest's line, in the order of the Alloggiati Web record (`.claude/context/regulations/alloggiati.md`,
 * "Tracciato record"): comune and province only for those born in Italy, the document only for a single guest or a
 * head of family or group.
 */
function recordFieldsOf(guest: AlloggiatiGuestRowDto): AlloggiatiRecordField[] {
  const birth: AlloggiatiRecordField[] =
    guest.bornInItaly === true ? ['birthComune', 'birthProvince'] : guest.bornInItaly === null ? ['bornInItaly'] : [];
  const document: AlloggiatiRecordField[] = guest.requiresDocument ? ['documentType', 'documentNumber', 'documentIssuePlace'] : [];
  return [
    'type',
    'arrivalDate',
    'stayDays',
    'lastName',
    'firstName',
    'gender',
    'dateOfBirth',
    ...birth,
    'birthCountry',
    'citizenship',
    ...document,
  ];
}

/** Text to copy on the portal: the value stored in CasaZen, never an invented code. Empty when missing. */
function fieldValue(guest: AlloggiatiGuestRowDto, field: AlloggiatiRecordField, t: TranslateFn): string {
  switch (field) {
    case 'type':
      return t(`alloggiati.guestKind.${guest.type}`);
    case 'arrivalDate':
      return formatRecordDate(guest.arrivalDate);
    case 'stayDays':
      return String(guest.stayDays);
    case 'gender':
      return guest.gender === 'Male' || guest.gender === 'Female' ? getGenderLabel(guest.gender, t) : '';
    case 'dateOfBirth':
      return guest.dateOfBirth ? formatRecordDate(guest.dateOfBirth) : '';
    case 'bornInItaly':
      // Migrated from the single-guest model: the old free-text place, still to classify (Italy or abroad).
      return '';
    case 'birthProvince':
      return guest.birthProvince ?? '';
    case 'birthCountry':
      return guest.bornInItaly === true ? t('alloggiati.italy') : guest.birthCountry.trim();
    case 'documentType':
      if (guest.codes.documentTypeDescription) return guest.codes.documentTypeDescription;
      return guest.documentType ? getDocumentTypeLabel(guest.documentType, t) : '';
    default:
      return String(guest[field] ?? '').trim();
  }
}

function GuestStatusBadge({ guest }: { guest: AlloggiatiGuestRowDto }) {
  const { t } = useTranslation();
  if (guest.missingFields.length > 0 || guest.compositionIssue) {
    return (
      <Badge variant="destructive" data-testid={`alloggiati-guest-${guest.position}-status`}>
        {t('alloggiati.guestSummary.guestStatus.missing', { count: Math.max(1, guest.missingFields.length) })}
      </Badge>
    );
  }
  if (guest.codesToComplete.length > 0) {
    return (
      <Badge variant="warning" data-testid={`alloggiati-guest-${guest.position}-status`}>
        {t('alloggiati.guestSummary.guestStatus.codesToComplete')}
      </Badge>
    );
  }
  return (
    <Badge variant="success" data-testid={`alloggiati-guest-${guest.position}-status`}>
      {t('alloggiati.guestSummary.guestStatus.complete')}
    </Badge>
  );
}

interface AlloggiatiGuestSummaryProps {
  bookingId: string;
  /** The host may edit the guests (booking.write). */
  canEdit?: boolean;
}

/**
 * Per-guest data the host copies on the Questura portal (CO-11, decision D6): one card per guest of the stay (CO-12),
 * head of family or group first, with the completeness of each guest and the official codes still to complete.
 */
export function AlloggiatiGuestSummary({ bookingId, canEdit = false }: AlloggiatiGuestSummaryProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useAlloggiatiGuestSummary(bookingId);
  const [editing, setEditing] = useState(false);

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
  const missingTables = data.missingCodeTables.map((table) => t(`alloggiati.codeTable.${table}`)).join(', ');

  return (
    <div className="space-y-4" data-testid="alloggiati-guest-summary">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{t('alloggiati.guestSummary.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('alloggiati.guestSummary.description')}</p>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="alloggiati-edit-guests">
            <Pencil className="mr-2 h-3.5 w-3.5" />
            {t('alloggiati.editGuests.open')}
          </Button>
        )}
      </div>

      <p
        className={`flex items-start gap-2 text-sm ${data.exportReady ? 'text-green-700' : data.dataComplete ? 'text-orange-700' : 'text-destructive'}`}
        data-testid="alloggiati-readiness"
      >
        {data.exportReady ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        {data.exportReady
          ? t('alloggiati.guestSummary.exportReady')
          : data.dataComplete
            ? t('alloggiati.guestSummary.codesPending')
            : t('alloggiati.guestSummary.dataIncomplete')}
      </p>
      {data.missingCodeTables.length > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="alloggiati-missing-code-tables">
          {t('alloggiati.guestSummary.missingCodeTables', { tables: missingTables })}
        </p>
      )}
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

      {data.guests.map((guest) => {
        const rows = recordFieldsOf(guest).map((field) => {
          const codeKey = CODED_FIELDS[field];
          return {
            field,
            label: t(`alloggiati.recordField.${field}`),
            value: fieldValue(guest, field, t),
            missing: guest.missingFields.includes(field),
            code: codeKey ? guest.codes[codeKey] : null,
            codeToComplete: guest.codesToComplete.includes(field),
          };
        });
        const allText = rows.map((row) => `${row.label}: ${row.value}`).join('\n');
        const index = guest.position;

        return (
          <div key={guest.stayGuestId ?? `position-${index}`} className="rounded-md border" data-testid={`alloggiati-guest-${index}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {t('alloggiati.guestSummary.guestHeading', { index: index + 1 })}
                <span className="text-muted-foreground">{t(`alloggiati.guestKind.${guest.type}`)}</span>
                {guest.isMinor && <Badge variant="outline">{t('alloggiati.guestSummary.minor')}</Badge>}
                <GuestStatusBadge guest={guest} />
              </span>
              <Button variant="outline" size="sm" onClick={() => copy(allText)} data-testid={`alloggiati-guest-${index}-copy-all`}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                {t('alloggiati.guestSummary.copyAll')}
              </Button>
            </div>
            {guest.compositionIssue && (
              <p className="border-b px-3 py-1.5 text-sm text-destructive" data-testid={`alloggiati-guest-${index}-composition`}>
                {t(`alloggiati.guestSummary.compositionIssue.${guest.compositionIssue}`)}
              </p>
            )}
            <dl className="divide-y text-sm">
              {rows.map((row) => (
                <div key={row.field} className="flex items-center justify-between gap-3 px-3 py-1.5" data-testid={`alloggiati-field-${row.field}`}>
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="flex flex-wrap items-center justify-end gap-2 text-right">
                    {row.missing || !row.value ? (
                      <>
                        <span className="text-destructive">{t('alloggiati.guestSummary.missing')}</span>
                        {row.field === 'bornInItaly' && guest.birthComune && (
                          <span className="text-xs text-muted-foreground" data-testid="alloggiati-field-bornInItaly-legacy">
                            {t('alloggiati.guestSummary.legacyPlaceOfBirth', { place: guest.birthComune })}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="font-medium break-all">{row.value}</span>
                        {row.code && (
                          <span className="text-xs text-muted-foreground">{t('alloggiati.guestSummary.code', { code: row.code })}</span>
                        )}
                        {row.codeToComplete && (
                          <span className="text-xs text-orange-700" data-testid={`alloggiati-field-${row.field}-code-missing`}>
                            {t('alloggiati.guestSummary.codeToComplete')}
                          </span>
                        )}
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
              {!guest.requiresDocument && (
                <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-muted-foreground" data-testid="alloggiati-field-document-not-required">
                  <dt>{t('alloggiati.recordField.documentType')}</dt>
                  <dd>{t('alloggiati.guestSummary.notRequired')}</dd>
                </div>
              )}
            </dl>
          </div>
        );
      })}

      {canEdit && editing && (
        <StayGuestsEditDialog bookingId={bookingId} summary={data} open={editing} onOpenChange={setEditing} />
      )}
    </div>
  );
}
