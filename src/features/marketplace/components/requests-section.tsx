import { useTranslation } from 'react-i18next';
import { Loader2, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ServiceRequestTimeline } from '@/features/service-requests/components/service-request-timeline';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { useServiceRequests } from '@/queries/use-service-requests';

/** The requests of one supplier only (MKT: «Vedi le richieste» of a supplier of «Le mie app»), and the way back to all of them. */
export interface RequestsOfSupplier {
  orgId: string;
  name: string;
  onShowAll: () => void;
}

/** «Le tue richieste»: the requests the host sent for the property, with what happened to each (SU-09). */
export function RequestsSection({ propertyId, onlySupplier }: { propertyId: string; onlySupplier?: RequestsOfSupplier }) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const {
    data: requests,
    isLoading: requestsLoading,
    isError: requestsError,
    error: requestsLoadError,
    refetch: refetchRequests,
  } = useServiceRequests({ propertyId });
  const items = (requests?.items ?? []).filter((request) => !onlySupplier || request.supplierOrgId === onlySupplier.orgId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          {t('marketplace.requestsTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {onlySupplier ? (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="marketplace-requests-of-supplier">
            <p className="min-w-0 break-words text-sm font-medium">{t('marketplace.mine.onlySupplier', { name: onlySupplier.name })}</p>
            <Button type="button" size="sm" variant="ghost" className="min-h-11 px-2" onClick={onlySupplier.onShowAll}>
              {t('marketplace.mine.showAll')}
            </Button>
          </div>
        ) : null}
        {requestsLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {requestsError && (
          <div className="space-y-2 py-4" role="alert" data-testid="marketplace-requests-error">
            <p className="text-sm text-destructive">
              {getProblemMessage(requestsLoadError, t) ?? t('serviceRequest.listLoadError')}
            </p>
            <Button size="sm" variant="outline" onClick={() => void refetchRequests()}>
              {t('serviceRequest.retry')}
            </Button>
          </div>
        )}
        {!requestsLoading && !requestsError && items.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <p className="text-muted-foreground">{t('marketplace.noRequests')}</p>
            <p className="text-sm text-muted-foreground">{t('marketplace.noRequestsHint')}</p>
          </div>
        )}
        {!requestsLoading && !requestsError && items.length > 0 && (
          <div data-testid="marketplace-requests-list">
            <ServiceRequestTimeline
              requests={items}
              showStay
              showProperty
              canManage={hasPermission('short-rent', 'property.write')}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
