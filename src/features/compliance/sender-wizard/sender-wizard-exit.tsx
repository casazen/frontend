import { useTranslation } from 'react-i18next';
import { CircleHelp } from 'lucide-react';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supportConfig } from '@/config/support.config';
import { SENDER_STEP, type SenderStepId } from './sender-wizard-model';

/** What each step is for and how to answer it, in two sentences. The keys are written out so that the i18n test finds a missing translation. */
const HELP: Readonly<Record<SenderStepId, string>> = {
  [SENDER_STEP.choice]: 'compliance.sender.help.choice',
  [SENDER_STEP.summary]: 'compliance.sender.help.summary',
  [SENDER_STEP.credentials]: 'compliance.sender.help.credentials',
  [SENDER_STEP.panel]: 'compliance.sender.help.panel',
  [SENDER_STEP.test]: 'compliance.sender.help.test',
};

interface SenderWizardExitProps {
  /** Leaves the wizard: what was answered stays as the draft of the wizard (on the server too), and nothing is changed by leaving. */
  onSaveAndExit: () => void;
}

/**
 * «Aiuto» and «Salva ed esci», on every step (NF-06). The help opens over the wizard and says what the step is for and how to reach the support: it never takes the person
 * to another page (NF-02). «Salva ed esci» is the way out that keeps the answers; the credentials are the one thing it does not keep, because they are never saved as a draft.
 */
export function SenderWizardExit({ onSaveAndExit }: SenderWizardExitProps) {
  const { t } = useTranslation();
  const stepId = useOptionalWizard()?.stepId;
  const helpKey = (Object.hasOwn(HELP, stepId ?? '') ? HELP[stepId as SenderStepId] : HELP[SENDER_STEP.choice]) as string;
  const supportEmail = supportConfig.email;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-testid="sender-wizard-exit-bar">
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="min-h-11" data-testid="sender-wizard-help">
            <CircleHelp aria-hidden="true" className="size-4" />
            {t('compliance.sender.help.button')}
          </Button>
        </DialogTrigger>
        <DialogContent data-testid="sender-wizard-help-dialog">
          <DialogHeader>
            <DialogTitle>{t('compliance.sender.help.title')}</DialogTitle>
            <DialogDescription>{t(helpKey)}</DialogDescription>
          </DialogHeader>
          <p className="break-words text-sm">
            {supportEmail ? (
              <>
                {t('compliance.sender.help.supportWithEmail')}{' '}
                <a className="font-medium underline underline-offset-4" href={`mailto:${supportEmail}`}>
                  {supportEmail}
                </a>
              </>
            ) : (
              t('compliance.sender.help.supportGeneric')
            )}
          </p>
        </DialogContent>
      </Dialog>
      <Button type="button" variant="ghost" size="sm" className="ml-auto min-h-11" onClick={onSaveAndExit} data-testid="sender-wizard-save-exit">
        {t('compliance.sender.exit.saveAndExit')}
      </Button>
    </div>
  );
}
