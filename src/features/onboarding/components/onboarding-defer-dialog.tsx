import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getProblemMessage } from '@/lib/api-errors';
import { deferOptions, partTitleKey, type DeferChoice } from '@/lib/onboarding-parts';
import { useDeferPart } from '@/queries/use-onboarding-plan';
import type { OnboardingPart } from '@/types/onboarding.types';

const DEFAULT_CHOICE: DeferChoice = 'tomorrow';

interface DeferFormProps {
  part: OnboardingPart;
  onClose: () => void;
}

function DeferForm({ part, onClose }: DeferFormProps) {
  const { t } = useTranslation();
  const defer = useDeferPart();
  const [options] = useState(() => deferOptions());
  const [choice, setChoice] = useState<DeferChoice>(DEFAULT_CHOICE);
  const selected = options.find((option) => option.choice === choice) ?? options[0];

  function confirm() {
    if (!selected || defer.isPending) return;
    defer.mutate(
      { key: part.code, remindAt: selected.remindAt },
      {
        onSuccess: () => {
          toast.success(t('onboardingPlan.defer.toast'));
          onClose();
        },
      },
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('onboardingPlan.defer.title')}</DialogTitle>
        <DialogDescription>{t('onboardingPlan.defer.description', { part: t(partTitleKey(part.code)) })}</DialogDescription>
      </DialogHeader>

      <ChoiceGroup legend={t('onboardingPlan.defer.legend')} minCardWidth={9}>
        {options.map((option) => (
          <ChoiceCard
            key={option.choice}
            name="onboarding-defer-when"
            value={option.choice}
            checked={selected?.choice === option.choice}
            onChange={() => setChoice(option.choice)}
            title={t(`onboardingPlan.defer.options.${option.choice}`)}
            data-testid={`onboarding-defer-${option.choice}`}
          />
        ))}
      </ChoiceGroup>

      {defer.isError ? (
        <p role="alert" className="text-sm text-destructive" data-testid="onboarding-defer-error">
          {getProblemMessage(defer.error, t) ?? t('onboardingPlan.defer.error')}
        </p>
      ) : null}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={defer.isPending}>
          {t('shared.cancel')}
        </Button>
        <Button type="button" className="min-h-11" onClick={confirm} loading={defer.isPending} data-testid="onboarding-defer-confirm">
          {t('onboardingPlan.defer.confirm')}
        </Button>
      </DialogFooter>
    </>
  );
}

interface OnboardingDeferDialogProps {
  part: OnboardingPart | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingDeferDialog({ part, open, onOpenChange }: OnboardingDeferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="onboarding-defer-dialog">
        {part ? <DeferForm part={part} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
