import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { getAmenityLabel } from '@/lib/i18n-labels';
import { AMENITY_GROUPS, type PropertyWizardValues } from '../property-wizard-model';
import { SafetyCard } from './safety-card';

interface AmenitiesStepProps {
  form: UseFormReturn<PropertyWizardValues>;
  propertyId: string;
}

/**
 * Step 3 · «Cosa trovano gli ospiti?» (SR-07b): the amenities the property really has, in four groups, and the safety sheet. The
 * step may be left out («Salta questo passo» where it is not the last): the property then stays «Da completare». Pets and
 * smoking are not asked here: the house rules decide them, so the same thing is never asked twice.
 */
export function AmenitiesStep({ form, propertyId }: AmenitiesStepProps) {
  const { t } = useTranslation();
  const chosen = form.watch('amenities').length;

  return (
    <>
      {AMENITY_GROUPS.map((group) => (
        <ChoiceGroup key={group.id} legend={t(`propertyWizard.amenities.groups.${group.id}`)} legendVisible minCardWidth={9}>
          {group.amenities.map((amenity) => (
            <ChoiceCard
              key={amenity}
              type="checkbox"
              value={amenity}
              title={getAmenityLabel(amenity, t)}
              {...form.register('amenities')}
            />
          ))}
        </ChoiceGroup>
      ))}

      <p role="status" className="text-sm text-foreground/70" data-testid="property-wizard-amenities-count">
        {chosen > 0 ? t('propertyWizard.amenities.count', { count: chosen }) : t('propertyWizard.amenities.none')}
      </p>

      <SafetyCard propertyId={propertyId} />
    </>
  );
}
