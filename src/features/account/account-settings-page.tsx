import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { PAGE_COLUMNS } from '@/components/layout/page-columns';
import { FocusBlock, PlainSection } from '@/components/shared/calm';
import { ORG_NAME_FIELD_ID, isOrgProfileIncomplete } from '@/features/settings/organization/org-profile';
import { OrganizationSettings } from '@/features/settings/organization/organization-settings-page';
import { useOrgSettings } from '@/features/settings/organization/use-org-settings';
import { PaymentsBody, PaymentsFocus } from '@/features/settings/payments-page';
import { isPaymentsMissing, useConnectPayments } from '@/features/settings/use-connect-payments';
import { useWorkspace } from '@/hooks/use-workspace';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { cn } from '@/lib/utils';
import { reachableEntry, type Reach } from './account-home-model';
import { AccountPrivacySection } from './account-privacy-section';
import { SettingsJumpNav, type JumpSection } from './settings-jump-nav';
import { settingsSectionId } from './settings-sections';

// The pages of the rental areas that this one gathers: it shows what they show, to the people who may open them, with the same endpoints.
const PAYMENTS_PATH = '/app/short-rent/settings/payments';
const SITE_APPEARANCE_PATH = '/app/short-rent/settings/site-appearance';
/** "Fatturazione e piano" of the account area (AM-08a): the invoicing data live there, here is only the way to it, once the page exists. */
const BILLING_PATH = '/app/account/billing';

/**
 * Settings of the account (AM-08b): what the org says about itself (name and address of its booking site, contact email) and how it
 * gets paid online (Stripe), the two pages the rental areas have, gathered in one page of the account area. The old pages stay at their
 * addresses. One block to look at: what is still missing, the name and address of the site first (while they are the ones CasaZen
 * gave) and then the Stripe account; the rest is quiet sections. Invoicing data (VAT number, SDI, PEC) are not repeated here: they
 * are in "Fatturazione e piano".
 */
export function AccountSettingsPage() {
  const { t } = useTranslation();
  const { contexts, hasPermission } = useWorkspace();
  const reach: Reach = { contexts, hasPermission };

  // The same queries the sections make: the page reads them only to know what to put first.
  const orgSettings = useOrgSettings(isOrgBillingAdmin(contexts));
  const showPayments = reachableEntry([PAYMENTS_PATH], reach) !== undefined;
  const payments = useConnectPayments(showPayments);

  const focus =
    orgSettings.data && isOrgProfileIncomplete(orgSettings.data) ? 'organization' : showPayments && isPaymentsMissing(payments) ? 'payments' : null;
  const billing = reachableEntry([BILLING_PATH], reach);
  const showPrivacy = isOrgBillingAdmin(contexts);

  // The sections the person has on this page, in the order they are on it: the row of links «Vai a…» and `?section=` (AM-08b-e).
  const jumpSections: JumpSection[] = [
    { id: 'company', label: t('nav.organization') },
    ...(showPayments ? [{ id: 'payments' as const, label: t('settings.connectPaymentsTitle') }] : []),
    ...(billing ? [{ id: 'billing' as const, label: t('accountSettings.billing.title') }] : []),
    ...(showPrivacy ? [{ id: 'privacy' as const, label: t('accountSettings.privacy.title') }] : []),
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={t('nav.accountSettings')} description={t('accountSettings.description')} crumbs="auto" />

      <SettingsJumpNav sections={jumpSections} />

      {focus === 'organization' ? (
        <FocusBlock
          data-testid="account-settings-focus"
          tone="warning"
          kicker={t('accountSettings.focus.kicker')}
          title={t('accountSettings.focus.organization.title')}
          body={t('accountSettings.focus.organization.body')}
          primary={{
            label: t('accountSettings.focus.organization.action'),
            onClick: () => document.getElementById(ORG_NAME_FIELD_ID)?.focus(),
          }}
        />
      ) : null}
      {focus === 'payments' ? <PaymentsFocus payments={payments} /> : null}

      {/* What the org says about itself on the left, how it gets paid and where it pays on the right (under each other on a narrow screen). */}
      <div className={cn(PAGE_COLUMNS, 'gap-8')}>
        <PlainSection id={settingsSectionId('company')} className="scroll-mt-4" title={t('nav.organization')} data-testid="account-settings-organization">
          <p className="text-sm text-foreground/70">{t('orgSettings.formDescription')}</p>
          <OrganizationSettings showSiteAppearanceLink={reachableEntry([SITE_APPEARANCE_PATH], reach) !== undefined} />
        </PlainSection>

        <div className="min-w-0 space-y-8">
          {showPayments ? (
            <PlainSection id={settingsSectionId('payments')} className="scroll-mt-4" title={t('settings.connectPaymentsTitle')} data-testid="account-settings-payments">
              <p className="text-sm text-foreground/70">{t('settings.connectDescription')}</p>
              <PaymentsBody payments={payments} showAction={focus !== 'payments'} />
            </PlainSection>
          ) : null}

          {billing ? (
            <PlainSection
              id={settingsSectionId('billing')}
              className="scroll-mt-4"
              title={t('accountSettings.billing.title')}
              actionLabel={t('accountSettings.billing.action')}
              href={billing.path}
            >
              <p className="text-sm text-foreground/70">{t('accountSettings.billing.body')}</p>
            </PlainSection>
          ) : null}

          {/* The data of the organization, to take away (AM-08b-c): the endpoint is the one of the org billing administrator. */}
          {showPrivacy ? <AccountPrivacySection /> : null}
        </div>
      </div>
    </div>
  );
}
