import { useTranslation } from 'react-i18next';

/** Informative-only notice of the fiscal area, in the UI language (same content as the backend disclaimer). */
export function FiscalDisclaimer() {
  const { t } = useTranslation();
  return (
    <p
      data-testid="fiscal-disclaimer"
      className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/40"
    >
      {t('fiscal.disclaimer')}
    </p>
  );
}
