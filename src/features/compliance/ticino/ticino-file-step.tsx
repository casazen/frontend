import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { TicinoFileFormat, TicinoNotificationDay } from '@/types/swissCompliance.types';
import { groupRowsOf } from './ticino-day-model';
import { closedLineOf, whenText } from './ticino-day-text';

interface TicinoFileStepProps {
  day: TicinoNotificationDay;
  canDownload: boolean;
  busy: boolean;
  onDownload: (format: TicinoFileFormat) => void;
  onGroupSheet: (bookingId: string) => void;
}

export function TicinoFileStep({ day, canDownload, busy, onDownload, onGroupSheet }: TicinoFileStepProps) {
  const { t, i18n } = useTranslation();
  const groups = groupRowsOf(day);
  const closed = closedLineOf(day, t, i18n.language);

  if (day.rows.length === 0) {
    return (
      <p className="text-sm text-foreground/70" data-testid="ticino-file-none">
        {t('swiss.file.none')}
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="ticino-file">
      {closed ? (
        <Alert variant="warning" data-testid="ticino-file-duplicates">
          {closed} {t('swiss.file.duplicates')}
        </Alert>
      ) : null}

      {day.fileGeneratedCount > 0 && day.fileGeneratedAt ? (
        <p className="text-sm text-foreground/70" data-testid="ticino-file-generated">
          {t('swiss.file.generated', { count: day.fileGeneratedCount, when: whenText(day.fileGeneratedAt, i18n.language) })}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy || !canDownload} onClick={() => onDownload('csv')} data-testid="ticino-download-csv">
          <Download aria-hidden="true" className="size-4" />
          {t('swiss.file.download')}
        </Button>
        {day.xmlAvailable ? (
          <Button type="button" variant="link" disabled={busy || !canDownload} onClick={() => onDownload('xml')} data-testid="ticino-download-xml">
            {t('swiss.file.downloadXml')}
          </Button>
        ) : null}
      </div>
      {!canDownload ? (
        <p className="text-sm text-foreground/70" data-testid="ticino-file-needs-guest-read">
          {t('swiss.file.needsGuestRead')}
        </p>
      ) : null}

      {groups.length > 0 ? (
        <div className="space-y-2" data-testid="ticino-group-sheets">
          <p className="text-sm text-foreground/70">{t('swiss.file.groupSheetHint')}</p>
          <ul className="space-y-2">
            {groups.map((group, index) => (
              <li key={`${group.bookingId}-${index}`}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || !canDownload}
                  onClick={() => onGroupSheet(group.bookingId)}
                  className="h-auto min-h-9 whitespace-normal py-2 text-left"
                  data-testid="ticino-group-sheet"
                >
                  <Download aria-hidden="true" className="size-4 shrink-0" />
                  {t('swiss.file.groupSheet', { name: group.guestName })}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
