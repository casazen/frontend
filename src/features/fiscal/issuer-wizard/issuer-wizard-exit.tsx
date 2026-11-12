import { useTranslation } from 'react-i18next';
import { CircleHelp } from 'lucide-react';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supportConfig } from '@/config/support.config';
import { ISSUER_STEPS, type IssuerStepId } from './issuer-wizard-schema';

interface StepHelp {
  step: IssuerStepId;
  helpKey: string;
}

/** What each step is for and how to answer it, in two sentences. The keys are written out so that the i18n test finds a missing translation. */
const HELP: readonly StepHelp[] = [
  { step: ISSUER_STEPS.who, helpKey: 'fiscalDocuments.issuer.help.who' },
  { step: ISSUER_STEPS.regime, helpKey: 'fiscalDocuments.issuer.help.regime' },
  { step: ISSUER_STEPS.issuer, helpKey: 'fiscalDocuments.issuer.help.issuer' },
  { step: ISSUER_STEPS.address, helpKey: 'fiscalDocuments.issuer.help.address' },
  { step: ISSUER_STEPS.summary, helpKey: 'fiscalDocuments.issuer.help.summary' },
];

interface IssuerWizardExitProps {
  /** Leaves the wizard: what was answered stays as the draft of the wizard, and nothing is changed on the server. */
  onSaveAndExit: () => void;
}

/**
 * «Aiuto» and «Salva ed esci», on every step (NF-06). The help opens over the wizard and says what the step is for, and how to reach the
 * support: it never takes the person to another page (NF-02). «Salva ed esci» is the way out that keeps the answers.
 */
export function IssuerWizardExit({ onSaveAndExit }: IssuerWizardExitProps) {
  const { t } = useTranslation();
  const stepId = useOptionalWizard()?.stepId;
  const helpKey = (HELP.find((entry) => entry.step === stepId) ?? HELP[0]).helpKey;
  const supportEmail = supportConfig.email;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-testid="fiscal-issuer-exit-bar">
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="min-h-11" data-testid="fiscal-issuer-help">
            <CircleHelp aria-hidden="true" className="size-4" />
            {t('fiscalDocuments.issuer.help.button')}
          </Button>
        </DialogTrigger>
        <DialogContent data-testid="fiscal-issuer-help-dialog">
          <DialogHeader>
            <DialogTitle>{t('fiscalDocuments.issuer.help.title')}</DialogTitle>
            <DialogDescription>{t(helpKey)}</DialogDescription>
          </DialogHeader>
          <p className="break-words text-sm">
            {supportEmail ? (
              <>
                {t('fiscalDocuments.issuer.help.supportWithEmail')}{' '}
                <a className="font-medium underline underline-offset-4" href={`mailto:${supportEmail}`}>
                  {supportEmail}
                </a>
              </>
            ) : (
              t('fiscalDocuments.issuer.help.supportGeneric')
            )}
          </p>
        </DialogContent>
      </Dialog>
      <Button type="button" variant="ghost" size="sm" className="ml-auto min-h-11" onClick={onSaveAndExit} data-testid="fiscal-issuer-save-exit">
        {t('fiscalDocuments.issuer.exit.saveAndExit')}
      </Button>
    </div>
  );
}
