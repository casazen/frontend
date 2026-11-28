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
  context?: ServiceRequestContextKey;
  showStay?: boolean;
  showProperty?: boolean;
  /** The caller may pay and re-request (`property.write` of the context): the buttons are hidden otherwise. */
  canManage?: boolean;
  compact?: boolean;
}

const LIST = 'divide-y divide-border border-y border-border';
const COMPACT_LIST = 'divide-y divide-border';

const QUIET = '-ms-3';

export function ServiceRequestTimeline({
  requests,
  context = 'short-rent',
  showStay = false,
  showProperty = false,
  canManage = true,
  compact = false,
}: ServiceRequestTimelineProps) {
  const { t } = useTranslation();
  const drawer = useDetailDrawer();
  const { toFollow, closed } = useMemo(() => groupRequests(requests), [requests]);
  const [showClosed, setShowClosed] = useState(false);
  const [closedShown, setClosedShown] = useState(CLOSED_FIRST);

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
      compact={compact}
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
        <ul role="list" className={compact ? COMPACT_LIST : LIST} data-testid="service-requests-to-follow">
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
              <ul role="list" className={compact ? COMPACT_LIST : LIST} data-testid="service-requests-closed">
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
