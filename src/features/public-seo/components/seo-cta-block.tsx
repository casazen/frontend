import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SeoCta } from '@/types/seo.types';
import { Button } from '@/components/ui/button';
import { useSeoEvent } from '@/hooks/use-seo-event';
import { buildSignupCtaHref } from '@/lib/signup-attribution';

interface SeoCtaBlockProps {
  cta: SeoCta;
  comuneName: string;
  /** Slug of the comune of the page: the click is counted for it (SE-04, AC8). */
  comuneSlug: string;
}

/**
 * Call to action of the public SEO pages (SE-03, A8-03): "Pubblica la tua casa" opens `/signup` on the public domain
 * built by the backend, with the comune of the page and the UTM parameters of the visit. A plain link, not a router
 * one: the public pages run without Auth0 and `/signup` needs it, so the browser loads it. There is no compliance
 * checker CTA: that tool has no spec yet. The click is also counted per comune (SE-04, AC3 and AC8): a beacon with no
 * personal data, sent before the browser leaves the page.
 */
export function SeoCtaBlock({ cta, comuneName, comuneSlug }: SeoCtaBlockProps) {
  const { t } = useTranslation();
  const { search } = useLocation();
  const track = useSeoEvent(comuneSlug);
  const signupHref = buildSignupCtaHref(cta.signupUrl, { search, origin: window.location.origin });

  return (
    <section
      className="my-8 rounded-lg border bg-muted/40 p-6"
      data-testid="seo-cta-block"
    >
      <h2 className="text-xl font-semibold">{t('publicSeo.tryCasaZen', { comuneName })}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('publicSeo.tryCasaZenDescription')}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild variant="default">
          <a href={signupHref} onClick={() => track('cta_click')} data-testid="seo-cta-signup">
            {t('publicSeo.publishYourHome')}
          </a>
        </Button>
      </div>
    </section>
  );
}
