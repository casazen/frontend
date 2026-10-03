import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { useAcceptSupplierTos } from '@/queries/use-supplier';
import type { SupplierTos } from '@/types/supplier';
import { ActivationTermsCard } from './activation-terms-card';

/**
 * Re-acceptance of the Terms of Service by an active supplier (SU-05, A4-31): shown instead of the wizard when the version
 * the supplier accepted is not the current one. Accepting records version, time and IP and keeps the profile active.
 */
export function TosReacceptance({ tos }: { tos: SupplierTos }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const accept = useAcceptSupplierTos();
  const [checked, setChecked] = useState(false);

  const handleAccept = async () => {
    try {
      await accept.mutateAsync(tos.currentVersion);
      toast.success(t('supplier.activation.reaccept.done'));
      navigate('/app/supplier/dashboard', { replace: true });
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('supplier.activation.reaccept.error'));
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6" data-testid="supplier-tos-reacceptance">
      <PageHeader
        title={t('supplier.activation.reaccept.title')}
        description={
          tos.acceptedVersion
            ? t('supplier.activation.reaccept.description')
            : t('supplier.activation.reaccept.descriptionLegacy')
        }
      />
      <ActivationTermsCard
        version={tos.currentVersion}
        checked={checked}
        onCheckedChange={setChecked}
        disabled={accept.isPending}
      />
      <Button className="w-full" disabled={!checked || accept.isPending} onClick={() => void handleAccept()}>
        {t('supplier.activation.reaccept.button')}
      </Button>
    </div>
  );
}
