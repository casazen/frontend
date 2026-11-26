import { matchesSearch } from '@/components/shared/list-view/list-data';
import { propertyTabPath, propertyWizardPath } from '@/features/properties/properties-paths';
import type { TFunction } from 'i18next';

export function propertySettingsOptions(t: TFunction, query: string, canEdit: boolean) {
  const title = t('workspaceView.propertySettings');
  return [
    ...(canEdit ? [
      { label: t('propertyWizard.steps.rules.label'), to: (id: string) => propertyWizardPath(id, 'rules') },
      { label: t('property.form.amenities.title'), to: (id: string) => propertyWizardPath(id, 'amenities') },
      { label: t('propertyWizard.steps.prices.label'), to: (id: string) => propertyWizardPath(id, 'prices') },
    ] : []),
    { label: t('property.detail.tabs.documents'), to: (id: string) => propertyTabPath(id, 'documents') },
    { label: t('property.detail.tabs.ical'), to: (id: string) => propertyTabPath(id, 'ical') },
  ].filter(option => matchesSearch(title + ' ' + option.label, query.trim()));
}
