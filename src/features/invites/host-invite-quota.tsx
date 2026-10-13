import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { getProblemMessage } from '@/lib/api-errors';
import { useHostInviteQuota } from '@/queries/use-host-invites';

/** Daily quota of invites of the host: used out of the limit, what is left and when it starts again. */
export function HostInviteQuotaIndicator() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useHostInviteQuota();

  if (isLoading) return <Skeleton className="h-16 w-full" data-testid="host-invite-quota-loading" />;

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6" role="alert" data-testid="host-invite-quota-error">
          <p className="flex-1 text-sm text-destructive">{getProblemMessage(error, t) ?? t('hostInvites.quota.loadError')}</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            {t('hostInvites.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const exhausted = data.remaining <= 0;
  const percent = data.limit > 0 ? Math.min(100, Math.round((data.used / data.limit) * 100)) : 100;
  const resets = formatRomeDateTime(data.resetsAt, i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card data-testid="host-invite-quota">
      <CardContent className="space-y-2 pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{t('hostInvites.quota.usage', { used: data.used, limit: data.limit })}</p>
          <p className="text-sm text-muted-foreground" data-testid="host-invite-quota-remaining">
            {t('hostInvites.quota.remaining', { count: Math.max(0, data.remaining) })}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label={t('hostInvites.quota.label')}
          aria-valuemin={0}
          aria-valuemax={data.limit}
          aria-valuenow={data.used}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div className={`h-full ${exhausted ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${percent}%` }} />
        </div>
        {exhausted && (
          <p role="status" className="text-sm text-destructive" data-testid="host-invite-quota-exhausted">
            {t('hostInvites.quota.exhausted', { date: resets })}
          </p>
        )}
        {!exhausted && <p className="text-xs text-muted-foreground">{t('hostInvites.quota.resets', { date: resets })}</p>}
      </CardContent>
    </Card>
  );
}
