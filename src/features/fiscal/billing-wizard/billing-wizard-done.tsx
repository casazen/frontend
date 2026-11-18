import { useSearchParams } from 'react-router-dom';
import { SETUP_RETURN_PARAM, propertySetupReturn } from '@/features/properties/wizard/property-setup-model';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { billingItemTextKey, billingStepOfItem } from '@/lib/onboarding-billing';
import { useBillingSetup } from '@/queries/use-billing-setup';
import { AREA_HOME_PATH, BILLING_SETUP_PATH } from './billing-wizard-ids';
import { flagOf, missingItemsOf, sectionOf } from './billing-wizard-model';

interface BillingWizardDoneProps {
  /** Where the confirmation leads first, with what the button says: the plan «Inizia con CasaZen» while it exists, else the fiscal page. */
  home: { to: string; label: string };
}

/**
 * «What happens now» at the end of the wizard (NF-05, NF-10). It reads the setup from the server, so it is also what an address opened again shows (a reload), and it says
 * only what is true: a setup with nothing missing is told as ready and says what CasaZen does from now on, from what was saved; a setup with something missing is never told
 * as done, it says what is left (each point marked as still to do) and leads to the step that fixes the first of them.
 */
export function BillingWizardDone({ home }: BillingWizardDoneProps) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const returnTo = propertySetupReturn(params, 'billing');
  const destination = returnTo ? { to: returnTo, label: t('propertySetup.returnToProperty') } : home;
  const setup = useBillingSetup();

  if (setup.isPending) return <LoadingScreen message={t('billingWizard.loading')} className="h-auto flex-1" />;
  const data = setup.data;
  if (!data) {
    return <ErrorState title={t('billingWizard.loadError')} error={setup.error} onRetry={() => void setup.refetch()} testId="billing-done-error" />;
  }

  const missing = missingItemsOf(data);
  const secondary = { label: t('billingWizard.done.toHome'), to: AREA_HOME_PATH };

  if (missing.length > 0) {
    const first = billingStepOfItem(missing[0]);
    return (
      <div data-testid="billing-done" data-complete="false">
        <WizardDone
          title={t('billingWizard.done.partial.title')}
          lead={t('billingWizard.done.partial.lead')}
          whatNext={missing.map((item) => ({
            text: t(billingItemTextKey(item.key), item.count === undefined ? {} : { count: item.count }),
            icon: AlertTriangle,
            tone: 'attention' as const,
          }))}
          primary={first ? { label: t('billingWizard.done.partial.continue'), to: `${BILLING_SETUP_PATH}?${new URLSearchParams({ step: first, ...(returnTo ? { [SETUP_RETURN_PARAM]: params.get(SETUP_RETURN_PARAM)! } : {}) })}` } : destination}
          secondary={first ? { label: t('billingWizard.done.partial.later'), to: destination.to } : secondary}
        />
      </div>
    );
  }

  const automation = sectionOf(data, 'automation')?.values;
  const auto = flagOf(automation, 'autoIssueGuestDocuments');
  const email = flagOf(automation, 'emailGuestDocuments');
  return (
    <div data-testid="billing-done" data-complete="true">
      <WizardDone
        title={t('billingWizard.done.title')}
        whatNext={[
          { text: t('billingWizard.done.draft') },
          { text: t(auto ? 'billingWizard.done.autoOn' : 'billingWizard.done.autoOff') },
          { text: t(email ? 'billingWizard.done.emailOn' : 'billingWizard.done.emailOff') },
          { text: t('billingWizard.done.change') },
        ]}
        primary={destination}
        secondary={secondary}
      />
    </div>
  );
}
