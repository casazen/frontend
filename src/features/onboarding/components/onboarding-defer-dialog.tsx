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

/** The reminder the server uses when none is chosen, and the one offered first: tomorrow at 09:00. */
const DEFAULT_CHOICE: DeferChoice = 'tomorrow';

interface DeferFormProps {
  part: OnboardingPart;
  onClose: () => void;
}

function DeferForm({ part, onClose }: DeferFormProps) {
  const { t } = useTranslation();
  const defer = useDeferPart();
  // The moments are worked out when the window opens (this evening is offered only while it is still to come), not at every render.
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
        // The server says why in the language of the person (a part another part waits for, a part that is done meanwhile): the window stays open.
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
  /** The part to put off. It stays set while the window closes, so the content does not empty out during the fade. */
  part: OnboardingPart | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * «Lo faccio dopo» (UX-06, ONB-01): when to be reminded of a part put off, in three choices on the clock of Rome (this evening at 20:00,
 * tomorrow at 09:00, in a week at 09:00), and a confirmation. The part goes to «Da fare» with that deadline (`deferPart`), the answer is a
 * toast that says where it is, and the plan reads again. The window shows its form only while open, so a choice is forgotten when it closes.
 * It is not a form on purpose: the window is drawn outside the page but sits inside it for React, and a submit would reach a form around the page.
 */
export function OnboardingDeferDialog({ part, open, onOpenChange }: OnboardingDeferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="onboarding-defer-dialog">
        {part ? <DeferForm part={part} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
