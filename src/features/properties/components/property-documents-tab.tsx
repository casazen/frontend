import { requiresItalianCin } from '@/lib/cin-format';
import { SwissRegistrationGuidance } from './swiss-registration-guidance';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import { Button } from '@/components/ui/button';
import { IstatCredentialsCard } from '@/features/compliance/components/istat-credentials-card';
import { TICINO_LAYER_KIND, ticinoLayerPath } from '@/features/compliance/ticino/ticino-layer-address';
import { TicinoStructureIdForm } from '@/features/compliance/ticino/ticino-structure-id-form';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import type { PropertyDetailDto } from '@/types';
import { propertyEditPath } from '../properties-paths';
import { PropertyCinBadge } from './property-cin-badge';
import { PropertyDocumentsSection } from './property-documents-section';
import { QuesturaCredentialsCard } from './questura-credentials-card';

interface PropertyDocumentsTabProps {
  property: PropertyDetailDto;
  /** `property.write`: the CIN can be changed and the Alloggiati Web credentials set (the API checks the same permission). */
  canWrite: boolean;
  onEditCin: () => void;
}

/**
 * The tab Documenti e adempimenti (SR-07d): the CIN, the documents of the property and the Alloggiati Web credentials. The
 * old page had them in two tabs (Documenti, CIN & Compliance); the summary of the compliance that closed the second one said
 * what the header and "Cosa fare ora" now say. With the activation of the channel manager (the flag `octorateOnboarding`) the regional ISTAT credentials are under them,
 * for a property in Italy (E20/F03/US02/T01): with the flag off nothing of them is drawn or asked.
 */
export function PropertyDocumentsTab({ property, canWrite, onEditCin }: PropertyDocumentsTabProps) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const drawer = useDetailDrawer();

  return (
    <div className="space-y-8">
      {requiresItalianCin(property.country) ? <PlainSection title={t('property.detail.cinTitle')}>
        <div className="flex flex-wrap items-center gap-3">
          <PropertyCinBadge cinStatus={property.cinStatus} cinCode={property.cinCode} />
          {canWrite ? (
            <Button type="button" variant="outline" size="sm" onClick={onEditCin}>
              <Pencil aria-hidden="true" className="size-4" />
              {t('property.detail.editCin')}
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-foreground/70">{t('property.detail.cinDescription')}</p>
      </PlainSection> : <SwissRegistrationGuidance propertyId={property.id} variant="page" canWrite={canWrite} municipalityHref={propertyEditPath(property.id)} />}

      {property.isInTicino ? (
        <PlainSection title={t('swiss.property.title')}>
          <p className="mb-3 text-sm text-foreground/70">{t('swiss.property.description')}</p>
          {/* With the regimes on the structure number is in the card above, with what is still missing: it is never asked twice on the page. */}
          {flags.guestRegistrationRegimes ? null : canWrite ? (
            <TicinoStructureIdForm propertyId={property.id} value={property.ticinoStructureId} />
          ) : (
            <p className="text-sm">{property.ticinoStructureId ?? t('swiss.property.noId')}</p>
          )}
          {/* The guided notification is a layer of the app (E30/F02/US03/T02): it opens over this page, and the address of the cockpit with the layer open is the way for a page with no drawer. */}
          <Link
            to={ticinoLayerPath(property.id)}
            onClick={(event) => {
              if (drawer.open(TICINO_LAYER_KIND, property.id, { opener: event.currentTarget })) event.preventDefault();
            }}
            className="mt-3 inline-flex min-h-11 items-center text-sm text-primary hover:underline"
            data-testid="ticino-police-link"
          >
            {t('swiss.property.open')}
          </Link>
        </PlainSection>
      ) : null}

      <PropertyDocumentsSection plain propertyId={property.id} documents={property.documents} />

      {property.country === 'IT' ? <QuesturaCredentialsCard propertyId={property.id} canEdit={canWrite} /> : null}

      {flags.octorateOnboarding && property.country === 'IT' ? <IstatCredentialsCard propertyId={property.id} canEdit={canWrite} /> : null}
    </div>
  );
}
