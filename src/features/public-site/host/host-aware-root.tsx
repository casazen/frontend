import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { isDefaultAppHost, resolveHostSite, setHostSite, type HostResolution } from '@/lib/host-site';
import { HostSiteBootstrapPage } from './host-site-pages';

/**
 * Start-up of the app (BK-16, A3-08): the app's own hosts start at once, on the first render, as before; an org's own host (a
 * subdomain or a custom domain) first asks the backend which org it serves, because the router of such a host only knows
 * that org's booking site. A host nobody serves, or a check that failed (with a retry), shows a page of its own: never the
 * app, never a login.
 */
export function HostAwareRoot({ children }: { children: ReactNode }) {
  const [ownHost] = useState<HostResolution | null>(() =>
    isDefaultAppHost(window.location.hostname) ? { kind: 'app' } : null,
  );
  const [resolved, setResolved] = useState<HostResolution | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (ownHost) return;
    let cancelled = false;
    void resolveHostSite().then((result) => {
      if (cancelled) return;
      // Before the answer is shown: the router is created by the first render of the app and reads it.
      if (result.kind === 'site') setHostSite(result.site);
      setResolved(result);
    });
    return () => {
      cancelled = true;
    };
  }, [ownHost, attempt]);

  const retry = useCallback(() => {
    setResolved(null);
    setAttempt((value) => value + 1);
  }, []);

  const resolution = ownHost ?? resolved;
  if (!resolution) return <HostSiteBootstrapPage state="loading" />;
  if (resolution.kind === 'not-found' || resolution.kind === 'error') {
    return <HostSiteBootstrapPage state={resolution.kind} onRetry={retry} />;
  }
  return <>{children}</>;
}
