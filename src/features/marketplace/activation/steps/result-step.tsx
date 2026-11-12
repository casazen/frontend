import { useTranslation } from 'react-i18next';
import { CheckCircle2, Wrench } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { translateErrorCode } from '@/lib/api-errors';
import { MARKETPLACE_MINE_PATH, marketplaceHref } from '../../lib/marketplace-paths';
import {
  propertyNameOf,
  resultCounts,
  stepToFix,
  type ActivationContext,
  type ActivationOutcome,
  type ActivationStepId,
} from '../activation-wizard-model';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface ResultStepProps {
  context: ActivationContext;
  /** How each property ended; `null` when the screen is opened again (a reload): the wizard is over and there is nothing to report but where to look. */
  outcomes: readonly ActivationOutcome[] | null;
  /** Where the closing button leads: the page the wizard was opened from, else the Marketplace. */
  exitPath: string;
  /** Opens the wizard at the step that failed, for that property. */
  onFix: (propertyId: string, step: ActivationStepId) => void;
}

/**
 * The result of the activation (E09/F02/US04/T02, UX-05 point 2, UX-10): one line for each property, Active or To fix with the reason in simple words and a «Correggi»
 * that opens the wizard at the step that failed; what CasaZen does by itself and when; and one next step. The closing button goes where the wizard was opened from.
 * A property is shown as Active only when the server said so after the last step.
 */
export function ResultStep({ context, outcomes, exitPath, onFix }: ResultStepProps) {
  const { t } = useTranslation();
  const name = context.channelName ?? t('marketplace.activation.thisChannel');
  const counts = outcomes ? resultCounts(outcomes) : null;
  const firstProperty = outcomes?.[0]?.propertyId;

  const title =
    counts === null
      ? t('marketplace.activation.result.title.over')
      : counts.toFix === 0
        ? t('marketplace.activation.result.title.allActive')
        : counts.active === 0
          ? t('marketplace.activation.result.title.allToFix')
          : t('marketplace.activation.result.title.some');

  return (
    <div data-testid="activation-result">
      <WizardDone
        title={title}
        description={counts === null ? undefined : t('marketplace.activation.result.counts', { name, active: counts.active, toFix: counts.toFix })}
        lead={counts === null ? t('marketplace.activation.result.over', { name }) : undefined}
        whatNext={[
          { text: t('marketplace.activation.result.whatNext.checks') },
          { text: t('marketplace.activation.result.whatNext.todo'), icon: Wrench },
        ]}
        primary={{ label: t('marketplace.activation.result.close'), to: exitPath }}
        secondary={{ label: t('marketplace.activation.result.seeActive'), to: marketplaceHref(MARKETPLACE_MINE_PATH, firstProperty) }}
      >
        {outcomes ? (
          <ul className="space-y-3" role="list" data-testid="activation-result-list">
            {outcomes.map((outcome) => {
              const toFix = outcome.status === 'ToFix';
              const target = stepToFix(outcome.errorCode);
              return (
                <li key={outcome.propertyId} className="min-w-0 space-y-2 rounded-lg border p-4" data-testid={`activation-result-${outcome.propertyId}`} data-status={outcome.status}>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 break-words font-medium">{propertyNameOf(context.properties, outcome.propertyId) ?? outcome.propertyId}</p>
                    <Badge variant={toFix ? 'destructive' : 'success'} className="gap-1 whitespace-nowrap">
                      {toFix ? null : <CheckCircle2 aria-hidden="true" className="size-3.5" />}
                      {t(toFix ? 'marketplace.status.ToFix' : 'marketplace.status.Active')}
                    </Badge>
                  </div>
                  {toFix ? (
                    <div className="space-y-2" data-testid={`activation-result-${outcome.propertyId}-problem`}>
                      <p className="text-sm">{translateErrorCode(outcome.errorCode, t) ?? t('marketplace.activation.result.reason')}</p>
                      <Button type="button" size="sm" className={TOUCH_TARGET} onClick={() => onFix(outcome.propertyId, target)} data-testid={`activation-result-${outcome.propertyId}-fix`}>
                        {t('marketplace.activation.result.fix')}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </WizardDone>
    </div>
  );
}
