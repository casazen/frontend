import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getProblemMessage } from '@/lib/api-errors';
import type { ServiceRequestContextKey, ServiceRequestListResponse } from '@/types/service-request';
import { ServiceRequestTimeline } from './service-request-timeline';

interface ServiceRequestsCardProps {
  /** A list query of `useServiceRequests` (stay or property) or `useLongRentServiceRequests` (property). */
  query: {
    data?: ServiceRequestListResponse;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isFetching?: boolean;
    refetch: () => unknown;
  };
  /** Translated text of the empty state. */
  emptyText: string;
  context?: ServiceRequestContextKey;
  /** Header action, e.g. the "request a supplier" dialog trigger. */
  action?: ReactNode;
  showStay?: boolean;
  testId?: string;
}

/**
 * The supplier requests of a stay or of a property (SU-07): loading, a load error with retry (never shown as an empty
 * list), the empty state, then the requests.
 */
export function ServiceRequestsCard({
  query,
  emptyText,
  context = 'short-rent',
  action,
  showStay = false,
  testId = 'service-requests-card',
}: ServiceRequestsCardProps) {
  const { t } = useTranslation();
  const items = query.data?.items ?? [];

  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>{t('serviceRequest.timelineTitle')}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="service-requests-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('serviceRequest.listLoading')}
          </p>
        ) : query.isError ? (
          <div className="space-y-2" role="alert" data-testid="service-requests-error">
            <p className="text-sm text-destructive">
              {getProblemMessage(query.error, t) ?? t('serviceRequest.listLoadError')}
            </p>
            <Button size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
              {t('serviceRequest.retry')}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="service-requests-empty">
            {emptyText}
          </p>
        ) : (
          <ServiceRequestTimeline requests={items} context={context} showStay={showStay} />
        )}
      </CardContent>
    </Card>
  );
}
