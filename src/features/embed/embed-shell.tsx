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
import '@/features/embed/embed.css';

interface EmbedShellProps {
  mode: EmbedHostMode;
}

type EmbedState = 'loading' | 'ready' | 'unavailable' | 'not-found' | 'error';

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

export function EmbedShell({ mode }: EmbedShellProps) {
  const { t } = useTranslation();
  const params = useParams<{ orgSlug: string }>();
  const [searchParams] = useSearchParams();
  const matchedWidget = embedWidgetOf(useMatches());
  const widget = matchedWidget ?? 'booking';
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hostSite = mode === 'host' ? getHostSite() : null;
  const orgSlug = mode === 'host' ? (hostSite?.slug ?? '') : (params.orgSlug ?? '');
  const embedBase = embedBaseOf(mode, orgSlug);
  const versionSupported = isSupportedEmbedVersion(searchParams.get(EMBED_VERSION_QUERY_KEY));
  const parentOrigin = parseParentOrigin(searchParams.get(EMBED_PARENT_QUERY_KEY));
  useTransparentDocument();

  const { gate, retry: retryGate } = useEmbedGate(mode);
  const orgRequested = matchedWidget !== null && versionSupported && gate === 'on' && orgSlug !== '';
  const { data: org, isLoading, isError, error, refetch } = usePublicOrg(orgRequested ? orgSlug : undefined);

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

  const { bridge, config } = useEmbedBridgeController({ parentOrigin, widget, embedBase, wrapperRef, ready: state === 'ready', errorCode });
  const lang = useEmbedLanguage(config.lang ?? null);

  const themeId = resolvePublicSiteTheme(org?.publicThemeId);
  const fontId = config.font ?? resolvePublicSiteFont(org?.publicFontId);
  // Only a valid hex color reaches CSS; the text color on it and the readable variant of it are derived so that any color meets AA. The one the
  // page asked for wins over the one of the host's site; so does the radius it asked for (cards and buttons).
  const colorVars = publicSiteColorVars(config.primary ?? normalizeHexColor(org?.primaryColor ?? org?.themeColor), themeId);
  const radiusVars = config.radius ? { '--cz-public-radius': config.radius, '--cz-public-btn-radius': config.radius } : null;
  const themeStyle = colorVars || radiusVars ? ({ ...colorVars, ...radiusVars } as CSSProperties) : undefined;

  const themeVarsKey = themeStyle ? JSON.stringify(themeStyle) : '';
  const appearance = useMemo<SiteAppearance>(
    () => ({ themeId, fontId, colorStyle: themeVarsKey ? (JSON.parse(themeVarsKey) as CSSProperties) : undefined }),
    [themeId, fontId, themeVarsKey],
  );
  useEffect(() => {
    const root = document.documentElement;
    const vars: Record<string, string> = themeVarsKey ? JSON.parse(themeVarsKey) : {};
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
    };
  }, [themeVarsKey]);

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
          <div
            ref={wrapperRef}
            className="embed-frame public-site-root flow-root overflow-x-clip"
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
