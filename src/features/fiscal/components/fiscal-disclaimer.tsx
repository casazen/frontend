import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Informative-only notice of the fiscal area, in the UI language (same content as the backend disclaimer). A quiet line, not a box. */
export function FiscalDisclaimer() {
  const { t } = useTranslation();
  return (
    <p data-testid="fiscal-disclaimer" className="flex items-start gap-2 text-sm text-foreground/70">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 break-words">{t('fiscal.disclaimer')}</span>
    </p>
  );
}
