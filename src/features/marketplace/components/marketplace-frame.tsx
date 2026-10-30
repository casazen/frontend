import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Loader2, MapPin, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import type { PageHeaderAction } from '@/components/layout/page-header-actions';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PROPERTY_CREATE_PATH, propertyEditPath } from '@/features/properties/properties-paths';
import type { PageCrumb } from '@/lib/page-crumbs';
import type { Property } from '@/types';
import { marketplaceHref } from '../lib/marketplace-paths';
import { useMarketplaceProperty } from '../lib/marketplace-property';
import { useRequestIntervention, type InterventionRequestStart } from '../lib/use-request-intervention';
import { MarketplaceTabs, type MarketplaceSection } from './marketplace-tabs';
import { PropertyPicker } from './property-picker';

/** A step of the trail to the page: where it leads without the property (the frame adds it) and what it is called. */
export interface MarketplaceTrailStep {
  label: string;
  path?: string;
}

interface MarketplaceFrameProps {
  /** The tab the page is. */
  section: MarketplaceSection;
  title: string;
  description?: string;
  /** The pages above this one, the page itself last (without `path`). Nothing for a page that is a tab. */
  trail?: MarketplaceTrailStep[];
  /** Next to the property: what searches (Scopri, Cerca). */
  toolbar?: ReactNode;
  /**
   * The main action of the page. Default: «Richiedi un intervento»; `null` for none. A function is given how to start a request, for an
   * action that starts one from what the page is about (a supplier: «Richiedi fornitore»).
   */
  primary?: PageHeaderAction | null | ((requestIntervention: (from?: InterventionRequestStart) => void) => PageHeaderAction);
  /**
   * The page looks for suppliers around the property, which is done by its comune (the one of the official list): without one the page
   * asks for it instead. A page about what was already asked (Le mie app) does not need it. Default: yes.
   */
  needsComune?: boolean;
  /** What the page shows for the property. */
  children: (context: MarketplaceContext) => ReactNode;
}

export interface MarketplaceContext {
  /** The property the marketplace is about. */
  property: Property;
  /** Starts a request of an intervention (the dialog is in the frame). */
  requestIntervention: (from?: InterventionRequestStart) => void;
}

/**
 * What every page of the marketplace has in common (MKT): the head of the page with its trail and the one main action, the tabs,
 * the property the suppliers are looked for around, and the states that come before any supplier: the properties are loading or
 * failed to load, the host has none, or the one chosen has no comune yet. The page itself is the `children`.
 */
export function MarketplaceFrame({ section, title, description, trail, toolbar, primary, needsComune = true, children }: MarketplaceFrameProps) {
  const { t } = useTranslation();
  const { properties, property, isLoading, isError, error, refetch, setProperty } = useMarketplaceProperty();
  const request = useRequestIntervention(property?.id);

  const crumbs: PageCrumb[] | undefined = trail?.map((step) => ({
    label: step.label,
    to: step.path ? marketplaceHref(step.path, property?.id) : undefined,
  }));

  // The one action is there when there is something to ask a supplier for: a property, and for a page that looks for suppliers, its comune.
  const asked = typeof primary === 'function' ? primary(request.open) : primary;
  const mainAction: PageHeaderAction | undefined =
    asked === null || !property || (needsComune && !property.comuneIstatCode)
      ? undefined
      : (asked ?? {
          label: t('marketplace.requestIntervention'),
          icon: Wrench,
          onClick: () => request.open(),
          testId: 'marketplace-request-intervention',
        });

  return (
    <div className="min-w-0 space-y-6" data-testid="marketplace-page">
      <PageHeader title={title} description={description} crumbs={crumbs} primary={mainAction} />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          {t('marketplace.loading')}
        </div>
      ) : isError && !properties ? (
        <ErrorState title={t('marketplace.propertiesLoadError')} error={error} onRetry={() => void refetch()} />
      ) : !property || !properties ? (
        <EmptyState
          icon={Building2}
          title={t('marketplace.noProperties')}
          description={t('marketplace.noPropertiesHint')}
          action={{ label: t('marketplace.addProperty'), href: PROPERTY_CREATE_PATH }}
        />
      ) : (
        <>
          <MarketplaceTabs section={section} propertyId={property.id} />

          <div className="grid gap-3 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:items-end">
            <PropertyPicker properties={properties} value={property.id} onChange={setProperty} />
            {/* There is nothing to search while the property has no comune to look in. */}
            {property.comuneIstatCode || !needsComune ? toolbar : null}
          </div>

          {property.comuneIstatCode || !needsComune ? (
            children({ property, requestIntervention: request.open })
          ) : (
            <EmptyState
              icon={MapPin}
              title={t('marketplace.addComune')}
              description={t('marketplace.addComuneHint')}
              action={{ label: t('marketplace.editProperty'), href: propertyEditPath(property.id) }}
              className="py-8"
            />
          )}
          {request.dialog}
        </>
      )}
    </div>
  );
}
