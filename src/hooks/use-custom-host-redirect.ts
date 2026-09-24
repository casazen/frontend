import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DomainApi } from '@/api/domain.api';
import { getPublicSiteHost } from '@/config/public-site';

/** Hosts of the app itself that are never an org site: local development and the Vercel deployments. */
const APP_HOST_SUFFIXES = ['localhost', 'vercel.app'];
const LOCAL_ADDRESSES = new Set(['127.0.0.1', '[::1]']);

/**
 * The web app's own host: the public domain (`VITE_PUBLIC_SITE_URL`, no domain written in code, D3), local development
 * or a Vercel deployment. Any other host may be an org's custom domain or subdomain and is resolved.
 */
export function isDefaultAppHost(hostname: string, publicSiteHost: string | null = getPublicSiteHost()): boolean {
  const host = hostname.toLowerCase();
  if (publicSiteHost && host === publicSiteHost) return true;
  if (LOCAL_ADDRESSES.has(host)) return true;
  return APP_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
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
