import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { useCommercialProfile } from '@/hooks/use-commercial-profile';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { commercialRouteAllowed } from '@/features/onboarding/commercial-access';
import { BiometricSettingsCard } from './components/biometric-settings-card';

export function AiSettingsPage() {
  const { t } = useTranslation();
  const profile = useCommercialProfile();
  const { flags } = useFeatureFlags();
  const { hasPermission } = useWorkspace();
  const links = [
    { path: '/app/short-rent/automations', title: 'routines.title', description: 'commercial.addons.ai-agents.text', visible: flags.routines },
    { path: '/app/short-rent/settings/assistant', title: 'nav.assistant', description: 'commercial.addons.messages-ai.text', visible: flags.messageAssistant },
    { path: '/app/admin/ai', title: 'nav.ai', description: 'aiSettings.provider', visible: hasPermission('admin', 'admin.seo.read') },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title={t('aiSettings.title')} crumbs="auto" />
      <div className="grid max-w-4xl gap-3 md:grid-cols-2">
        {links.filter(link => link.visible).map(link => {
          const included = commercialRouteAllowed(profile, link.path);
          return (
            <Link key={link.path} to={included ? link.path : '/app/account/billing'} className="space-y-2 rounded-xl border bg-card p-5 hover:border-primary">
              <h2 className="font-semibold">{t(link.title)}</h2>
              <p className="text-sm text-muted-foreground">{t(link.description)}</p>
              {!included && <span className="text-sm text-primary">{t('commercial.managePlan')}</span>}
            </Link>
          );
        })}
      </div>
      {commercialRouteAllowed(profile, '/app/short-rent/compliance/identification') && <BiometricSettingsCard />}
    </div>
  );
}
