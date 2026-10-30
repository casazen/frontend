import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { Property } from '@/types';

interface PropertyPickerProps {
  properties: readonly Property[];
  /** The property the marketplace is about. */
  value: string;
  onChange: (propertyId: string) => void;
}

/** The property the suppliers are looked for around: the marketplace is always about one of them (`?propertyId=` in the address). */
export function PropertyPicker({ properties, value, onChange }: PropertyPickerProps) {
  const { t } = useTranslation();

  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor="marketplace-property">{t('marketplace.propertyLabel')}</Label>
      <Select
        id="marketplace-property"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        data-testid="marketplace-property-select"
      >
        {properties.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
