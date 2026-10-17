import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { SUPPLIER_PAYMENTS_PATH } from '../payments/payments-model';

/** Where the profile points to the payments account (SP-16c-b): a line and the way there, no second block to look at. */
export function ProfilePayments() {
  const { t } = useTranslation();

  return (
    <PlainSection
      title={t('supplier.profile.payments.title')}
      actionLabel={t('supplier.profile.payments.action')}
      href={SUPPLIER_PAYMENTS_PATH}
      actionTestId="supplier-profile-payments-link"
      data-testid="supplier-profile-payments"
    >
      <p className="text-sm text-foreground/70">{t('supplier.profile.payments.hint')}</p>
    </PlainSection>
  );
}
