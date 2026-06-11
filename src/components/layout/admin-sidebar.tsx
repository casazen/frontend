import { useTranslation } from 'react-i18next';
import { ContextSidebar } from './context-sidebar';

export function AdminSidebar() {
  const { t } = useTranslation();
  return (
    <ContextSidebar
      contextKey="admin"
      subtitle={t('shell.adminSubtitle')}
      iconClassName="bg-destructive text-destructive-foreground"
      footerLabel={t('shell.adminFooter')}
    />
  );
}
