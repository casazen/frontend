import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/utils';
import { useMarkServiceRequestPaid } from '@/queries/use-service-requests';
import type { ServiceRequest } from '@/types/service-request';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Richiesto: 'secondary',
  PresoInCarico: 'default',
  InCorso: 'default',
  Completato: 'outline',
  Pagato: 'default',
  Rifiutato: 'destructive',
};

interface ServiceRequestTimelineProps {
  requests: ServiceRequest[];
}

export function ServiceRequestTimeline({ requests }: ServiceRequestTimelineProps) {
  const { t } = useTranslation();
  const markPaid = useMarkServiceRequestPaid();

  if (requests.length === 0) return null;

  return (
    <Card data-testid="service-request-timeline">
      <CardHeader>
        <CardTitle>{t('serviceRequest.timelineTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {requests.map((sr) => (
          <div key={sr.id} className="flex flex-col gap-2 border-b pb-4 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_VARIANT[sr.status] ?? 'secondary'}>
                {t(`serviceRequest.status.${sr.status}`, { defaultValue: sr.status })}
              </Badge>
              <span className="text-sm font-medium">{t(`serviceRequest.categories.${sr.category}`, { defaultValue: sr.category })}</span>
              {sr.supplierName && (
                <span className="text-sm text-muted-foreground">— {sr.supplierName}</span>
              )}
            </div>
            {sr.notes && <p className="text-sm text-muted-foreground">{sr.notes}</p>}
            <div className="text-xs text-muted-foreground">
              {t('serviceRequest.createdAt', { date: formatDate(sr.createdAt, 'PPp') })}
              {sr.completedAt && ` · ${t('serviceRequest.completedAt', { date: formatDate(sr.completedAt, 'PPp') })}`}
            </div>
            {sr.status === 'Completato' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => markPaid.mutate(sr.id)}
                disabled={markPaid.isPending}
                data-testid={`mark-paid-${sr.id}`}
              >
                {t('serviceRequest.markPaid')}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
