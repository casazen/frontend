import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

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
