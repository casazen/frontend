import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { OctoratePanelStep } from '@/features/onboarding/components/octorate-panel-step';
import { PanelStepInstructions } from '@/features/onboarding/components/panel-step-instructions';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { senderPanelResume } from '../sender-wizard-model';

interface SenderPanelStepProps {
  propertyId: string;
  /** The connection was seen by CasaZen (or the person confirmed it after CasaZen could not tell): the wizard goes on to the test. */
  onContinue: () => void;
  /** «Salva ed esci»: the guided step stays as it is (its «Da fare» is already there) and so does the draft of the wizard. */
  onSaveAndExit: () => void;
}

/**
 * The passage on the panel of the channel manager, which is the one thing that cannot be done from CasaZen: the police connection (the credentials of Alloggiati Web, the web service key, the room
 * number of each room, the connection test, «Attivato» and the daily automatic send). The wizard builds no passage of its own: it mounts the guided panel step of the activation (E10/F03/US02/T01), for the
 * police connection of this property, and tells it which point of this wizard to come back to (the draft of the property, this step), so that the person returns to the same step in the same tab. Before it
 * starts the step says that the functions of compliance of the channel manager can need its management module, which is paid (D17).
 *
 * The guided steps are the organization administrator's and behind their flag: for anyone else, or while the flag is off, the step shows the instructions and goes on to the test, which says the truth
 * either way. The channel manager is «il tuo channel manager»: its name is not on this screen.
 */
export function SenderPanelStep({ propertyId, onContinue, onSaveAndExit }: SenderPanelStepProps) {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();
  const { flags } = useFeatureFlags();
  const available = flags.octorateOnboarding && isOrgBillingAdmin(contexts);

  return (
    <div className="flex flex-col gap-4" data-testid="sender-panel-step">
      <Alert variant="info" data-testid="sender-panel-module-note">
        {t('compliance.sender.panel.moduleNote')}
      </Alert>
      {available ? (
        <OctoratePanelStep
          kind="policeConnection"
          propertyId={propertyId}
          resume={senderPanelResume(propertyId)}
          onRecovered={onContinue}
          onSaveAndExit={onSaveAndExit}
        />
      ) : (
        <div className="space-y-4" data-testid="sender-panel-manual">
          <p className="break-words text-sm" data-testid="sender-panel-manual-reason">
            {t(flags.octorateOnboarding ? 'onboardingPlan.panel.adminOnly' : 'compliance.sender.panel.unavailable')}
          </p>
          <PanelStepInstructions kind="police" />
        </div>
      )}
    </div>
  );
}
