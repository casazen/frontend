import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LEGAL_DOCUMENT_PATHS } from '@/features/legal/legal-paths';

interface ActivationTermsCardProps {
  /** The version in force (`tos.currentVersion`): what the supplier is shown and what the API checks. */
  version: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Acceptance of the Terms of Service: names the version and links the published text (new tab, the page stays open). */
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
