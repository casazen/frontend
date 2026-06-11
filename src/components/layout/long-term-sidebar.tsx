import { useTranslation } from 'react-i18next';
import { ContextSidebar } from './context-sidebar';

export function LongTermSidebar() {
  const { t } = useTranslation();
  return (
    <ContextSidebar
      contextKey="long-rent"
      subtitle={t('shell.longRentSubtitle')}
    />
  );
}
