import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ConsentCheckbox({ checked, onCheckedChange }: ConsentCheckboxProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-3 rounded-md border p-4" data-testid="gdpr-consent">
      <Checkbox
        id="data-consent"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label htmlFor="data-consent" className="text-sm leading-relaxed cursor-pointer">
        {t('publicBooking.gdprConsentText')}
      </Label>
    </div>
  );
}
