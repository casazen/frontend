import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SeoCta } from '@/types/seo.types';
import { Button } from '@/components/ui/button';
import { buildSignupCtaHref } from '@/lib/signup-attribution';

interface SeoCtaBlockProps {
  cta: SeoCta;
  comuneName: string;
}

/**
 * Call to action of the public SEO pages (SE-03, A8-03): "Pubblica la tua casa" opens `/signup` on the public domain
 * built by the backend, with the comune of the page and the UTM parameters of the visit. A plain link, not a router
 * one: the public pages run without Auth0 and `/signup` needs it, so the browser loads it. There is no compliance
 * checker CTA: that tool has no spec yet.
 */
export function SeoCtaBlock({ cta, comuneName }: SeoCtaBlockProps) {
  const { t } = useTranslation();
  const { search } = useLocation();
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
          <a href={signupHref} data-testid="seo-cta-signup">
            {t('publicSeo.publishYourHome')}
          </a>
        </Button>
      </div>
    </section>
  );
}
