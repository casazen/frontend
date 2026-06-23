import { useTranslation } from 'react-i18next';
import { OtaCard } from './ota-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Repeat } from 'lucide-react';
import type { OtaIntegration } from '@/types';

interface OtaListProps {
  integrations: OtaIntegration[];
  isLoading?: boolean;
  onSync?: (integration: OtaIntegration) => void;
  onEdit?: (integration: OtaIntegration) => void;
  onDelete?: (integration: OtaIntegration) => void;
  onValidate?: (integration: OtaIntegration) => void;
  onAdd?: () => void;
}

export function OtaList({
  integrations,
  isLoading,
  onSync,
  onEdit,
  onDelete,
  onValidate,
  onAdd,
}: OtaListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!integrations || integrations.length === 0) {
    return (
      <EmptyState
        icon={Repeat}
        title={t('ota.list.emptyTitle')}
        description={t('ota.list.emptyDescription')}
        action={onAdd ? { label: t('ota.list.addAction'), onClick: onAdd } : undefined}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {integrations.map((integration) => (
        <OtaCard
          key={integration.id}
          integration={integration}
          onSync={onSync}
          onEdit={onEdit}
          onDelete={onDelete}
          onValidate={onValidate}
        />
      ))}
    </div>
  );
}
