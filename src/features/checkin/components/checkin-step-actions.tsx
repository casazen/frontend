import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { useSubmitGuestCheckIn } from '@/queries/use-checkin';
import { STEP_CONSENTS, STEP_IDENTITY } from '../lib/checkin-steps';
import type { useIdentityVerification } from '../use-identity-verification';

/** The way back, and the way on (or the send, at the last step). */
export function CheckInStepActions({ steps, stepIndex, current, identity, taxPaying, taxBlocksNext, goToStep, goNext, submitCheckIn, consentsGiven }: {
  steps: readonly number[];
  stepIndex: number;
  current: number;
  identity: ReturnType<typeof useIdentityVerification>;
  taxPaying: boolean;
  taxBlocksNext: boolean;
  goToStep: (step: number) => void;
  goNext: () => Promise<void>;
  submitCheckIn: ReturnType<typeof useSubmitGuestCheckIn>;
  consentsGiven: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between pt-4">
      <Button type="button" variant="outline" onClick={() => goToStep(steps[Math.max(0, stepIndex - 1)])} disabled={identity.busy || taxPaying}>
        <ChevronLeft className="mr-1 h-4 w-4" />{t('checkin.back')}
      </Button>
      {current !== STEP_CONSENTS ? (
        // Own key: the same DOM button must not turn from "button" to "submit" during the click that moves
        // to the last step, or the browser submits the form and the privacy notice is never shown.
        <Button
          key="checkin-next"
          type="button"
          onClick={goNext}
          disabled={(current === STEP_IDENTITY && (!identity.concluded || identity.busy)) || taxBlocksNext || taxPaying}
          data-testid="checkin-next"
        >
          {t('checkin.next')}<ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      ) : (
        <Button
          key="checkin-submit"
          type="submit"
          disabled={submitCheckIn.isPending || !consentsGiven}
          aria-describedby={consentsGiven ? undefined : 'checkin-submit-hint'}
          data-testid="checkin-submit"
        >
          {submitCheckIn.isPending ? t('checkin.saving') : t('checkin.submit')}
        </Button>
      )}
    </div>
  );
}
