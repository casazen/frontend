import { requiresItalianCin } from '@/lib/cin-format';
import { SwissRegistrationGuidance } from './swiss-registration-guidance';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { IstatCredentialsCard } from '@/features/compliance/components/istat-credentials-card';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import type { PropertyDetailDto } from '@/types';
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
      </PlainSection> : <SwissRegistrationGuidance />}

      <PropertyDocumentsSection plain propertyId={property.id} documents={property.documents} />

      {property.country === 'IT' ? <QuesturaCredentialsCard propertyId={property.id} canEdit={canWrite} /> : null}

      {flags.octorateOnboarding && property.country === 'IT' ? <IstatCredentialsCard propertyId={property.id} canEdit={canWrite} /> : null}
    </div>
  );
}
