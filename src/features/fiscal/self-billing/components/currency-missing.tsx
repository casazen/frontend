import { useTranslation } from 'react-i18next';

/** A currency that is not a code is never made one: the amounts are written without a symbol, and this says so. */
export function CurrencyMissing() {
  const { t } = useTranslation();
  return (
    <p className="break-words text-sm text-foreground/70" data-testid="self-billing-currency-missing">
      {t('selfBilling.currencyMissing')}
    </p>
  );
}
