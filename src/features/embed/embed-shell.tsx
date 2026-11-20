import { useCallback, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { Outlet, useMatches, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { FEATURE_FLAGS_QUERY_KEY } from '@/contexts/feature-flags-context';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { usePublicOrg } from '@/queries/use-public-org';
import { SiteAppearanceProvider } from '@/features/public-site/site-appearance';
import type { SiteAppearance } from '@/features/public-site/site-appearance-context';
import { getHostSite } from '@/lib/host-site';
import { publicSiteColorVars } from '@/lib/public-site-colors';
import { normalizeHexColor, resolvePublicSiteFont, resolvePublicSiteTheme } from '@/lib/public-site-themes';
import { useSeoMeta } from '@/lib/seo-meta';
import {
  EMBED_PARENT_QUERY_KEY,
  EMBED_VERSION_QUERY_KEY,
  EmbedContext,
  embedBaseOf,
  embedWidgetOf,
  isSupportedEmbedVersion,
  parseParentOrigin,
  type EmbedContextValue,
  type EmbedHostMode,
} from '@/features/embed/embed-context';
import { EmbedError, EmbedNotFound, EmbedSkeleton, EmbedUnavailable } from '@/features/embed/embed-states';
import { EmbedBridgeContext, useEmbedBridgeController, type EmbedErrorCode } from '@/features/embed/use-embed-bridge';
import { useEmbedLanguage } from '@/features/embed/use-embed-language';
import '@/styles/public-tokens.css';
import '@/styles/public-brand.css';

interface EmbedShellProps {
  /** Where the routes are served (see `EmbedHostMode`). */
  mode: EmbedHostMode;
}

/** What the page of the widget is showing: its content, or the state that takes the place of it. */
type EmbedState = 'loading' | 'ready' | 'unavailable' | 'not-found' | 'error';

/** Whether the widgets are on for this site: asked before any data call. */
type EmbedGate = 'loading' | 'error' | 'off' | 'on';

/**
 * The plan gate of the embed. On an agency's own domain it is `embedEnabled` of `resolve-host` (the flag and the plan of the agency, already
 * known at start-up); on the CasaZen domain only the global flag `siteEmbed` is there to ask (the plan of an org is not exposed there).
 * A flag that could not be read is not «off»: nothing is known, and the page says so with a retry.
 */
function useEmbedGate(mode: EmbedHostMode): { gate: EmbedGate; retry: () => void } {
  const { flags, isLoading, isError } = useFeatureFlags();
  const queryClient = useQueryClient();
  const retry = useCallback(() => void queryClient.refetchQueries({ queryKey: FEATURE_FLAGS_QUERY_KEY }), [queryClient]);

  if (mode === 'host') return { gate: getHostSite()?.embedEnabled === true ? 'on' : 'off', retry };
  if (isLoading) return { gate: 'loading', retry };
  if (isError) return { gate: 'error', retry };
  return { gate: flags.siteEmbed ? 'on' : 'off', retry };
}

/**
 * The page of a widget has no chrome of its own and sits in a frame of another site: the page is transparent (that site shows
 * through), has no margin and never scrolls sideways. Put back when the shell goes.
 */
function useTransparentDocument() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlBackground: html.style.background,
      htmlOverflowX: html.style.overflowX,
      bodyBackground: body.style.background,
      bodyMargin: body.style.margin,
    };
    html.style.background = 'transparent';
    html.style.overflowX = 'hidden';
    body.style.background = 'transparent';
    body.style.margin = '0';
    return () => {
      html.style.background = previous.htmlBackground;
      html.style.overflowX = previous.htmlOverflowX;
      body.style.background = previous.bodyBackground;
      body.style.margin = previous.bodyMargin;
    };
  }, []);
}

/**
 * The frame every embeddable page lives in (NF-144, NF-145): no header, footer, cookie banner or skip link, the theme of the org's site, the
 * language of the address, and nothing written to the browser. It is the layout route of the three widgets and gives them `{ org }` through the
 * outlet, as `PublicSiteShell` does for the pages of the booking site, and the bridge to the page that frames it (`useEmbedBridge`). It stays
 * mounted while the guest moves from one widget to another inside the frame. The frame is as tall as its content: nothing here uses `100vh`, and
 * the height it reports is the one of its own wrapper.
 */
export function EmbedShell({ mode }: EmbedShellProps) {
  const { t } = useTranslation();
  const params = useParams<{ orgSlug: string }>();
  const [searchParams] = useSearchParams();
  const matchedWidget = embedWidgetOf(useMatches());
  // A route of the frame names its widget; the one that does not is the catch-all of `/embed` (`EMBED_CATCH_ALL_PATH`: an address that is no widget): the
  // shell has nothing to show there, says so (no link, no request) and tells the page `not_found`. `widget` is then only a placeholder for the context.
  const widget = matchedWidget ?? 'booking';
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hostSite = mode === 'host' ? getHostSite() : null;
  // On the agency's domain the org is the one of the host, whatever the address says; on the CasaZen domain it is the slug of the address.
  const orgSlug = mode === 'host' ? (hostSite?.slug ?? '') : (params.orgSlug ?? '');
  const embedBase = embedBaseOf(mode, orgSlug);
  const versionSupported = isSupportedEmbedVersion(searchParams.get(EMBED_VERSION_QUERY_KEY));
  const parentOrigin = parseParentOrigin(searchParams.get(EMBED_PARENT_QUERY_KEY));
  useTransparentDocument();

  const { gate, retry: retryGate } = useEmbedGate(mode);
  // Nothing asks the server for the org until the widgets are known to be on, for a version this app speaks, on a site that has an org.
  const orgRequested = matchedWidget !== null && versionSupported && gate === 'on' && orgSlug !== '';
  const { data: org, isLoading, isError, error, refetch } = usePublicOrg(orgRequested ? orgSlug : undefined);

  // What the shell shows, and, when it shows no content, why: the page that frames it is told with the same code.
  let state: EmbedState;
  let errorCode: EmbedErrorCode | null = null;
  let retry = retryGate;
  if (matchedWidget === null) {
    state = 'unavailable';
    errorCode = 'not_found';
  } else if (!versionSupported) {
    state = 'unavailable';
    errorCode = 'bad_version';
  } else if (mode === 'host' && !hostSite) {
    state = 'unavailable';
    errorCode = 'disabled';
  } else if (gate === 'loading') {
    state = 'loading';
  } else if (gate === 'error') {
    state = 'error';
    errorCode = 'load_failed';
  } else if (gate === 'off') {
    state = 'unavailable';
    errorCode = 'disabled';
  } else if (isLoading) {
    state = 'loading';
  } else if (isError && !(isAxiosError(error) && error.response?.status === 404)) {
    // Only a 404 means «no such site»: any other failure (500, network) is an error with a retry, not a missing org. It comes before the data
    // of a cache, which TanStack Query keeps on an error: a 404 below is «not found» even when an older answer is still there.
    state = 'error';
    errorCode = 'load_failed';
    retry = () => void refetch();
  } else if (isError || !org) {
    state = 'not-found';
    errorCode = 'not_found';
  } else {
    state = 'ready';
  }

  // The conversation with the page that frames this one: `ready`, `error`, the height, the address, and the look that page asks for (`config`).
  const { bridge, config } = useEmbedBridgeController({ parentOrigin, widget, embedBase, wrapperRef, ready: state === 'ready', errorCode });
  const lang = useEmbedLanguage(config.lang ?? null);

  const themeId = resolvePublicSiteTheme(org?.publicThemeId);
  // The font pair the page asked for, else the one the host chose; null = the one its theme starts with (the theme block of the CSS sets it).
  const fontId = config.font ?? resolvePublicSiteFont(org?.publicFontId);
  // Only a valid hex color reaches CSS; the text color on it and the readable variant of it are derived so that any color meets AA. The one the
  // page asked for wins over the one of the host's site; so does the radius it asked for (cards and buttons).
  const colorVars = publicSiteColorVars(config.primary ?? normalizeHexColor(org?.primaryColor ?? org?.themeColor), themeId);
  const radiusVars = config.radius ? { '--cz-public-radius': config.radius, '--cz-public-btn-radius': config.radius } : null;
  const themeStyle = colorVars || radiusVars ? ({ ...colorVars, ...radiusVars } as CSSProperties) : undefined;

  // What a portal needs to wear the look of the site: the pickers and sheets read it (`usePortalRootProps`).
  const themeVarsKey = themeStyle ? JSON.stringify(themeStyle) : '';
  const appearance = useMemo<SiteAppearance>(
    () => ({ themeId, fontId, colorStyle: themeVarsKey ? (JSON.parse(themeVarsKey) as CSSProperties) : undefined }),
    [themeId, fontId, themeVarsKey],
  );
  // Also on <html>, for the content rendered in portals (dialogs), which sits outside the themed root.
  useEffect(() => {
    const root = document.documentElement;
    const vars: Record<string, string> = themeVarsKey ? JSON.parse(themeVarsKey) : {};
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
    };
  }, [themeVarsKey]);

  // Not indexed in any state (the `X-Robots-Tag` header of `vercel.json` says the same).
  let title: string;
  if (state === 'ready') title = t('embed.title', { name: org?.displayName ?? '' });
  else if (state === 'loading') title = t('embed.loading');
  else if (state === 'not-found') title = t('embed.notFound.title');
  else if (state === 'error') title = t('embed.error.title');
  else title = t('embed.unavailable.title');
  useSeoMeta({ title, noindex: true });

  const embed = useMemo<EmbedContextValue>(
    () => ({ widget, orgSlug, embedBase, parentOrigin, lang, hostMode: mode }),
    [widget, orgSlug, embedBase, mode, parentOrigin, lang],
  );

  let content: ReactNode;
  if (state === 'loading') content = <EmbedSkeleton />;
  else if (state === 'unavailable') content = <EmbedUnavailable />;
  else if (state === 'not-found') content = <EmbedNotFound />;
  else if (state === 'error') content = <EmbedError onRetry={retry} />;
  else content = <Outlet context={{ org }} />;

  return (
    <SiteAppearanceProvider value={appearance}>
      <EmbedContext.Provider value={embed}>
        <EmbedBridgeContext.Provider value={bridge}>
          {/* No min-h-screen, no 100vh: the height of the frame is the height of this element. Transparent, so the page that frames it shows through. */}
          <div
            ref={wrapperRef}
            className="public-site-root flow-root overflow-x-clip"
            data-testid="embed-shell"
            data-widget={widget}
            data-state={state}
            data-theme={themeId}
            data-font={fontId ?? undefined}
            style={{ ...themeStyle, background: 'transparent' }}
          >
            <main data-testid="embed-main">{content}</main>
          </div>
        </EmbedBridgeContext.Provider>
      </EmbedContext.Provider>
    </SiteAppearanceProvider>
  );
}
