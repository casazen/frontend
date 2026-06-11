import { useTranslation } from 'react-i18next';
import { ContextSidebar } from './context-sidebar';

export function Sidebar() {
  const { t } = useTranslation();
  return (
    <ContextSidebar
      contextKey="short-rent"
      subtitle={t('shell.shortRentSubtitle')}
    />
  );
}
