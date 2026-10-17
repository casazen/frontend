import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
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
 * what the header and "Cosa fare ora" now say.
 */
export function PropertyDocumentsTab({ property, canWrite, onEditCin }: PropertyDocumentsTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <PlainSection title={t('property.detail.cinTitle')}>
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
      </PlainSection>

      <PropertyDocumentsSection plain propertyId={property.id} documents={property.documents} />

      <QuesturaCredentialsCard propertyId={property.id} canEdit={canWrite} />
    </div>
  );
}
