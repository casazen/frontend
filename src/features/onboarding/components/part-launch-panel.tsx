import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ResolvedLaunch } from '@/lib/onboarding-part-launch';
import { ONBOARDING_PLAN_PATH } from '@/lib/onboarding-parts';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface PartLaunchPanelProps {
  /** The page that does the part, resolved against the manifest; `null` when no page is registered (yet) or the person may not open it. */
  launch: ResolvedLaunch | null;
  /** «Riprendi» for a part that was started, «Fai ora» for one that was not. */
  resuming: boolean;
  /** The part has nothing to do: it is done, or nobody provides it, or it waits for another one: no way in, and the part says why instead. */
  blocked?: boolean;
}

/**
 * The one launch panel of a part (E10/F03/US02/T02, NF-104): one primary button that opens the wizard that owns the part, in the same tab; a part whose
 * page does not exist yet (or that the person may not open) says «Non ancora disponibile» and why, with no dead link; «Torna al piano» is always there.
 * The onboarding never re-implements a wizard: it shows where it lives.
 */
export function PartLaunchPanel({ launch, resuming, blocked = false }: PartLaunchPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="min-w-0 space-y-3" aria-label={t('onboardingPlan.launch.panelLabel')} data-testid="part-launch-panel">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!blocked && launch ? (
          <Button asChild className={TOUCH_TARGET} iconRight={<ArrowRight />}>
            <Link to={launch.to} data-testid="part-launch-primary">
              {t(resuming ? 'onboardingPlan.actions.resume' : 'onboardingPlan.actions.doNow')}
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="ghost" className={TOUCH_TARGET}>
          <Link to={ONBOARDING_PLAN_PATH} data-testid="part-launch-back">
            {t('onboardingPlan.launch.backToPlan')}
          </Link>
        </Button>
      </div>
      {!blocked && !launch ? (
        <div className="space-y-1 rounded-md bg-muted p-3 text-sm" data-testid="part-launch-unavailable">
          <p className="font-medium">{t('onboardingPlan.launch.unavailable.title')}</p>
          <p className="text-foreground/70">{t('onboardingPlan.launch.unavailable.reason')}</p>
        </div>
      ) : null}
    </section>
  );
}
