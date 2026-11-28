import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { BackLink } from '@/components/shared/back-link';
import { LONG_RENT_PROPERTIES_PATH, longRentPropertyPath } from '@/features/properties/long-rent/paths';
import { PageHeader } from '@/components/layout/page-header';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useLongRentRules } from '@/queries/use-lease-draft';
import { ConcordatoDraftStart } from './components/concordato-draft-start';
import { ContractKindChoice } from './components/contract-kind-choice';
import { ImportedStart } from './components/imported-start';
import { StartWayChoice } from './components/start-way-choice';
import { TYPE_OF_KIND, contractKindOf, kindTitle, startWayOf, type ContractKind, type StartWay } from './lib/contract-kind';
import { NewLeaseStep } from './wizard/new-lease-step';

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
  const defaultPropertyId = searchParams.get('propertyId') ?? undefined;
  const kind = contractKindOf(searchParams.get('tipo'));
  const requested = kind ? startWayOf(kind, searchParams.get('come'), searchParams.get('origine')) : null;
  const way = requested === 'zero' && !flags.concordatoFacile ? null : requested;
  const rules = useLongRentRules();

  const headerRef = useRef<HTMLDivElement>(null);
  const screen = kind === null ? 'kind' : way === null ? 'way' : 'start';
  const shownScreen = useRef(screen);
  useEffect(() => {
    if (shownScreen.current === screen) return;
    shownScreen.current = screen;
    const title = headerRef.current?.querySelector('h1');
    if (!title) return;
    title.tabIndex = -1;
    title.classList.add('outline-none');
    title.focus();
  }, [screen]);
  const header = (description: string) => (
    <div ref={headerRef} className="space-y-4">
      <BackLink to={defaultPropertyId ? `${longRentPropertyPath(defaultPropertyId)}?tab=contracts` : LONG_RENT_PROPERTIES_PATH} label={t('nav.properties')} className="md:inline-flex" />
      <PageHeader title={t('leases.createPageTitle')} description={description} />
    </div>
  );

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
        {header(t('leaseWizard.start.kind.description'))}
        <ContractKindChoice onChoose={(chosen) => setSearchParams(addressWith({ tipo: chosen }))} />
      </div>
    );
  }

  const kindName = kindTitle(kind, rules.data, t);

  if (way === null) {
    return (
      <div className="space-y-6">
        <StartBackLink to={addressWith({})} label={t('leaseWizard.start.changeKind')} />
        {header(kindName)}
        <StartWayChoice kind={kind} onChoose={(chosen) => setSearchParams(addressWith({ tipo: kind, come: chosen }))} />
      </div>
    );
  }

  const type = TYPE_OF_KIND[kind];
  return (
    <div className="space-y-6">
      <StartBackLink to={addressWith({ tipo: kind })} label={t('leaseWizard.start.back')} />
      {header(kindName)}
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
