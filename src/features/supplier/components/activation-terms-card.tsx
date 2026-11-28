import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LEGAL_DOCUMENT_PATHS } from '@/features/legal/legal-paths';

interface ActivationTermsCardProps {
  version: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ActivationTermsCard({ version, checked, onCheckedChange, disabled }: ActivationTermsCardProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-6">
        <Checkbox
          id="tos"
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <div className="space-y-1">
          <Label htmlFor="tos" className="text-sm leading-relaxed">
            {t('supplier.activation.terms.accept', { version })}
          </Label>
          <p className="text-sm">
            <a
              href={LEGAL_DOCUMENT_PATHS.tos}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              data-testid="supplier-tos-read"
            >
              {t('supplier.activation.terms.read')}
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
