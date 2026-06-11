import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTouristTaxPage } from '@/queries/use-public-seo';
import { useSeoMeta } from '@/lib/seo-meta';
import { SeoDisclaimerFooter } from './components/seo-disclaimer-footer';
import { SeoCtaBlock } from './components/seo-cta-block';
import { TouristTaxCalculatorWidget } from './components/tourist-tax-calculator-widget';

export function TouristTaxCalculatorPage() {
  const { comune = '' } = useParams<{ comune: string }>();
  const { data: page, isLoading, isError } = useTouristTaxPage(comune);

  useSeoMeta(
    page
      ? {
          title: page.title,
          description: page.metaDescription,
          canonicalUrl: page.canonicalUrl,
        }
      : null,
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" data-testid="tourist-tax-page-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !page) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12" data-testid="tourist-tax-page-not-found">
        <h1 className="text-2xl font-bold">Pagina non trovata</h1>
        <p className="mt-2 text-muted-foreground">
          Il calcolatore per questo comune non è ancora disponibile.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8" data-testid="tourist-tax-calculator-page">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">{page.comuneName}</p>
        <h1 className="mt-1 text-3xl font-bold">{page.title}</h1>
      </header>

      {page.bodyHtml && (
        <article
          className="prose prose-neutral max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
          data-testid="tourist-tax-page-body"
        />
      )}

      <TouristTaxCalculatorWidget
        comuneSlug={page.comuneSlug}
        rateSummary={page.touristTaxRate}
      />

      <SeoCtaBlock cta={page.cta} comuneName={page.comuneName} />
      <SeoDisclaimerFooter disclaimers={page.disclaimers} />
    </main>
  );
}
