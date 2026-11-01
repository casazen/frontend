import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';
import { useEmptyWorkspaceRecovery } from '@/hooks/use-empty-workspace-recovery';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { CasaZenLogo } from '@/components/brand/casazen-mark';
import { NavIcon } from '@/components/layout/nav-icon';
import { getAccessibleAreas } from '@/config/areas';
import { Navigate } from 'react-router-dom';

export function ContextPickerPage() {
  const { t } = useTranslation();
  const { contexts, isReady, setActiveContext } = useWorkspace();
  const isRecovering = useEmptyWorkspaceRecovery(contexts.length, isReady);

  if (!isReady || isRecovering) {
    return <LoadingScreen message={t('shared.contextPicker.loading')} />;
  }

  if (contexts.length === 0) {
    return <Navigate to="/app/no-access" replace />;
  }

  if (contexts.length === 1) {
    return <Navigate to={contexts[0].defaultRoute} replace />;
  }

  // The areas as the area selector names them (`config/areas.ts`), in its order, not the `displayName` of the backend: there the
  // staff console and the customer's administration are both «Amministrazione», and a person with both saw two equal buttons.
  const areas = getAccessibleAreas(contexts);

  return (
    // A screen of the signed-in app without a shell, where a user with several areas lands after the login: like the
    // header of the shells it carries the id that the e2e logins wait for (UI-00).
    <div data-testid="app-ready" className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/20 px-4">
      <CasaZenLogo size={44} />
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{t('shared.contextPicker.title')}</CardTitle>
          <CardDescription>{t('shared.contextPicker.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {areas.map((area) => (
            <Button
              key={area.key}
              variant="outline"
              data-testid={`context-option-${area.key}`}
              className="h-auto w-full justify-start gap-3 whitespace-normal py-3 text-left"
              onClick={() => setActiveContext(area.key)}
            >
              <span
                data-area={area.accent}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              >
                <NavIcon name={area.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(area.nameKey)}</span>
                <span className="block text-sm font-normal leading-snug text-muted-foreground">{t(area.descriptionKey)}</span>
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
