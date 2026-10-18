import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface SupplierEntryLinkProps {
  /** Supplier registration page (self-serve in any comune of the official list). */
  onRegister: () => void;
  /** Claim of a supplier profile registered before the account was created. */
  onClaim: () => void;
}

/**
 * "Are you a supplier?" under the host choice (SU-02, A4-02): a supplier arrives from its own link (`/register`, invite, QR),
 * so this is only the way out for someone who landed here by mistake. A quiet line, never a card that competes with the
 * host choice; a user without an invite or claim must not be pushed into a host org.
 */
export function SupplierEntryLink({ onRegister, onClaim }: SupplierEntryLinkProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-xl space-y-1 text-sm text-muted-foreground" data-testid="onboarding-supplier-option">
      <p>{t('onboarding.supplierOption.question')}</p>
      <div className="flex flex-wrap items-center justify-center gap-x-4">
        <Button type="button" variant="link" className="h-auto p-0" onClick={onRegister} data-testid="onboarding-supplier-register">
          {t('onboarding.supplierOption.register')}
        </Button>
        <Button type="button" variant="link" className="h-auto p-0" onClick={onClaim} data-testid="onboarding-supplier-claim">
          {t('onboarding.supplierOption.claim')}
        </Button>
      </div>
    </div>
  );
}
