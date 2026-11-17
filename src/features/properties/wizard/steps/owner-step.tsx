import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OwnerImportPanel } from '@/features/onboarding/components/owner-import-panel';
import { useOwnerReadiness } from '@/queries/use-owner-onboarding';
import { propertyHasOwner } from '../owner-step-model';

/** Assignment stays in the property flow; the existing checked import is portalled outside the wizard's form. */
export function OwnerStep({ propertyId, canAssign }: { propertyId: string; canAssign: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const readiness = useOwnerReadiness(true, propertyId);
  const ready = !readiness.isError && readiness.data && propertyHasOwner(readiness.data, propertyId);
  return (
    <section className="space-y-5" data-testid="property-owner-step">
      <Alert variant={ready ? 'success' : 'info'}>
        {t(ready ? 'propertyWizard.owner.ready' : canAssign ? 'propertyWizard.owner.required' : 'propertyWizard.owner.adminRequired')}
      </Alert>
      {readiness.isError ? <Alert variant="danger">{t('propertyWizard.owner.loadError')}</Alert> : null}
      <div className="flex flex-wrap gap-3">
        {canAssign ? <Button type="button" onClick={() => setOpen(true)}>{t('propertyWizard.owner.assign')}</Button> : null}
        <Button type="button" variant="outline" loading={readiness.isFetching} onClick={() => void readiness.refetch()}>{t('shared.errorState.retry')}</Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl" onSubmit={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t('propertyWizard.owner.title')}</DialogTitle>
            <DialogDescription>{t('propertyWizard.owner.purpose')}</DialogDescription>
          </DialogHeader>
          <OwnerImportPanel propertyRef={propertyId} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
