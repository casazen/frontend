import { useTranslation } from 'react-i18next';

export function CurrencyMissing() {
  const { t } = useTranslation();
  return (
    <p className="break-words text-sm text-foreground/70" data-testid="self-billing-currency-missing">
      {t('selfBilling.currencyMissing')}
    </p>
  );
}
