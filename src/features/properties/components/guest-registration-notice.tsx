import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface RefreshFailedNoticeProps {
  /** Reads again. */
  onRetry: () => void;
  /** The read is on its way again. */
  retrying?: boolean;
  testId: string;
}

/**
 * A read that did not work while what it read is on screen (a refresh: the network, a 5xx): what is shown may not be up to date, and what the host was typing stays where it is. It is
 * a line above the card, not the card replaced by an error: a 404, a 403 or a country with no rules are what the server says about the property and do replace it, a failed refresh does not.
 */
export function RefreshFailedNotice({ onRetry, retrying = false, testId }: RefreshFailedNoticeProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2" role="alert" data-testid={testId}>
      <p className="text-sm text-foreground/70">{t('guestRegistration.card.refreshFailed')}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} loading={retrying}>
        {t('guestRegistration.card.retry')}
      </Button>
    </div>
  );
}
