import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NavChildLinks } from '@/components/layout/nav-child-links';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { SupplierPaymentsPanel } from '../payments/supplier-payments-page';
import { PAYMENTS_TAB, stripeMarkOf } from '../payments/payments-model';
import { AutoAcceptSection } from './auto-accept-section';

const ANSWERS_TAB = 'risposte';
type SettingsTab = typeof ANSWERS_TAB | typeof PAYMENTS_TAB;

/**
 * The settings of the supplier (SP-16c-c): "Risposte" (how the requests are answered: the automatic acceptance of the regular
 * customers) and "Pagamenti" (the account on Stripe, SP-16c-b). The tab is in the address (`?tab=pagamenti`); Stripe sends the supplier
 * back here with `?stripe_return=1` or `?stripe_refresh=1` and no tab, and those marks alone open the payments. The profile is its own
 * page ("Profilo" in "Altro"); the notification switches come when the server reads them (SP-16d). The earnings (SP-16b) hang from this
 * page: the link to them is in its header, and only there while online payments are on (`NavChildLinks` reads the flag).
 */
export function SupplierSettingsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const active: SettingsTab =
    requested === ANSWERS_TAB || requested === PAYMENTS_TAB ? requested : stripeMarkOf(searchParams) !== null ? PAYMENTS_TAB : ANSWERS_TAB;

  const items: TabItem<SettingsTab>[] = [
    { value: ANSWERS_TAB, label: t('supplier.settings.tabs.answers'), testId: 'supplier-settings-tab-answers' },
    { value: PAYMENTS_TAB, label: t('supplier.settings.tabs.payments'), testId: 'supplier-settings-tab-payments' },
  ];

  return (
    <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="supplier-settings-page">
      <PageHeader
        title={t('supplier.settings.title')}
        description={t('supplier.settings.description')}
        crumbs="auto"
        action={<NavChildLinks parentPath="/app/supplier/settings" />}
      />
      <Tabs
        label={t('supplier.settings.tabsLabel')}
        items={items}
        value={active}
        panelTestId="supplier-settings-panel"
        selectTestId="supplier-settings-tab-select"
        className="space-y-6"
      >
        {active === PAYMENTS_TAB ? <SupplierPaymentsPanel /> : <AutoAcceptSection />}
      </Tabs>
    </div>
  );
}
