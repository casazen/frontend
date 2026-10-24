import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { leaseEditPath } from '../wizard/wizard-model';

/**
 * A draft is the contract itself, saved on the server as it is typed (LR-06a): the sheet offers to go on with it, from the first step
 * that is not done, on this device or on another.
 */
export function ContinueDraftNotice({ leaseId }: { leaseId: string }) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} data-testid="lease-continue-draft" className="space-y-3 rounded-lg bg-primary/5 p-4 ring-1 ring-primary/30">
      <h2 id={titleId} className="text-lg font-semibold">
        {t('leaseWizard.continue.title')}
      </h2>
      <p className="text-sm">{t('leaseWizard.continue.description')}</p>
      <Button asChild data-testid="lease-continue-draft-button">
        <Link to={leaseEditPath(leaseId)}>{t('leaseWizard.continue.action')}</Link>
      </Button>
    </section>
  );
}
