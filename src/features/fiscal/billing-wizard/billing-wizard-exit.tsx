import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CircleHelp } from 'lucide-react';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supportConfig } from '@/config/support.config';
import { BILLING_STEPS } from './billing-wizard-ids';
import type { BillingWizardValues } from './billing-wizard-schema';

/** What each step is for and how to answer it, in two sentences. The keys are written out so that the i18n test finds a missing translation. */
const HELP: Readonly<Record<string, string>> = {
  [BILLING_STEPS.issuer]: 'billingWizard.help.issuer',
  [BILLING_STEPS.vat]: 'billingWizard.help.vat',
  [BILLING_STEPS.numbering]: 'billingWizard.help.numbering',
  [BILLING_STEPS.touristTax]: 'billingWizard.help.touristTax',
  [BILLING_STEPS.channels]: 'billingWizard.help.channels',
  [BILLING_STEPS.mandate]: 'billingWizard.help.mandate',
  [BILLING_STEPS.issuing]: 'billingWizard.help.issuing',
  [BILLING_STEPS.italy]: 'billingWizard.help.italy',
  [BILLING_STEPS.summary]: 'billingWizard.help.summary',
};

interface BillingWizardExitProps {
  /**
   * Keeps what the step on screen holds, as a draft on the server (what is valid, not empty and changed since the step opened: nothing the person did not answer, and no
   * proposal left as it was, is saved as an answer), and leaves. It resolves `true` when the person may go; on `false` the wizard stays where it is and says why, so that
   * nothing typed is lost.
   */
  onSaveAndExit: (values: BillingWizardValues, stepId: string) => Promise<boolean>;
  /** A request of the person is on its way (the save of a step, the application of the mandate): the way out waits for it. */
  disabled?: boolean;
}

/**
 * «Aiuto» and «Salva ed esci», on every step (NF-06). The help opens over the wizard and says what the step is for and how to reach the support: it never takes the person to
 * another page (NF-02). «Salva ed esci» is the way out that keeps the answers on the server, so that the part «Fatturazione» of the guide says how far it is and the wizard
 * reopens at the step that is missing, from any device. While it saves it takes no second press.
 */
export function BillingWizardExit({ onSaveAndExit, disabled = false }: BillingWizardExitProps) {
  const { t } = useTranslation();
  const form = useFormContext<BillingWizardValues>();
  const stepId = useOptionalWizard()?.stepId ?? BILLING_STEPS.issuer;
  const [saving, setSaving] = useState(false);
  const supportEmail = supportConfig.email;

  const leave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSaveAndExit(form.getValues(), stepId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-testid="billing-exit-bar">
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="min-h-11" data-testid="billing-help">
            <CircleHelp aria-hidden="true" className="size-4" />
            {t('billingWizard.help.button')}
          </Button>
        </DialogTrigger>
        <DialogContent data-testid="billing-help-dialog">
          <DialogHeader>
            <DialogTitle>{t('billingWizard.help.title')}</DialogTitle>
            <DialogDescription>{t(HELP[stepId] ?? HELP[BILLING_STEPS.issuer])}</DialogDescription>
          </DialogHeader>
          <p className="break-words text-sm">
            {supportEmail ? (
              <>
                {t('billingWizard.help.supportWithEmail')}{' '}
                <a className="font-medium underline underline-offset-4" href={`mailto:${supportEmail}`}>
                  {supportEmail}
                </a>
              </>
            ) : (
              t('billingWizard.help.supportGeneric')
            )}
          </p>
        </DialogContent>
      </Dialog>
      <Button type="button" variant="ghost" size="sm" className="ml-auto min-h-11" loading={saving} disabled={saving || disabled} onClick={() => void leave()} data-testid="billing-save-exit">
        {t('billingWizard.exit.saveAndExit')}
      </Button>
    </div>
  );
}
