import { useMemo, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ServiceRequest, ServiceRequestContextKey } from '@/types/service-request';
import { INTERVENTION_DRAWER_KIND } from '../interventions/paths';
import { CLOSED_FIRST, CLOSED_STEP, groupRequests } from '../lib/request-list';
import { ServiceRequestRow } from './service-request-row';

interface ServiceRequestTimelineProps {
  requests: ServiceRequest[];
  /** Workspace the list is shown in: decides which API marks a request paid and which context a new request is for (D2). */
  context?: ServiceRequestContextKey;
  /** Property overview in short-rent: each request links to its stay (older ones without a stay say so). */
  showStay?: boolean;
  /** Lists that span several properties name the property of each request. */
  showProperty?: boolean;
  /** The caller may pay and re-request (`property.write` of the context): the buttons are hidden otherwise. */
  canManage?: boolean;
}

const LIST = 'divide-y divide-border border-y border-border';

// A quiet action under a list: its text starts where the rows' do, and the hover box goes out to the left.
const QUIET = '-ms-3';

/**
 * The supplier requests of a stay, a property or the whole org (SU-09, A4-28), as the lists of the other areas do it (Guesty, Hostaway or the
 * jobs of a lease show the same): the ones still to follow are the list, one line each, the nearest job first; the ones that are over (paid,
 * cancelled, refused and asked again) are kept behind «Mostra le richieste concluse» and come five at a time. A stay that went through
 * many requests no longer buries the one that is open. Each row says what it waits for, or who closed it and when; the whole story of a
 * request is in the drawer its name opens.
 */
export function ServiceRequestTimeline({
  requests,
  context = 'short-rent',
  showStay = false,
  showProperty = false,
  canManage = true,
}: ServiceRequestTimelineProps) {
  const { t } = useTranslation();
  const drawer = useDetailDrawer();
  const { toFollow, closed } = useMemo(() => groupRequests(requests), [requests]);
  const [showClosed, setShowClosed] = useState(false);
  const [closedShown, setClosedShown] = useState(CLOSED_FIRST);

  // The request of a long-term property has a page of its own, and a click that asks for a new tab or window is the browser's.
  const openDetail = (request: ServiceRequest, event: MouseEvent<HTMLAnchorElement>) => {
    if (context === 'long-rent' || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (drawer.open(INTERVENTION_DRAWER_KIND, request.id, { opener: event.currentTarget })) event.preventDefault();
  };

  const row = (request: ServiceRequest) => (
    <ServiceRequestRow
      key={request.id}
      request={request}
      requests={requests}
      context={context}
      showStay={showStay}
      showProperty={showProperty}
      canManage={canManage}
      onOpenDetail={openDetail}
    />
  );

  const toggleClosed = () => {
    setShowClosed((shown) => !shown);
    setClosedShown(CLOSED_FIRST);
  };

  return (
    <div className="space-y-3" data-testid="service-request-timeline">
      {toFollow.length > 0 ? (
        <ul role="list" className={LIST} data-testid="service-requests-to-follow">
          {toFollow.map(row)}
        </ul>
      ) : (
        <p className="text-sm text-foreground/70" data-testid="service-requests-none-to-follow">
          {t('serviceRequest.list.noneToFollow')}
        </p>
      )}

      {closed.length > 0 ? (
        <div className="space-y-2">
          <Button type="button" variant="ghost" size="sm" className={QUIET} aria-expanded={showClosed} onClick={toggleClosed} data-testid="service-requests-closed-toggle">
            <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform motion-reduce:transition-none', showClosed && 'rotate-180')} />
            {showClosed ? t('serviceRequest.list.hideClosed') : t('serviceRequest.list.showClosed', { count: closed.length })}
          </Button>
          {showClosed ? (
            <>
              <ul role="list" className={LIST} data-testid="service-requests-closed">
                {closed.slice(0, closedShown).map(row)}
              </ul>
              {closed.length > closedShown ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={QUIET}
                  onClick={() => setClosedShown((shown) => shown + CLOSED_STEP)}
                  data-testid="service-requests-closed-more"
                >
                  {t('serviceRequest.list.showMore', { count: Math.min(CLOSED_STEP, closed.length - closedShown) })}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
