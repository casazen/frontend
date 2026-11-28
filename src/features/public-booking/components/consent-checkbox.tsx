import { Link } from 'react-router-dom';
import { Trans } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { orgDocumentPath } from '@/lib/org-document-paths';

interface ConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  orgSlug: string;
}

const LINK_CLASS = 'public-site-link';

export function ConsentCheckbox({ checked, onCheckedChange, orgSlug }: ConsentCheckboxProps) {
  const newTab = { target: '_blank', rel: 'noopener noreferrer' } as const;

  return (
    <div className="flex items-start gap-3 rounded-md border p-4" data-testid="gdpr-consent">
      <Checkbox
        id="data-consent"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <div className="space-y-1 text-sm leading-relaxed">
        <Label htmlFor="data-consent" className="cursor-pointer text-sm leading-relaxed">
          <Trans
            i18nKey="publicBooking.gdprConsentText"
            components={{
              privacy: (
                <Link
                  to={orgDocumentPath(orgSlug, 'privacy')}
                  className={LINK_CLASS}
                  data-testid="consent-privacy-link"
                  {...newTab}
                />
              ),
            }}
          />
        </Label>
        <p className="text-[var(--cz-public-muted)]">
          <Trans
            i18nKey="publicBooking.termsNote"
            components={{
              terms: (
                <Link
                  to={orgDocumentPath(orgSlug, 'terms')}
                  className={LINK_CLASS}
                  data-testid="consent-terms-link"
                  {...newTab}
                />
              ),
            }}
          />
        </p>
      </div>
    </div>
  );
}
