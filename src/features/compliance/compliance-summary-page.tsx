import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { NavChildLinks } from '@/components/layout/nav-child-links';
import { ComplianceSummaryWidget } from '@/features/compliance/compliance-summary-widget';

export function ComplianceSummaryPage() {
  const { t } = useTranslation();

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto" data-testid="compliance-summary-page">
        <PageHeader
          title={t('compliance.page.title')}
          description={t('compliance.page.description')}
          action={<NavChildLinks parentPath="/app/short-rent/compliance" />}
        />
        <ComplianceSummaryWidget />
      </div>
    </AppShell>
  );
}
