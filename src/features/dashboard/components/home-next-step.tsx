import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NextStepCard } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ActivationChecklist } from '@/features/onboarding/components/activation-checklist';
import { useWorkspace } from '@/hooks/use-workspace';
import { activationStepDetail } from '@/lib/activation-labels';
import { activationStepCtaKey, activationStepLinkState, activationStepRoute } from '@/lib/activation-routes';
import { nextActionableStep, normalizeSteps } from '@/lib/activation-steps';
import { useOnboardingStatus } from '@/queries/use-onboarding-status';

/**
 * "Il prossimo passo": the next step of the activation checklist, alone, with its button and how far the host is; the whole
 * list opens from "Tutti i passi". Once every step is done there is nothing left to say and the card is not there.
 */
export function HomeNextStep() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const status = useOnboardingStatus();
  const [listOpen, setListOpen] = useState(false);

  const steps = normalizeSteps(status.data);
  const next = nextActionableStep(steps);
  if (!next) return null;
  const route = activationStepRoute(next, hasPermission);

  return (
    <section className="min-w-0 space-y-2" data-testid="home-next-step">
      <NextStepCard
        kicker={t('activation.next.kicker')}
        title={t(`activation.steps.${next.key}.title`)}
        detail={activationStepDetail(next, t, (key) => i18n.exists(key))}
        position={t('activation.next.position', { current: steps.findIndex((step) => step.key === next.key) + 1, total: steps.length })}
        cta={route ? { label: t(activationStepCtaKey(next)), href: route, state: activationStepLinkState(next), testId: 'activation-next-step-cta' } : undefined}
        data-testid="activation-next-step"
      />
      <Button type="button" variant="ghost" size="sm" className="h-auto min-h-11" onClick={() => setListOpen(true)} data-testid="home-next-step-all">
        {t('dashboard.nextStep.all')}
      </Button>
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="sm:max-h-[90dvh] sm:max-w-xl sm:overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>{t('activation.title')}</DialogTitle>
            <DialogDescription>{t('activation.next.intro')}</DialogDescription>
          </DialogHeader>
          <ActivationChecklist />
        </DialogContent>
      </Dialog>
    </section>
  );
}
