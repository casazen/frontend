import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ComplianceSummaryWidget } from '@/features/compliance/compliance-summary-widget';

export function ComplianceSummaryPage() {
  const { t } = useTranslation();

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8" data-testid="compliance-summary-page">
        <PageHeader title={t('compliance.page.title')} description={t('compliance.page.description')} crumbs="auto" />
        <ComplianceSummaryWidget />
      </div>
    </AppShell>
  );
}
