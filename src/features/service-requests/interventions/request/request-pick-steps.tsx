import { useEffect, useMemo, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Globe, Home, ShieldCheck } from 'lucide-react';
import { FormFieldError } from '@/components/shared/form-field-error';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { SkeletonLine } from '@/components/ui/skeleton';
import { PartnerCard } from '@/features/marketplace/components/partner-card';
import { RecommendedBadge } from '@/features/marketplace/components/recommended-badge';
import { VerifiedBadge } from '@/features/marketplace/components/verified-badge';
import { countByCategory } from '@/features/marketplace/lib/category-groups';
import { categoryIcon } from '@/features/marketplace/lib/category-icons';
import { supplierFacts } from '@/features/marketplace/lib/supplier-labels';
import { propertyEditPath } from '@/features/properties/properties-paths';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { usePartnersByServiceCategory } from '@/queries/use-marketplace';
import { useProperties } from '@/queries/use-properties';
import { useServiceCategories } from '@/queries/use-service-categories';
import { useMarketplaceSuppliers, useSuppliersByProperty } from '@/queries/use-service-requests';
import type { SupplierPicker } from '@/types/service-request';
import { AssistChoiceLine, RequestAssistCard } from './request-assist-card';
import { assign, NO_SUPPLIER } from './request-form';
import type { RequestChannel, RequestValues } from './request-model';

/** Where a step sends the wizard: another channel, and the step it goes on from (one change of the address, never two that cancel each other). */
export type ChangeChannel = (channel: RequestChannel, goToStep?: string) => void;

/** The property the wizard is about, from the list of the host's properties. */
function useWizardProperty(propertyId: string) {
  const properties = useProperties({ mode: 'short' });
  return (Array.isArray(properties.data) ? properties.data : []).find((candidate) => candidate.id === propertyId);
}

/**
 * The kinds of work an external partner covers, among the ones the wizard offers: the tiles of the service step with the external channel.
 * The channel is offered only when there is at least one, so that it never leads to a step with nothing to pick.
 */
function coveredByPartners(catalog: readonly string[], partnersFor: (serviceCategory: string) => readonly unknown[]): string[] {
  return catalog.filter((code) => partnersFor(code).length > 0);
}

/* ---------------------------------------------------------------------------------------------------- ① Immobile */

/** Step ①: the property the work is for. A request is for the house: a stay is a link the host may add at the end. */
export function PropertyStep() {
  const { t } = useTranslation();
  const { register, setValue, formState } = useFormContext<RequestValues>();
  const properties = useProperties({ mode: 'short' });
  const list = Array.isArray(properties.data) ? properties.data : [];
  const field = register('propertyId');

  // A flex column with a gap, not `space-y-*`: the group is a `fieldset` with its own margin, which the spacing of the siblings would not move.
  return (
    <div className="flex flex-col gap-3">
      <ChoiceGroup legend={t('requestWizard.property.legend')} minCardWidth={15}>
        {list.map((property) => (
          <ChoiceCard
            key={property.id}
            icon={Home}
            title={property.name}
            description={[property.city, property.address].filter(Boolean).join(' · ')}
            value={property.id}
            data-testid={`request-property-${property.id}`}
            {...field}
            onChange={(event) => {
              void field.onChange(event);
              // The stay belongs to the property: another property has other stays, and other suppliers cover it.
              setValue('bookingId', '', { shouldDirty: true });
              assign(setValue, NO_SUPPLIER);
            }}
          />
        ))}
      </ChoiceGroup>
      <FormFieldError error={formState.errors.propertyId} />
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------- ② Chi */

interface ChannelStepProps {
  channel: RequestChannel;
  /** The address names the channel: the host (or the wizard, once) chose it, so it is not steered again. */
  explicit: boolean;
  onChannel: ChangeChannel;
}

/**
 * Step ②: who to ask, a CasaZen supplier or an external partner. CasaZen is the rule: it is advised, and it is the one chosen unless the
 * zone of the property has no supplier at all (or no comune to look in), in which case the partners are proposed and CasaZen cannot be
 * picked, with the reason said.
 */
export function ChannelStep({ channel, explicit, onChannel }: ChannelStepProps) {
  const { t } = useTranslation();
  const { control } = useFormContext<RequestValues>();
  const propertyId = useWatch({ control, name: 'propertyId' });
  const property = useWizardProperty(propertyId);
  const hasComune = !!property?.comuneIstatCode;
  const suppliers = useMarketplaceSuppliers({ propertyId: hasComune ? propertyId : undefined });
  const noNetwork = !hasComune || (suppliers.isSuccess && suppliers.data.items.length === 0);
  // The external channel is offered while a partner of the catalog covers a kind of work the wizard offers (or the catalog is being read)
  // and not otherwise: a way nobody can follow. A partner that lists no such kind has no tile on the service step, so with it alone (and
  // CasaZen out) the request would have no way out. The one the address names stays, so that the choice the wizard is on does not
  // disappear under it.
  const categories = useServiceCategories();
  const { partnersFor, isLoading: partnersLoading } = usePartnersByServiceCategory();
  const hasPartners = coveredByPartners(categories.data ?? [], partnersFor).length > 0;
  const partnersAhead = hasPartners || partnersLoading;
  const offerExternal = partnersAhead || channel === 'external';

  // Nobody of CasaZen around: the partners are the way, and the host is shown them without having to find out (once the catalog has some).
  useEffect(() => {
    if (noNetwork && !explicit && channel !== 'external' && hasPartners) onChannel('external');
  }, [noNetwork, explicit, channel, hasPartners, onChannel]);

  return (
    <div className="flex flex-col gap-4">
      <ChoiceGroup legend={t('requestWizard.channel.legend')} minCardWidth={16}>
        <ChoiceCard
          icon={ShieldCheck}
          name="request-channel"
          value="casazen"
          checked={channel === 'casazen'}
          disabled={noNetwork}
          onChange={() => onChannel('casazen')}
          title={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {t('requestWizard.channel.casazen.title')}
              {noNetwork ? null : <Badge variant="outline">{t('requestWizard.channel.recommended')}</Badge>}
            </span>
          }
          description={noNetwork ? t('requestWizard.channel.casazen.none') : t('requestWizard.channel.casazen.text')}
          data-testid="request-channel-casazen"
        />
        {offerExternal ? (
          <ChoiceCard
            icon={Globe}
            name="request-channel"
            value="external"
            checked={channel === 'external'}
            onChange={() => onChannel('external')}
            title={t('requestWizard.channel.external.title')}
            description={t('requestWizard.channel.external.text')}
            data-testid="request-channel-external"
          />
        ) : null}
      </ChoiceGroup>

      {!hasComune && property ? (
        <Alert variant="warning" data-testid="request-no-comune">
          {t(partnersAhead ? 'requestWizard.channel.noComune' : 'requestWizard.channel.noComuneNoPartners')}{' '}
          <Link to={propertyEditPath(property.id)} className="font-medium underline underline-offset-4">
            {t('requestWizard.channel.addComune')}
          </Link>
        </Alert>
      ) : noNetwork ? (
        <Alert variant="info" data-testid="request-no-network">
          {t(partnersAhead ? 'requestWizard.channel.noNetwork' : 'requestWizard.channel.noNetworkNoPartners')}
        </Alert>
      ) : null}

      {/* Optional, and only where an AI is in effect: the host tells the job in words and the wizard goes on from what the AI proposes. */}
      <RequestAssistCard onUse={onChannel} />
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------------- ③ Servizio */

/**
 * Step ③: the kind of service, as big tiles with their icon. With CasaZen each says how many suppliers work around the property; with
 * a partner only the services a partner covers are there, and the tile names them.
 */
export function ServiceStep({ channel }: { channel: RequestChannel }) {
  const { t } = useTranslation();
  const { register, setValue, control, formState } = useFormContext<RequestValues>();
  const categories = useServiceCategories();
  const { partnersFor } = usePartnersByServiceCategory();
  const propertyId = useWatch({ control, name: 'propertyId' });
  const property = useWizardProperty(propertyId);
  const suppliers = useMarketplaceSuppliers({ propertyId: channel === 'casazen' && property?.comuneIstatCode ? propertyId : undefined });
  const counts = useMemo(() => countByCategory(suppliers.data?.items ?? []), [suppliers.data]);
  const field = register('category');

  if (categories.isPending) return <SkeletonLine lines={4} label={t('requestWizard.loading')} />;

  const catalog = categories.data ?? [];
  const shown = channel === 'external' ? coveredByPartners(catalog, partnersFor) : catalog;
  const describe = (code: string): string | undefined => {
    if (channel === 'external') return partnersFor(code).map((partner) => partner.name).join(', ');
    if (suppliers.isPending && property?.comuneIstatCode) return undefined;
    const count = counts.get(code) ?? 0;
    return count > 0 ? t('marketplace.categories.count', { count }) : t('marketplace.categories.none');
  };

  return (
    <div className="flex flex-col gap-3">
      <ChoiceGroup legend={t('requestWizard.service.legend')} minCardWidth={13}>
        {shown.map((code) => (
          <ChoiceCard
            key={code}
            icon={categoryIcon(code)}
            title={getServiceCategoryLabel(code, t)}
            description={describe(code)}
            value={code}
            data-testid={`request-category-${code}`}
            {...field}
            onChange={(event) => {
              void field.onChange(event);
              // The suppliers and their services depend on the kind of work.
              assign(setValue, NO_SUPPLIER);
            }}
          />
        ))}
      </ChoiceGroup>
      <FormFieldError error={formState.errors.category} />
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------------- ④ Proposte */

/** The line a supplier card says under its name: the price and the answer time when they are known, a few of its services. */
function supplierDescription(supplier: SupplierPicker, t: TFunction, language: string): ReactNode {
  const facts = supplierFacts(supplier, t, language) ?? t('requestWizard.who.priceOnRequest');
  const services = (supplier.services ?? []).slice(0, 3).map((service) => service.name);
  return (
    <span className="flex flex-col gap-1">
      <span>{facts}</span>
      {services.length > 0 ? <span className="text-xs text-foreground/70">{services.join(' · ')}</span> : null}
    </span>
  );
}

/**
 * Step ④ with CasaZen: the suppliers that cover the comune of the property for the kind of work, in the order of the ranking the server
 * gives (SP-REL: load and reliability), the first one marked «Consigliato» when it is strictly ahead. With none the page says so and puts
 * the partners of that service next to the sentence, with a way to go on with them.
 */
export function ProposalsStep({ onChannel, goTo }: { onChannel: ChangeChannel; goTo: (stepId: string) => void }) {
  const { t, i18n } = useTranslation();
  const { control, setValue, formState } = useFormContext<RequestValues>();
  const [propertyId, category, chosen] = useWatch({ control, name: ['propertyId', 'category', 'supplierOrgId'] });
  const suppliers = useSuppliersByProperty(propertyId, category);
  const { partnersFor } = usePartnersByServiceCategory();
  const partners = partnersFor(category);

  if (suppliers.isPending) return <SkeletonLine lines={4} label={t('requestWizard.who.loadingSuppliers')} />;
  if (suppliers.isError) {
    return (
      <Alert
        variant="danger"
        action={
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void suppliers.refetch()}>
            {t('requestWizard.retry')}
          </Button>
        }
      >
        {t('requestWizard.who.suppliersError')}
      </Alert>
    );
  }

  const items = suppliers.data.items;
  const notAvailable = chosen !== '' && !items.some((supplier) => supplier.orgId === chosen);

  const choose = (supplier: SupplierPicker) => {
    if (supplier.orgId === chosen) return;
    assign(setValue, { ...NO_SUPPLIER, supplierOrgId: supplier.orgId, supplierName: supplier.legalName });
  };

  if (items.length === 0) {
    return (
      <div className="space-y-4" data-testid="request-no-suppliers">
        <AssistChoiceLine goTo={goTo} />
        <Alert variant="info">{t('marketplace.noNetwork')}</Alert>
        {partners.length > 0 ? (
          <>
            <p className="text-sm text-foreground/70">{t('requestWizard.proposals.partnersIntro')}</p>
            <ul role="list" className="grid list-none gap-3 sm:grid-cols-2">
              {partners.map((partner) => (
                <PartnerCard key={partner.code} partner={partner} />
              ))}
            </ul>
            <Button type="button" onClick={() => onChannel('external', 'partners')} data-testid="request-go-partners">
              {t('requestWizard.proposals.seePartners')}
            </Button>
          </>
        ) : (
          <p className="text-sm text-foreground/70">{t('requestWizard.proposals.noPartners')}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <AssistChoiceLine goTo={goTo} />
      {notAvailable ? (
        <Alert variant="warning" data-testid="request-supplier-unavailable">
          {t('requestWizard.who.supplierUnavailable')}
        </Alert>
      ) : null}
      {items.length > 1 ? <p className="text-sm text-foreground/70">{t('requestWizard.proposals.ranking')}</p> : null}
      <ChoiceGroup legend={t('requestWizard.who.suppliers')} minCardWidth={16}>
        {items.map((supplier) => (
          <ChoiceCard
            key={supplier.orgId}
            name="request-supplier"
            value={supplier.orgId}
            checked={chosen === supplier.orgId}
            onChange={() => choose(supplier)}
            title={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {supplier.legalName}
                {supplier.recommended ? <RecommendedBadge /> : null}
                {supplier.verified ? <VerifiedBadge /> : null}
              </span>
            }
            description={supplierDescription(supplier, t, i18n.language)}
            data-testid={`request-supplier-${supplier.orgId}`}
          />
        ))}
      </ChoiceGroup>
      <FormFieldError error={formState.errors.supplierOrgId} />
      {partners.length > 0 ? (
        <p className="text-sm text-foreground/70">
          {t('requestWizard.proposals.orPartner')}{' '}
          <Button type="button" variant="link" className="h-auto p-0 align-baseline" onClick={() => onChannel('external', 'partners')} data-testid="request-or-partners">
            {t('requestWizard.proposals.seePartners')}
          </Button>
        </p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------------- ④ Partner */

/**
 * Step ④ with an external partner, the last one: the partners of the service, each with its own site. The work is organised there, so
 * CasaZen sends nothing and says so.
 */
export function PartnersStep({ goTo }: { goTo: (stepId: string) => void }) {
  const { t } = useTranslation();
  const { control } = useFormContext<RequestValues>();
  const category = useWatch({ control, name: 'category' });
  const { partnersFor } = usePartnersByServiceCategory();
  const partners = partnersFor(category);

  return (
    <div className="space-y-4" data-testid="request-partners">
      <AssistChoiceLine goTo={goTo} />
      <Alert variant="info">{t('requestWizard.partners.how')}</Alert>
      {partners.length > 0 ? (
        <ul role="list" className="grid list-none gap-3 sm:grid-cols-2">
          {partners.map((partner) => (
            <PartnerCard key={partner.code} partner={partner} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/70">{t('requestWizard.proposals.noPartners')}</p>
      )}
    </div>
  );
}
