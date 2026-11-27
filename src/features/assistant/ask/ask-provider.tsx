import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { matchPath, useLocation } from 'react-router-dom';
import { getManifestEntry, type AppContextKey } from '@/config/route-manifest';
import { isDemoMode } from '@/config/demo.config';
import { useWorkspace } from '@/hooks/use-workspace';
import { arrivalsCapability } from './arrivals-capability';
import { AskContext, type AskIntent } from './ask-context';

const AskPanel = lazy(() => import('./ask-panel'));

interface Props {
  area: AppContextKey;
  userId: string | null;
  orgId: string | null;
  orgName: string | null;
  children: ReactNode;
}

export function AskProvider({ area, userId, orgId, orgName, children }: Props) {
  const { contexts, hasPermission, isReady } = useWorkspace();
  const location = useLocation();
  const areaContext = contexts.find((entry) => entry.contextKey === area);
  const canReadArrivals = Boolean(
    userId &&
      orgId &&
      isReady &&
      areaContext &&
      area === arrivalsCapability.area &&
      hasPermission(area, arrivalsCapability.permission),
  );
  const propertyId = new URLSearchParams(location.search).get('propertyId') || null;
  const bookingId = getManifestEntry(location.pathname)
    ? null
    : (matchPath('/app/short-rent/bookings/:id', location.pathname)?.params.id ?? null);
  const canPrepareDraft = Boolean(!isDemoMode && canReadArrivals && bookingId && hasPermission(area, 'booking.write'));
  const scope = JSON.stringify([
    isDemoMode,
    userId,
    orgId,
    area,
    areaContext?.roleKey,
    areaContext?.permissions,
    canReadArrivals,
    canPrepareDraft,
    bookingId,
    propertyId,
    location.key,
  ]);
  const [session, setSession] = useState<{ scope: string; intent: AskIntent; opener: HTMLElement } | null>(null);
  if (session && session.scope !== scope) setSession(null);

  return (
    <AskContext.Provider
      value={{ canReadArrivals, canPrepareDraft, open: (intent, opener) => setSession({ scope, intent, opener }) }}
    >
      {children}
      {session?.scope === scope && (
        <Suspense
          fallback={
            <div className="fixed right-4 top-[var(--header-height)] z-50 rounded-md border bg-card p-3 shadow-sm">
              <Spinner size="sm" />
            </div>
          }
        >
          <AskPanel
            area={area}
            orgName={orgName}
            propertyId={propertyId}
            scope={scope}
            canReadArrivals={canReadArrivals}
            bookingId={canPrepareDraft ? bookingId : null}
            initialIntent={session.intent}
            opener={session.opener}
            onClose={() => setSession(null)}
          />
        </Suspense>
      )}
    </AskContext.Provider>
  );
}
