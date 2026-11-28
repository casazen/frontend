import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonCard } from '@/components/ui/skeleton';
import {
  MARKETPLACE_MINE_PATH,
  marketplaceActivationPath,
  marketplaceHref,
} from '@/features/marketplace/lib/marketplace-paths';
import { withReturnTo } from '@/features/marketplace/lib/return-to';
import { translateErrorCode } from '@/lib/api-errors';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { useMarketplaceCatalog } from '@/queries/use-marketplace';
import { SHORT_PROPERTIES_OVERVIEW, useProperties } from '@/queries/use-properties';
import type { Property } from '@/types/property.types';
import { PropertyThumb } from './components/property-thumb';
import { PropertyActivationServices } from './property-activation-services';
import { PropertyImportReview } from './property-import-review';
import { propertyPath, propertyTabPath, propertyWizardPath } from './properties-paths';

interface PropertyJourneyProps {
  property: Property;
  canEditProperty: boolean;
  canReadCatalog: boolean;
  canConnectChannels: boolean;
}

function PropertyJourney({ property, canEditProperty, canReadCatalog, canConnectChannels }: PropertyJourneyProps) {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const catalog = useMarketplaceCatalog(property.id, { enabled: canReadCatalog });
  const channels = catalog.data?.groups.find((group) => group.id === 'salesChannels')?.entries ?? [];
  const [portalSearch, setPortalSearch] = useState('');
  const channelQuery = portalSearch.trim().toLocaleLowerCase();
  const matchingChannels = channels.filter((channel) => channel.name.toLocaleLowerCase().includes(channelQuery));
  const status = property.siteVisibility === 'Published'
    ? 'published'
    : property.lifecycleStatus === 'NeedsAttention' ? 'needsAttention' : 'readyForReview';

  return (
    <section aria-label={property.name} className="min-w-0 space-y-5 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-4 rounded-xl bg-muted/50 p-3">
        <PropertyThumb photoUrls={property.photoUrls} className="size-16 rounded-lg" />
        <div>
        <h2 className="break-words text-xl font-semibold">{property.name}</h2>
        <p className="text-sm text-muted-foreground">{property.city}</p>
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h3 className="font-semibold">{t('activationJourney.reviewTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t(`activationJourney.${status}`)}</p>
        <PropertyImportReview propertyId={property.id} canEdit={canEditProperty} />
        <Button asChild variant="outline" className="min-h-11">
          <Link to={canEditProperty && status !== 'published' ? propertyWizardPath(property.id) : propertyPath(property.id)}>
            {t(canEditProperty && status !== 'published' ? 'activationJourney.review' : 'activationJourney.openProperty')}
          </Link>
        </Button>
      </div>

      {canReadCatalog && (
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-semibold">{t('activationJourney.channels')}</h3>
          {channels.length > 0 && (
            <Input type="search" value={portalSearch} onChange={(event) => setPortalSearch(event.target.value)}
              aria-label={t('activationJourney.searchChannels')} placeholder={t('activationJourney.searchChannels')} className="min-h-11" />
          )}
          {catalog.isPending ? <SkeletonCard lines={2} /> : catalog.isError ? (
            <ErrorState title={t('activationJourney.channelsError')} error={catalog.error} onRetry={() => void catalog.refetch()} />
          ) : matchingChannels.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('activationJourney.noChannels')}</p>
          ) : (
            <ul className="divide-y">
              {matchingChannels.map((channel) => (
                <li key={channel.code} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{channel.name}</p>
                    <p className="text-sm text-muted-foreground">{t(`activationJourney.channelStatus.${!channel.canActivate && channel.status === 'NotActive' ? 'Unavailable' : channel.status}`)}</p>
                    {channel.status !== 'Active' && !channel.connectByPropertyId ? (
                      <p className="text-sm text-muted-foreground">{t('activationJourney.staffChannel')}</p>
                    ) : channel.reason === 'octorate_not_connected' ? (
                      <p className="text-sm text-muted-foreground">{t('activationJourney.connectionPreparation')}</p>
                    ) : channel.reason && channel.status === 'NotActive' && !channel.canActivate ? (
                      <p className="text-sm text-muted-foreground">{translateErrorCode(channel.reason, t)}</p>
                    ) : null}
                  </div>
                  {canConnectChannels && channel.connectByPropertyId && (channel.status === 'Pending' || channel.status === 'ToFix' || (channel.canActivate && channel.status === 'NotActive')) && (
                    <Button asChild size="sm" variant="outline" className="min-h-11">
                      <Link to={withReturnTo(marketplaceHref(marketplaceActivationPath(channel.kind, channel.code), property.id), pathname + search)}
                        aria-label={t('activationJourney.openChannel', { name: channel.name })}>
                        {t(channel.status === 'NotActive' ? 'activationJourney.connect' : 'activationJourney.resume')}
                      </Link>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-11">
              <Link to={propertyTabPath(property.id, 'ical')}>{t('nav.channels')}</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link to={marketplaceHref(MARKETPLACE_MINE_PATH, property.id)}>{t('activationJourney.integrations')}</Link>
            </Button>
          </div>
        </div>
      )}
      <PropertyActivationServices propertyId={property.id} channels={channels} canSetPortals={canConnectChannels} canRequestHelp={canEditProperty} />
    </section>
  );
}

export function PropertyActivationPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const properties = useProperties(SHORT_PROPERTIES_OVERVIEW, { fresh: true });
  const [params, setParams] = useSearchParams();
  const { key: locationKey } = useLocation();
  const search = useRef<HTMLInputElement>(null);
  const firstResult = useRef<HTMLAnchorElement>(null);
  const routeQuery = params.get('q') ?? '';
  const [pendingSearch, setPendingSearch] = useState<{ locationKey: string; value: string }>();
  const query = pendingSearch?.locationKey === locationKey ? pendingSearch.value : routeQuery;
  const selected = properties.data?.find((property) => property.id === params.get('propertyId'));
  const match = query.trim().toLocaleLowerCase(i18n.language);
  const visible = properties.data?.filter((property) =>
    `${property.name} ${property.city}`.toLocaleLowerCase(i18n.language).includes(match)) ?? [];

  useEffect(() => {
    function openSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && search.current?.getClientRects().length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        search.current.focus();
      }
    }
    window.addEventListener('keydown', openSearch, true);
    return () => window.removeEventListener('keydown', openSearch, true);
  }, []);

  function paramsFor(propertyId = '', queryValue = query) {
    const next = new URLSearchParams(params);
    if (propertyId) next.set('propertyId', propertyId);
    else next.delete('propertyId');
    if (queryValue) next.set('q', queryValue);
    else next.delete('q');
    return { search: next.toString() };
  }

  return (
    <AppShell>
      <div className="min-w-0 space-y-6">
        <PageHeader title={t('activationJourney.title')} description={t('activationJourney.description')} />
        {properties.isPending ? <SkeletonCard lines={3} /> : properties.isError ? (
          <ErrorState title={t('activationJourney.propertiesError')} error={properties.error} onRetry={() => void properties.refetch()} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)]">
            <section className={selected ? 'hidden min-w-0 space-y-3 lg:block' : 'min-w-0 space-y-3'}>
              <h2 className="font-semibold">{t('activationJourney.properties')}</h2>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 size-5 text-muted-foreground" aria-hidden="true" />
                <Input ref={search} type="search" value={query} maxLength={150} className="min-h-11 pl-10"
                  aria-label={t('activationJourney.search')} placeholder={t('activationJourney.search')}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPendingSearch({ locationKey, value });
                    setParams(paramsFor(params.get('propertyId') ?? '', value).search, { replace: true });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      firstResult.current?.focus();
                    }
                    if (event.key === 'Enter') firstResult.current?.click();
                  }} />
              </div>
              {visible.length === 0 ? <p className="text-sm text-muted-foreground">{t('activationJourney.noResults')}</p> : (
                <ul className="divide-y rounded-xl border bg-card">
                  {visible.map((property, index) => (
                    <li key={property.id}>
                      <Link ref={index === 0 ? firstResult : undefined} to={paramsFor(property.id)}
                        aria-current={selected?.id === property.id ? 'true' : undefined}
                        onKeyDown={(event) => {
                          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                          event.preventDefault();
                          const row = event.currentTarget.parentElement;
                          const target = event.key === 'ArrowDown' ? row?.nextElementSibling : row?.previousElementSibling;
                          if (target) target.querySelector('a')?.focus();
                          else if (event.key === 'ArrowUp') search.current?.focus();
                        }}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-lg p-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] aria-current:bg-muted">
                        <PropertyThumb photoUrls={property.photoUrls} className="size-10" />
                        <span className="min-w-0 flex-1 break-words">
                          <span className="block font-medium">{property.name}</span>
                          <span className="text-sm text-muted-foreground">{property.city}</span>
                        </span>
                        <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {selected ? (
              <div className="min-w-0 space-y-3">
                <Button asChild variant="ghost" className="min-h-11 lg:hidden">
                  <Link to={paramsFor()}><ArrowLeft aria-hidden="true" />{t('activationJourney.back')}</Link>
                </Button>
                <PropertyJourney key={selected.id} property={selected}
                  canEditProperty={hasPermission('short-rent', 'property.write')}
                  canReadCatalog={hasPermission('short-rent', 'booking.read')}
                  canConnectChannels={flags.octorateConnector && hasPermission('short-rent', 'ota.write')} />
              </div>
            ) : (
              <p className="hidden self-start rounded-xl border bg-muted p-6 text-sm text-muted-foreground lg:block">
                {t('activationJourney.selectProperty')}
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
