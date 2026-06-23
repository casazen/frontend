import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PaymentsPage } from '@/features/payments/payments-page';
import { RevenuePage } from '@/features/payments/revenue-page';
import { ConnectPaymentsPage } from '@/features/settings/payments-page';

type FinanceTab = 'pagamenti' | 'fatturato' | 'incassi';

export function FinanceShell() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<FinanceTab>('pagamenti');

  const TABS: { key: FinanceTab; label: string }[] = [
    { key: 'pagamenti', label: t('finance.payments') },
    { key: 'fatturato', label: t('finance.revenue') },
    { key: 'incassi', label: t('finance.payouts') },
  ];

  return (
    <>
      {/* Notes: each child page wraps itself in AppShell; we only provide the tab bar.
           Track C will wire this into a single-shell layout. */}
      <div className="border-b mb-6">
        <nav className="flex gap-4" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? 'border-b-2 border-primary pb-3 text-sm font-medium text-foreground'
                  : 'border-b-2 border-transparent pb-3 text-sm text-muted-foreground hover:text-foreground hover:border-border'
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'pagamenti' && <PaymentsPage />}
      {activeTab === 'fatturato' && <RevenuePage />}
      {activeTab === 'incassi' && <ConnectPaymentsPage />}
    </>
  );
}
