import { Link } from 'react-router-dom';
import type { SeoCta } from '@/types/seo.types';
import { Button } from '@/components/ui/button';

interface SeoCtaBlockProps {
  cta: SeoCta;
  comuneName: string;
}

export function SeoCtaBlock({ cta, comuneName }: SeoCtaBlockProps) {
  return (
    <section
      className="my-8 rounded-lg border bg-muted/40 p-6"
      data-testid="seo-cta-block"
    >
      <h2 className="text-xl font-semibold">Prova CasaZen a {comuneName}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Verifica la conformità del tuo affitto breve o registrati gratuitamente.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild variant="default">
          <Link to={cta.complianceCheckerUrl} data-testid="seo-cta-checker">
            Verifica conformità
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={cta.signupUrl} data-testid="seo-cta-signup">
            Registrati gratis
          </Link>
        </Button>
      </div>
    </section>
  );
}
