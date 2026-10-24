import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { ConcordatoDraftStart } from './components/concordato-draft-start';
import { ContractKindChoice } from './components/contract-kind-choice';
import { ImportedStart } from './components/imported-start';
import { StartWayChoice } from './components/start-way-choice';
import { TYPE_OF_KIND, contractKindOf, startWayOf, type ContractKind, type StartWay } from './lib/contract-kind';
import { NewLeaseStep } from './wizard/new-lease-step';

/** Back to the question before this one: it is a link to the address without the answer to this one, so "back" of the browser agrees. */
function StartBackLink({ to, label }: { to: URLSearchParams; label: string }) {
  const query = to.toString();
  return (
    <Link
      to={{ search: query ? `?${query}` : '' }}
      data-testid="lease-start-back"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:min-h-0"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

/**
 * «Nuovo contratto» asks two questions, one per screen, and the answers stay in the address so that "back" returns to the question:
 *  1. which contract (`?tipo=concordato|libero|transitorio`);
 *  2. how it is made (`?come=casazen|documenti|zero`): a canone concordato only asks whether the person already has the contract and
 *     the documents (`documenti`) or starts from zero with the partner (`zero`, ConcordatoFacile: the draft is saved with its leaseId
 *     and the person goes to the payment page); a libero or a transitory is prepared with the wizard of CasaZen (`casazen`, where the
 *     server says the type can be made) or comes from documents the person already has (`documenti`).
 * The old addresses keep working: `?tipo=altro` is `libero`, `?origine=importato` is `?come=documenti`; `?propertyId=` (from the
 * page of a property) is kept through the questions and preselects the property. The wizard starts here with the property and goes
 * on at `/leases/:id/edit`, on the draft saved on the server.
 */
export function LeaseCreatePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { flags } = useFeatureFlags();
  // "New lease" from a property page preselects it.
  const defaultPropertyId = searchParams.get('propertyId') ?? undefined;
  const kind = contractKindOf(searchParams.get('tipo'));
  const requested = kind ? startWayOf(kind, searchParams.get('come'), searchParams.get('origine')) : null;
  // Starting from zero with the partner is open only while its service is on: the address alone does not open it (it asks again).
  const way = requested === 'zero' && !flags.concordatoFacile ? null : requested;

  /** The address with these answers (and the old `origine` dropped); whatever else it carries, the property of a property page, stays. */
  const addressWith = (answers: { tipo?: ContractKind; come?: StartWay }) => {
    const params = new URLSearchParams(searchParams);
    params.delete('tipo');
    params.delete('come');
    params.delete('origine');
    if (answers.tipo) params.set('tipo', answers.tipo);
    if (answers.come) params.set('come', answers.come);
    return params;
  };

  if (kind === null) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('leases.createPageTitle')} description={t('leaseWizard.start.kind.description')} />
        <ContractKindChoice onChoose={(chosen) => setSearchParams(addressWith({ tipo: chosen }))} />
      </div>
    );
  }

  const header = <PageHeader title={t('leases.createPageTitle')} description={t(`leaseWizard.start.kind.${kind}.title`)} />;

  if (way === null) {
    return (
      <div className="space-y-6">
        <StartBackLink to={addressWith({})} label={t('leaseWizard.start.changeKind')} />
        {header}
        <StartWayChoice kind={kind} onChoose={(chosen) => setSearchParams(addressWith({ tipo: kind, come: chosen }))} />
      </div>
    );
  }

  const type = TYPE_OF_KIND[kind];
  return (
    <div className="space-y-6">
      <StartBackLink to={addressWith({ tipo: kind })} label={t('leaseWizard.start.back')} />
      {header}
      {way === 'zero' ? (
        <ConcordatoDraftStart defaultPropertyId={defaultPropertyId} />
      ) : way === 'documenti' ? (
        <ImportedStart contractType={type} defaultPropertyId={defaultPropertyId} />
      ) : (
        <NewLeaseStep origin="Created" contractType={type} defaultPropertyId={defaultPropertyId} />
      )}
    </div>
  );
}
