import { Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SupplierOptionCardProps {
  /** Supplier registration page (self-serve for the pilot comuni, otherwise by invite only). */
  onRegister: () => void;
  /** Claim of a supplier profile registered before the account was created. */
  onClaim: () => void;
}

/**
 * "Sono un fornitore" in the host onboarding (SU-02, A4-02): a user who arrives without an invite or claim token is
 * not a host and must not be pushed into a host org. The registration page applies the pilot comuni rule.
 */
export function SupplierOptionCard({ onRegister, onClaim }: SupplierOptionCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="mx-auto max-w-3xl text-left" data-testid="onboarding-supplier-option">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wrench className="h-6 w-6" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <CardTitle>{t('onboarding.supplierOption.title')}</CardTitle>
          <CardDescription>{t('onboarding.supplierOption.description')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={onRegister} data-testid="onboarding-supplier-register">
          {t('onboarding.supplierOption.register')}
        </Button>
        <Button type="button" variant="link" onClick={onClaim} data-testid="onboarding-supplier-claim">
          {t('onboarding.supplierOption.claim')}
        </Button>
      </CardContent>
    </Card>
  );
}
