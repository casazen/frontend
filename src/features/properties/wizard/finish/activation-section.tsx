import type { UseFormReturn } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { PropertyWizardValues } from '../property-wizard-model';
import type { FinishStage } from './finish-model';

interface ActivationSectionProps {
  form: UseFormReturn<PropertyWizardValues>;
  stage: FinishStage;
  tosAccepted: boolean;
  onTosChange: (accepted: boolean) => void;
}

/**
 * The end of the wizard (SR-07c): «Mostra la casa sul sito» and, when nothing blocks, the terms. The switch is on by default and
 * **off and explained while the server reports blockers**: it decides only whether a property that is ready appears on the site, it
 * never publishes one that is not. The terms are the text and the box of the activation of today.
 */
export function ActivationSection({ form, stage, tosAccepted, onTosChange }: ActivationSectionProps) {
  const { t } = useTranslation();
  const decidable = stage === 'ready' || stage === 'active';

  return (
    <section aria-labelledby="property-wizard-activation-title" className="min-w-0 space-y-4 rounded-lg bg-muted p-4" data-testid="property-wizard-activation">
      <h3 id="property-wizard-activation-title" className="text-base font-semibold">
        {t('propertyWizard.last.activation.title')}
      </h3>

      <Controller
        control={form.control}
        name="publishedOnSite"
        render={({ field }) => (
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="property-wizard-show-on-site" className="text-sm font-medium">
                {t('propertyWizard.last.visibility.label')}
              </Label>
              <p id="property-wizard-show-on-site-hint" className="text-sm text-foreground/70">
                {!decidable
                  ? t('propertyWizard.last.visibility.blocked')
                  : field.value
                    ? t('propertyWizard.last.visibility.on')
                    : t('propertyWizard.last.visibility.off')}
              </p>
            </div>
            <Switch
              id="property-wizard-show-on-site"
              aria-describedby="property-wizard-show-on-site-hint"
              checked={decidable && field.value}
              disabled={!decidable}
              onCheckedChange={field.onChange}
              data-testid="property-wizard-show-on-site"
            />
          </div>
        )}
      />

      {stage === 'ready' ? (
        <div className="space-y-2 border-t pt-4">
          <div className="flex items-start gap-2">
            <Checkbox id="property-wizard-tos" className="mt-0.5" checked={tosAccepted} onCheckedChange={(checked) => onTosChange(checked === true)} data-testid="property-wizard-tos" />
            <Label htmlFor="property-wizard-tos">{t('compliance.activation.tosAccept')}</Label>
          </div>
          {!tosAccepted ? <p className="text-xs text-foreground/70">{t('compliance.activation.review.tosHint')}</p> : null}
        </div>
      ) : stage === 'blocked' ? (
        <p className="border-t pt-4 text-sm text-foreground/70" data-testid="property-wizard-finish-later-hint">
          {t('propertyWizard.last.activation.later')}
        </p>
      ) : null}
    </section>
  );
}
