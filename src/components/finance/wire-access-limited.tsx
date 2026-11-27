import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';

/**
 * What the wire page says when the server refuses one of its reads of the payouts (403): the payouts of every owner of the organization are shown only to a person who reaches
 * the whole organization, so a person limited to some properties is told that, in the place where the payouts would be. It is a refusal in words, never an empty list («no
 * payments to make») and never a trip to the page of no access.
 */
export function WireAccessLimited({ testId }: { testId: string }) {
  const { t } = useTranslation();
  return (
    <Alert variant="warning" icon={ShieldAlert} role="alert" title={t('wire.refused.title')} data-testid={testId}>
      {t('wire.refused.description')}
    </Alert>
  );
}
