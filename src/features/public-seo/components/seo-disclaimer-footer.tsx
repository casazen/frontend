import type { SeoDisclaimers } from '@/types/seo.types';

interface SeoDisclaimerFooterProps {
  disclaimers: SeoDisclaimers;
}

export function SeoDisclaimerFooter({ disclaimers }: SeoDisclaimerFooterProps) {
  return (
    <footer className="mt-8 space-y-2 border-t pt-6 text-sm text-muted-foreground" data-testid="seo-disclaimer-footer">
      <p>{disclaimers.lastUpdated}</p>
      <p>{disclaimers.notLegalAdvice}</p>
      <p>{disclaimers.aiGenerated}</p>
    </footer>
  );
}
