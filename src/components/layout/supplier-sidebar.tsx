import { Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ContextSidebar } from './context-sidebar';

export function SupplierSidebar() {
  const { t } = useTranslation();
  return (
    <ContextSidebar
      contextKey="supplier"
      subtitle={t('shell.supplierSubtitle')}
      icon={Wrench}
    />
  );
}
