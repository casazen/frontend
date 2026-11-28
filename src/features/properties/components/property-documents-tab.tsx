import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, Landmark, Pencil, ShieldCheck } from 'lucide-react';
import { InfoCard } from '@/components/shared/calm';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import { ManualHint } from '@/components/shared/manual-hint';
import { Button } from '@/components/ui/button';
import { TICINO_LAYER_KIND, ticinoLayerPath } from '@/features/compliance/ticino/ticino-layer-address';
import { TicinoStructureIdForm } from '@/features/compliance/ticino/ticino-structure-id-form';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { requiresItalianCin } from '@/lib/cin-format';
import type { PropertyDetailDto } from '@/types';
import { propertyEditPath } from '../properties-paths';
import { PropertyCinBadge } from './property-cin-badge';
import { PropertyDocumentsSection } from './property-documents-section';
import { PropertyInstitutionalPortals } from './property-institutional-portals';
import { SwissRegistrationGuidance } from './swiss-registration-guidance';

interface PropertyDocumentsTabProps {
  property: PropertyDetailDto;
  /** `property.write`: the CIN can be changed and the Alloggiati Web credentials set (the API checks the same permission). */
  canWrite: boolean;
  onEditCin: () => void;
}

export function PropertyDocumentsTab({ property, canWrite, onEditCin }: PropertyDocumentsTabProps) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const drawer = useDetailDrawer();

  return (
    <div className="@container min-w-0">
      <div className="grid min-w-0 gap-4 @3xl:grid-cols-2 @3xl:items-start">
        {requiresItalianCin(property.country) ? (
          <InfoCard
            icon={ShieldCheck}
            title={t('property.detail.cinTitle')}
            hint={
              <ManualHint page="cin-identificazione-ticino" anchor="cin-cosa-e-e-cosa-controlla-casazen" title={t('property.detail.cinTitle')}>
                {t('property.detail.cinDescription')}
              </ManualHint>
            }
            data-testid="property-cin-card"
          >
            <div className="flex flex-wrap items-center gap-3">
              <PropertyCinBadge cinStatus={property.cinStatus} cinCode={property.cinCode} />
              {canWrite ? (
                <Button type="button" variant="outline" size="sm" onClick={onEditCin}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {t('property.detail.editCin')}
                </Button>
              ) : null}
            </div>
          </InfoCard>
        ) : (
          <SwissRegistrationGuidance propertyId={property.id} variant="page" canWrite={canWrite} municipalityHref={propertyEditPath(property.id)} className="@3xl:col-span-2" />
        )}

        {property.isInTicino ? (
          <InfoCard
            icon={Landmark}
            title={t('swiss.property.title')}
            hint={
              <ManualHint page="cin-identificazione-ticino" anchor="notificare-gli-ospiti-alla-polizia-del-ticino" title={t('swiss.property.title')}>
                {t('swiss.property.description')}
              </ManualHint>
            }
            data-testid="swiss-property-card"
          >
            {flags.guestRegistrationRegimes ? null : canWrite ? (
              <TicinoStructureIdForm propertyId={property.id} value={property.ticinoStructureId} />
            ) : (
              <p className="text-sm">{property.ticinoStructureId ?? t('swiss.property.noId')}</p>
            )}
            <div>
              <Button asChild variant="outline" size="sm" className="min-h-11">
                <Link
                  to={ticinoLayerPath(property.id)}
                  onClick={(event) => {
                    if (drawer.open(TICINO_LAYER_KIND, property.id, { opener: event.currentTarget })) event.preventDefault();
                  }}
                  data-testid="ticino-police-link"
                >
                  {t('swiss.property.open')}
                </Link>
              </Button>
            </div>
          </InfoCard>
        ) : null}

        <PropertyDocumentsSection icon={FileText} propertyId={property.id} documents={property.documents} />

        {property.country === 'IT' && <PropertyInstitutionalPortals key={property.id} property={property} canWrite={canWrite} />}
      </div>
    </div>
  );
}
