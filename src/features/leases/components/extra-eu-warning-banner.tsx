import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';

export function ExtraEUWarningBanner() {
  const { t } = useTranslation();
  return (
    <Alert variant="warning" title={t('leases.rli.extraEuTitle')} data-testid="extra-eu-warning">
      {t('leases.rli.extraEuBody')}
    </Alert>
  );
}
