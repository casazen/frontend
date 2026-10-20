import { useTranslation } from 'react-i18next';
import { ChecklistCompact } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useSupplierChecklist } from '@/queries/supplier/use-inbox';
import { checklistSteps } from './home-model';

/**
 * "Prossimo passo": the one guide of the home, the activation checklist in a line with how far it is and the step to take next. It
 * is read from what the supplier really did (`GET checklist`), and it goes away when every step is done.
 */
export function NextStepSection() {
  const { t } = useTranslation();
  const query = useSupplierChecklist();

  if (query.isLoading) return <SkeletonCard lines={2} />;
  if (query.isError || !query.data) {
    return <ErrorState title={t('supplier.home.next.loadError')} error={query.error} onRetry={() => void query.refetch()} testId="supplier-next-step-error" />;
  }

  const steps = checklistSteps(query.data);
  const next = steps.find((step) => !step.done);
  if (!next) return null;
  const done = steps.filter((step) => step.done).length;

  return (
    <ChecklistCompact
      data-testid="supplier-next-step"
      title={t('supplier.home.next.title')}
      done={done}
      total={steps.length}
      progress={t('supplier.home.next.progress', { done, total: steps.length })}
      next={t('supplier.home.next.next', { step: t(next.titleKey) })}
      primary={{ label: t('supplier.home.next.continue'), href: next.to }}
    />
  );
}
