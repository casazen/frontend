import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DomainApi } from '@/api/domain.api';

const DEFAULT_HOST_SUFFIXES = ['casazen.app', 'casazen.it', 'localhost', 'vercel.app'];

function isDefaultAppHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return DEFAULT_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/**
 * Client-side fallback when Vercel Edge middleware is unavailable (#298 AC7).
 * Rewrites custom/subdomain hosts to /book/{slug} using resolve-host.
 */
export function useCustomHostRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const hostname = window.location.hostname;
    if (isDefaultAppHost(hostname)) return;

    let cancelled = false;

    void (async () => {
      try {
        const resolved = await DomainApi.resolveHost(hostname);
        if (cancelled || !resolved?.slug) return;

        const targetPath = `/book/${resolved.slug}${window.location.pathname === '/' ? '' : window.location.pathname}`;
        if (window.location.pathname.startsWith(`/book/${resolved.slug}`)) return;

        navigate(`${targetPath}${window.location.search}${window.location.hash}`, { replace: true });
      } catch {
        // Unknown host — PublicSiteShell / 404 handling applies.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);
}
