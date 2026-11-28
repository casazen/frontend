import { ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';
import { useEmptyWorkspaceRecovery } from '@/hooks/use-empty-workspace-recovery';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { CasaZenLogo } from '@/components/brand/casazen-mark';
import { NavIcon } from '@/components/layout/nav-icon';
import { getAccessibleAreas } from '@/config/areas';
import { Link, Navigate } from 'react-router-dom';
import { useMe } from '@/queries/use-users';

export function ContextPickerPage() {
  const { t } = useTranslation();
  const { contexts, isReady, setActiveContext } = useWorkspace();
  const { data: profile, isLoading: profileLoading } = useMe();
  const isRecovering = useEmptyWorkspaceRecovery(contexts.length, isReady);
  const showHostSetup = !!profile && (!profile.orgId || profile.onboardingRequired === true);

  if (!isReady || isRecovering || profileLoading) {
    return <LoadingScreen message={t('shared.contextPicker.loading')} />;
  }

  if (contexts.length === 0) {
    return <Navigate to="/app/no-access" replace />;
  }

  if (contexts.length === 1 && !showHostSetup) {
    return <Navigate to={contexts[0].defaultRoute} replace />;
  }

  const areas = getAccessibleAreas(contexts);

  return (
    <div data-testid="app-ready" className="workspace-entry flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <CasaZenLogo size={44} tone="dark" />
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>{t('shared.contextPicker.title')}</CardTitle>
          <CardDescription>{t('shared.contextPicker.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {areas.map((area) => (
            <Button
              key={area.key}
              variant="outline"
              data-testid={`context-option-${area.key}`}
              className="relative h-auto w-full flex-col items-start justify-start gap-3 whitespace-normal rounded-xl p-4 text-left"
              onClick={() => setActiveContext(area.key)}
            >
              <span
                data-area={area.accent}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              >
                <NavIcon name={area.icon} className="h-5 w-5" />
              </span>
              <ArrowUpRight aria-hidden="true" className="absolute end-4 top-4 size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(area.nameKey)}</span>
                <span className="block text-sm font-normal leading-snug text-muted-foreground">{t(area.descriptionKey)}</span>
              </span>
            </Button>
          ))}
          {showHostSetup && (
            <Button asChild variant="outline" className="h-auto w-full justify-start whitespace-normal py-3 text-left">
              <Link to="/onboarding" state={{ completeStep: true }}>
                <span>
                  <span className="block font-semibold">{t('shared.contextPicker.setupHost')}</span>
                  <span className="block text-sm font-normal text-muted-foreground">{t('shared.contextPicker.setupHostDescription')}</span>
                </span>
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
