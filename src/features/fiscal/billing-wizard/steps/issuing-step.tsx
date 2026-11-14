import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Mail, Zap } from 'lucide-react';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import type { BillingWizardValues } from '../billing-wizard-schema';

/**
 * Step 7, «Emissione»: when the documents to the guests are made and sent. A draft is made at the end of every stay, always (it is what the host sees and confirms, and it is not
 * a choice). Whether the documents are issued by themselves, or wait for the host's confirmation, and whether the issued document is sent to the guest by e-mail are the two
 * answers of the step. Both are saved with the step, even when they are «no», and that is what confirms the step.
 */
export function IssuingStep() {
  const { t } = useTranslation();
  const { control, setValue } = useFormContext<BillingWizardValues>();
  const auto = useWatch({ control, name: 'autoIssueGuestDocuments' });
  const email = useWatch({ control, name: 'emailGuestDocuments' });

  return (
    <>
      <p className="text-sm text-foreground/80" data-testid="billing-issuing-draft">
        {t('billingWizard.issuing.draft')}
      </p>
      <ChoiceGroup legend={t('billingWizard.issuing.legend')} legendVisible minCardWidth={16}>
        <ChoiceCard
          type="checkbox"
          checked={auto}
          onChange={(event) => setValue('autoIssueGuestDocuments', event.target.checked, { shouldDirty: true })}
          icon={Zap}
          title={t('billingWizard.issuing.auto.title')}
          description={t(auto ? 'billingWizard.issuing.auto.on' : 'billingWizard.issuing.auto.off')}
          data-testid="billing-auto-issue"
        />
        <ChoiceCard
          type="checkbox"
          checked={email}
          onChange={(event) => setValue('emailGuestDocuments', event.target.checked, { shouldDirty: true })}
          icon={Mail}
          title={t('billingWizard.issuing.email.title')}
          description={t(email ? 'billingWizard.issuing.email.on' : 'billingWizard.issuing.email.off')}
          data-testid="billing-email-guest"
        />
      </ChoiceGroup>
    </>
  );
}
