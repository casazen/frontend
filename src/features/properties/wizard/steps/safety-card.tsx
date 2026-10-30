import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { SafetyChecklistForm } from '@/features/compliance/components/safety-checklist-form';
import { useSafetyChecklist } from '@/features/compliance/use-compliance';
import { SAFETY_ITEM_CODES } from '@/types/compliance.types';

/**
 * «Sicurezza» (SR-07b, step 3): how far the safety sheet of the property is, as the server evaluates it, and the sheet itself in a
 * dialog. The form is the one of the activation wizard, with its texts untouched (the normative ones are under review of the PO:
 * D32): this card only opens it. An item counts when it is in order or does not apply to the property; nothing is added up here
 * that the server did not already say.
 */
export function SafetyCard({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const checklist = useSafetyChecklist(propertyId);

  const total = SAFETY_ITEM_CODES.length;
  // An answer that is not a sheet (no list of items) is as good as no answer: the card says it cannot read it, it does not break the step.
  const items = Array.isArray(checklist.data?.items) ? checklist.data.items : null;
  const unreadable = checklist.isError || (checklist.isSuccess && items === null);
  const done = items ? items.filter((item) => item.status === 'Present' || item.status === 'NotApplicable').length : 0;
  const complete = checklist.data?.isComplete === true;

  return (
    <section aria-labelledby="property-wizard-safety" className="min-w-0 space-y-3 rounded-lg bg-muted p-4" data-testid="property-wizard-safety">
      <div className="flex min-w-0 items-start gap-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-foreground/70" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 id="property-wizard-safety" className="text-base font-semibold">
            {t('propertyWizard.amenities.safety.title')}
          </h3>
          <p className="text-sm text-foreground/70">{t('propertyWizard.amenities.safety.description')}</p>
        </div>
      </div>

      {unreadable ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {t('propertyWizard.amenities.safety.loadFailed')}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium" data-testid="property-wizard-safety-progress">
            {checklist.isPending
              ? t('propertyWizard.amenities.safety.loading')
              : complete
                ? t('propertyWizard.amenities.safety.complete')
                : t('propertyWizard.amenities.safety.progress', { done, total })}
          </p>
          <Progress
            value={items ? (done / total) * 100 : 0}
            tone={complete ? 'success' : 'default'}
            size="sm"
            label={t('propertyWizard.amenities.safety.progressLabel')}
            valueText={t('propertyWizard.amenities.safety.progress', { done, total })}
          />
        </div>
      )}

      <Button type="button" variant={complete ? 'outline' : 'default'} onClick={() => setOpen(true)} data-testid="property-wizard-safety-open">
        {complete ? t('propertyWizard.amenities.safety.review') : t('propertyWizard.amenities.safety.open')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-h-[90vh] sm:max-w-3xl sm:overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('propertyWizard.amenities.safety.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('propertyWizard.amenities.safety.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <SafetyChecklistForm propertyId={propertyId} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
