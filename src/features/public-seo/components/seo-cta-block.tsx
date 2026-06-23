import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SeoCta } from '@/types/seo.types';
import { Button } from '@/components/ui/button';

interface SeoCtaBlockProps {
  cta: SeoCta;
  comuneName: string;
}

export function SeoCtaBlock({ cta, comuneName }: SeoCtaBlockProps) {
  const { t } = useTranslation();

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
          <Link to={cta.complianceCheckerUrl} data-testid="seo-cta-checker">
            {t('publicSeo.verifyCompliance')}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={cta.signupUrl} data-testid="seo-cta-signup">
            {t('publicSeo.registerFree')}
          </Link>
        </Button>
      </div>
    </section>
  );
}
