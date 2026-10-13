import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';
import { activationStepDetail } from '@/lib/activation-labels';
import { activationStepCtaKey, activationStepRoute } from '@/lib/activation-routes';
import { useOnboardingStatus } from '@/queries/use-onboarding-status';

/**
 * Warning on the "Vetrina" page while the booking site is not really published (A3-26): the host would share a link
 * that guests answer with a refusal at checkout (Stripe charges off) or a page with no published property (all paused,
 * compliance pending). It says why, from the same stored state as the checklist, and links to the page that fixes it.
 * Nothing is shown while the status loads or when it cannot be read: the page works without it.
 */
export function SitePublicationBanner() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const status = useOnboardingStatus();

  const site = status.data?.steps?.find((step) => step.key === 'sitePublished');
  if (!site || site.state === 'done') return null;

  const route = activationStepRoute(site, hasPermission);

  return (
    <div
      role="alert"
      data-testid="site-publication-banner"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">{t('activation.siteBanner.title')}</p>
          <p className="text-muted-foreground" data-testid="site-publication-banner-detail">
            {activationStepDetail(site, t, (key) => i18n.exists(key))}
          </p>
        </div>
      </div>
      {route && (
        <Button variant="outline" size="sm" asChild>
          <Link to={route} data-testid="site-publication-banner-cta">
            {t(activationStepCtaKey(site))}
          </Link>
        </Button>
      )}
    </div>
  );
}
