import { useTranslation } from 'react-i18next';
import type { SubprocessorItem } from '@/types/onboarding.types';

export function SubprocessorPurpose({ item }: { item: SubprocessorItem }) {
  const { t, i18n } = useTranslation();
  const key = item.purposeKey ? `legal.subprocessors.purposes.${item.purposeKey}` : null;
  return <>{key && i18n.exists(key) ? t(key) : item.purpose}</>;
}
