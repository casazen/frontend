import { useTranslation } from 'react-i18next';
import { ChecklistCompact } from '@/components/shared/calm';
import { ONBOARDING_PLAN_PATH, knownParts, partPath, pathStepTitleKey, stepTargetPart } from '@/lib/onboarding-parts';
import { useVisibleOnboardingPath } from '@/queries/use-onboarding-path';
import { useOnboardingPlan } from '@/queries/use-onboarding-plan';

/**
 * «Inizia con CasaZen» on the home of the host, while the path is incomplete (UX-10, NF-10): the wizards of the activation as one path, in one
 * line: how many of its steps are done («2 di 6»), the next one («Prossimo: Controlla gli annunci») with «Continua», which opens the part
 * of that step that is still to do and can be done now (none when they all wait for another part), and «Tutti i passi», which opens the
 * plan. It is the `ChecklistCompact` of the calm blocks, so it is the
 * one block of the home that tells the setup: the home shows it INSTEAD of the next step of the activation checklist, never both.
 *
 * It renders nothing while the flag `octorateOnboarding` is off, for anyone who is not an organization administrator (putting a step off is
 * their decision), while it loads, when the path cannot be read and once the path is complete.
 */
export function OnboardingPathCard() {
  const { t } = useTranslation();
  const { path } = useVisibleOnboardingPath();
  const next = path?.next ?? null;
  // The step is made of parts and only the plan tells which one is still to do: «Continua» waits for it (or for its failure: then it opens the first part).
  const plan = useOnboardingPlan({ enabled: next !== null });

  if (!path || (next !== null && plan.isPending)) return null;

  // Only parts that wait for another one are left in the step (the server names such a step when what it waits for is not provided): the card
  // says which step is next and offers no «Continua», since the plan page gives those parts no way in either.
  const target = next ? stepTargetPart(next, knownParts(plan.data)) : null;
  const progress = t('onboardingPlan.path.progress', { done: path.done, total: path.total });

  return (
    <ChecklistCompact
      data-testid="onboarding-path-card"
      title={t('onboardingPlan.path.title')}
      done={path.done}
      total={path.total}
      progress={progress}
      progressLabel={t('onboardingPlan.path.progressLabel')}
      next={next ? t('onboardingPlan.path.next', { step: t(pathStepTitleKey(next.code)) }) : undefined}
      primary={target ? { label: t('onboardingPlan.path.continue'), href: partPath(target), testId: 'onboarding-path-continue' } : undefined}
      secondary={{ label: t('onboardingPlan.path.all'), href: ONBOARDING_PLAN_PATH, testId: 'onboarding-path-all' }}
    />
  );
}
