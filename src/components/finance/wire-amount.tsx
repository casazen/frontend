import { useTranslation } from 'react-i18next';
import { localeOf } from '@/features/owner-accounting/owner-accounting-model';
import { useExactMoney } from '@/hooks/use-exact-money';

interface WireAmountProps {
  amount: number;
  /** The currency of the figure as the data says it. It is never assumed: a figure with none is drawn without a symbol and says so. */
  currency: string | null | undefined;
  className?: string;
  testId?: string;
}

/**
 * An amount of the wire page: the figure of the server with ITS OWN currency, never rounded and never an assumed euro (the symbol and the code come from the data, not from
 * the code of the page). A figure whose data carries no currency is written without a symbol and with a sentence that says it, because a franc and an euro are not
 * the same money and the page must not choose one.
 */
export function WireAmount({ amount, currency, className, testId }: WireAmountProps) {
  const { t, i18n } = useTranslation();
  const money = useExactMoney();
  const code = (currency ?? '').trim();

  if (code === '') {
    const figure = new Intl.NumberFormat(localeOf(i18n.language), { minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(amount);
    return (
      <span className={className} data-testid={testId}>
        {figure} <span className="text-xs text-muted-foreground">{t('wire.currencyMissing')}</span>
      </span>
    );
  }

  return (
    <span className={className} data-testid={testId}>
      {money(amount, code)}
    </span>
  );
}
