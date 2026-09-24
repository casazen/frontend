import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/utils';
import { useMarkLongRentServiceRequestPaid, useMarkServiceRequestPaid } from '@/queries/use-service-requests';
import type { ServiceRequest, ServiceRequestContextKey } from '@/types/service-request';
import { getServiceCategoryLabel, getServiceRequestStatusLabel } from '@/lib/i18n-labels';

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
  /** Workspace the list is shown in: decides which API marks a request paid (D2). */
  context?: ServiceRequestContextKey;
  /** Property overview in short-rent: each request links to its stay (older ones without a stay say so). */
  showStay?: boolean;
}

export function ServiceRequestTimeline({ requests, context = 'short-rent', showStay = false }: ServiceRequestTimelineProps) {
  const { t } = useTranslation();
  const markStayPaid = useMarkServiceRequestPaid();
  const markLongRentPaid = useMarkLongRentServiceRequestPaid();
  const markPaid = context === 'long-rent' ? markLongRentPaid : markStayPaid;

  return (
    <div className="space-y-4" data-testid="service-request-timeline">
      {requests.map((sr) => (
        <div
          key={sr.id}
          className="flex flex-col gap-2 border-b pb-4 last:border-0 last:pb-0"
          data-testid={`service-request-${sr.id}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[sr.status] ?? 'secondary'}>
              {getServiceRequestStatusLabel(sr.status, t)}
            </Badge>
            <span className="text-sm font-medium">{getServiceCategoryLabel(sr.category, t)}</span>
            {sr.supplierName && (
              <span className="text-sm text-muted-foreground">— {sr.supplierName}</span>
            )}
          </div>
          {sr.notes && <p className="text-sm text-muted-foreground">{sr.notes}</p>}
          <div className="text-xs text-muted-foreground">
            {t('serviceRequest.createdAt', { date: formatDate(sr.createdAt, 'PPp') })}
            {sr.completedAt && ` · ${t('serviceRequest.completedAt', { date: formatDate(sr.completedAt, 'PPp') })}`}
          </div>
          {showStay &&
            (sr.bookingId ? (
              <Link
                to={`/app/short-rent/bookings/${sr.bookingId}`}
                className="text-xs text-primary hover:underline"
                data-testid={`service-request-stay-${sr.id}`}
              >
                {t('serviceRequest.viewStay')} &#8594;
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground" data-testid={`service-request-no-stay-${sr.id}`}>
                {t('serviceRequest.noStayLegacy')}
              </span>
            ))}
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
    </div>
  );
}
