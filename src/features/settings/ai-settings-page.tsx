import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BookOpen, CalendarCheck, ClipboardList, MessageSquareText, Settings2, Workflow } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { useCommercialProfile } from '@/hooks/use-commercial-profile';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import { useWorkspace } from '@/hooks/use-workspace';
import { commercialRouteAllowed } from '@/features/onboarding/commercial-access';
import { BiometricSettingsCard } from './components/biometric-settings-card';

const ROUTINES_PATH = '/app/short-rent/automations';

export function AiSettingsPage() {
  const { t } = useTranslation();
  const profile = useCommercialProfile();
  const { flags } = useFeatureFlags();
  const { hasPermission } = useWorkspace();
  const canConfigure = hasPermission('short-rent', 'property.write');
  const billingPath = hasPermission('account', ORG_BILLING_ADMIN_PERMISSION) ? '/app/account/billing' : null;
  const routinesIncluded = commercialRouteAllowed(profile, ROUTINES_PATH);
  const showIdentity = commercialRouteAllowed(profile, '/app/short-rent/compliance/identification');
  const otherSettings = [
    { path: '/app/short-rent/settings/assistant', icon: MessageSquareText, title: 'nav.assistant', description: 'aiSettings.assistantDescription', visible: flags.messageAssistant && canConfigure },
    { path: '/app/admin/ai', icon: Settings2, title: 'nav.ai', description: 'aiSettings.provider', visible: hasPermission('admin', 'admin.seo.read') },
  ];
  return (
    <div className="max-w-6xl space-y-5">
      <PageHeader title={t('aiSettings.pageTitle')} crumbs="auto" />
      {flags.routines && canConfigure && (
        <section aria-labelledby="settings-routines-title" className="grid items-start gap-4 rounded-xl border bg-card p-4 sm:p-6 lg:grid-cols-[minmax(0,3fr)_minmax(15rem,2fr)] lg:gap-x-6" data-testid="ai-routines-entry">
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary-text">
              <Workflow aria-hidden="true" className="size-6" />
            </span>
            <div className="min-w-0">
              <h2 id="settings-routines-title" className="text-xl font-semibold tracking-tight">{t('nav.routines')}</h2>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">{t('aiSettings.routineDescription')}</p>
            </div>
          </div>
          {routinesIncluded ? (
            <div className="flex flex-wrap gap-2 sm:ml-15 lg:col-start-1">
              <Button asChild className="min-h-11"><Link to={ROUTINES_PATH}>{t('aiSettings.openRoutines')}<ArrowRight aria-hidden="true" className="size-4" /></Link></Button>
              <Button asChild variant="outline" className="min-h-11"><Link to={ROUTINES_PATH + '?view=library'}><BookOpen aria-hidden="true" className="size-4" />{t('aiSettings.browseTemplates')}</Link></Button>
            </div>
          ) : (
            <div className="space-y-2 text-sm lg:col-start-1">
              <p>{t('commercial.moduleRequiredText')}</p>
              {billingPath && <Button asChild variant="outline"><Link to={billingPath}>{t('commercial.managePlan')}</Link></Button>}
            </div>
          )}
          <div className="rounded-lg bg-muted/70 p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('aiSettings.example')}</p>
            <ol className="space-y-2 text-sm">
              <li className="flex items-center gap-2 font-medium"><CalendarCheck aria-hidden="true" className="size-4 text-primary-text" />{t('aiSettings.exampleTrigger')}</li>
              <li className="ml-2 border-l border-primary/30 pl-4">
                <span className="flex items-center gap-2"><ClipboardList aria-hidden="true" className="size-4 shrink-0 text-primary-text" />{t('aiSettings.exampleAction')}</span>
              </li>
            </ol>
          </div>
        </section>
      )}
      <div className="grid gap-3 empty:hidden md:grid-cols-2">
        {otherSettings.filter(link => link.visible).map(({ path, title, description, icon: Icon }) => {
          const included = commercialRouteAllowed(profile, path);
          const destination = included ? path : billingPath;
          return (
            <section key={path} className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Icon aria-hidden="true" className="size-5 shrink-0 text-primary-text" />
                <h2 className="font-semibold">{t(title)}</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t(description)}</p>
              {!included && <p className="mt-2 text-sm">{t('commercial.moduleRequiredText')}</p>}
              {destination && <Link to={destination} className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-primary-text hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                {t(included ? 'aiSettings.openSettings' : 'commercial.managePlan')}<span className="sr-only"> · {t(title)}</span>
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>}
            </section>
          );
        })}
      </div>
      {showIdentity && <BiometricSettingsCard compact />}
    </div>
  );
}
