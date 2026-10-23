import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { LeaseCreateForm } from './components/lease-create-form';
import { ConcordatoDraftStart } from './components/concordato-draft-start';
import { ContractKindChoice } from './components/contract-kind-choice';
import { contractKindOf, type ContractKind } from './lib/contract-kind';
import { useCreateLease } from '@/queries/use-leases';
import type { CreateLeaseDto } from '@/types';

/** Back to the first question, keeping the property a property page preselected. */
function ChangeKindLink() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.delete('tipo');
  const query = params.toString();
  return (
    <Link
      to={{ search: query ? `?${query}` : '' }}
      data-testid="lease-kind-change"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:min-h-0"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t('leases.kind.change')}
    </Link>
  );
}

/**
 * A new contract starts with its type, because the type decides how it is made: a canone concordato is prepared with the partner
 * (a draft with its leaseId is saved at once, `?tipo=concordato`), any other type is filled in here (`?tipo=altro`). The answer
 * stays in the address, so "back" returns to the question.
 */
export function LeaseCreatePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const createLease = useCreateLease();
  // "New lease" from a property page preselects it.
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultPropertyId = searchParams.get('propertyId') ?? undefined;
  const kind = contractKindOf(searchParams.get('tipo'));

  const choose = (next: ContractKind) => {
    const params = new URLSearchParams(searchParams);
    params.set('tipo', next);
    setSearchParams(params);
  };

  const handleSubmit = async (data: CreateLeaseDto) => {
    try {
      const lease = await createLease.mutateAsync(data);
      navigate(`/app/long-rent/leases/${lease.id}`);
    } catch {
      // useCreateLease.onError shows the server's reason; the form stays filled in to fix and resubmit.
    }
  };

  if (kind === null) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('leases.createPageTitle')} description={t('leases.kind.description')} />
        <ContractKindChoice onChoose={choose} />
      </div>
    );
  }

  if (kind === 'concordato') {
    return (
      <div className="space-y-6">
        <ChangeKindLink />
        <PageHeader title={t('leases.concordato.title')} description={t('leases.concordato.description')} />
        <ConcordatoDraftStart defaultPropertyId={defaultPropertyId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <ChangeKindLink />
        <PageHeader
          title={t('leases.createPageTitle')}
          description={t('leases.createPageDescription')}
        />
        <LeaseCreateForm
          onSubmit={handleSubmit}
          isLoading={createLease.isPending}
          defaultPropertyId={defaultPropertyId}
        />
    </div>
  );
}
