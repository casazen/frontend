import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FocusBlock, PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { ROW_BUTTON } from '@/features/compliance/components/compliance-row';
import { useWorkspace } from '@/hooks/use-workspace';
import { useCinCompliance } from '@/queries/use-cin';
import { deadlineMessage } from './cin-deadline';
import { CinPropertyList } from './components/cin-property-list';

const PROPERTIES_PATH = '/app/short-rent/properties';
const BDSR_URL = 'https://bdsr.ministeroturismo.gov.it/';

/**
 * The CIN of every property, the state of each one and the first one to put right. Everything comes from
 * `GET properties/cin-compliance`: the deadline and its phase are the backend's (CO-20), none is worked out here.
 */
export function CinCompliancePage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { data, isLoading, isError, error, refetch } = useCinCompliance();
  const canWrite = hasPermission('short-rent', 'property.write');

  const items = Array.isArray(data?.items) ? data.items : [];
  const summary = data?.summary;
  const first = items.find((item) => item.cinStatus !== 'valid');
  // The edit page for whoever may edit, the property for whoever may only look: the button never leads where the guard says no.
  const primary = first
    ? canWrite
      ? { label: t(first.cinStatus === 'missing' ? 'cin.table.addCin' : 'cin.table.fixCin'), href: `${PROPERTIES_PATH}/${first.propertyId}/edit` }
      : { label: t('dashboard.todo.open'), href: `${PROPERTIES_PATH}/${first.propertyId}` }
    : { label: t('compliance.cockpit.allClear.cta'), href: PROPERTIES_PATH };

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8" data-testid="cin-compliance-page">
        <PageHeader title={t('cin.pageTitle')} description={t('cin.pageDescription')} crumbs="auto" />

        {isError && !data ? (
          // An API error is never shown as "no properties".
          <ErrorState title={t('cin.loadError')} error={error} onRetry={() => void refetch()} testId="cin-compliance-error" />
        ) : isLoading ? (
          <>
            <SkeletonCard lines={3} />
            <SkeletonLine lines={4} />
          </>
        ) : (
          <>
            {summary?.hasNonCompliant ? (
              <FocusBlock
                tone={summary.deadlineStatus === 'passed' ? 'danger' : 'warning'}
                kicker={t('compliance.cockpit.kicker')}
                title={t('cin.banner.nonCompliantCount', { count: summary.missing + summary.invalid })}
                body={<span data-testid="cin-deadline-message">{deadlineMessage(summary, i18n.language, t)}</span>}
                primary={{ ...primary, testId: 'cin-focus-cta' }}
                data-testid="cin-focus"
              />
            ) : items.length > 0 ? (
              <FocusBlock
                tone="success"
                title={t('cin.focus.ok.title')}
                body={t('cin.banner.obligation')}
                primary={{ ...primary, testId: 'cin-focus-cta' }}
                data-testid="cin-focus"
              />
            ) : null}

            <PlainSection title={t('cin.list.title')} count={items.length}>
              <CinPropertyList items={items} canWrite={canWrite} />
            </PlainSection>

            <div className="space-y-3">
              {summary?.hasNonCompliant ? <p className="text-sm text-foreground/70">{t('cin.banner.penalties')}</p> : null}
              <Button asChild variant="outline" size="sm" className={ROW_BUTTON} iconRight={<ExternalLink />}>
                <a href={BDSR_URL} target="_blank" rel="noopener noreferrer">
                  {t('cin.requestOnPortal')}: {t('cin.bdsrPortal')}
                </a>
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
