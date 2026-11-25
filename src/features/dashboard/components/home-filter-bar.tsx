import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface HomeFilterBarProps {
  properties: ReadonlyArray<{ id: string; name: string }>;
  propertyId: string;
  onPropertyChange: (propertyId: string) => void;
  onReset: () => void;
}

export function HomeFilterBar({ properties, propertyId, onPropertyChange, onReset }: HomeFilterBarProps) {
  const { t } = useTranslation();
  const unknownProperty = Boolean(propertyId && !properties.some(property => property.id === propertyId));
  const propertyLabel = t('dashboard.filter.property');
  return (
    <div role="group" aria-label={t('dashboard.filter.label')} data-testid="home-filter" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-2">
      {properties.length > 1 || unknownProperty ? (
        <label className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-medium">{propertyLabel}</span>
          <Select
            size="sm"
            aria-label={propertyLabel}
            wrapperClassName="w-auto max-w-full"
            data-testid="dashboard-property"
            value={propertyId}
            onChange={event => onPropertyChange(event.target.value)}
          >
            <option value="">{t('dashboard.filter.allProperties')}</option>
            {unknownProperty && <option value={propertyId}>{t('dashboard.filter.requestedProperty')}</option>}
            {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
          </Select>
        </label>
      ) : (
        <p className="min-w-0 break-words text-sm text-foreground/75">
          {properties[0] ? `${propertyLabel} · ${properties[0].name}` : t('dashboard.filter.allProperties')}
        </p>
      )}
      {propertyId && (
        <Button variant="link" size="sm" className="min-h-11 px-1 text-primary-text" onClick={onReset}>{t('dashboard.filter.reset')}</Button>
      )}
    </div>
  );
}
