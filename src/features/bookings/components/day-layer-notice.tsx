import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

/** The days could not be read: the calendar goes on without prices and rules, and says so, with a way to try again. Never shown for a caller who may not read them. */
export function DayLayerNotice({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <p role="status" className="flex flex-wrap items-center gap-x-2 text-sm text-foreground/80" data-testid="calendar-days-error">
      {t('booking.calendar.day.loadError')}
      <Button type="button" variant="link" className="h-auto min-h-11 p-0" onClick={onRetry} data-testid="calendar-days-retry">
        {t('booking.calendar.day.retry')}
      </Button>
    </p>
  );
}
