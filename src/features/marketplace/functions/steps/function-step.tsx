import { useFormContext, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useLicensedFunctions } from '@/queries/use-marketplace';
import type { MarketplaceCostInvoicer } from '@/types';
import { WIZARD_LINK_CLASS } from '../../components/wizard-frame';
import { MARKETPLACE_PATH, marketplaceHref } from '../../lib/marketplace-paths';
import { costTextOf, functionOf, licenseSummary, requestPhase, type LicensedContext, type LicensedRequestValues } from '../licensed-request-model';
import { LicenseProblem } from './license-problem';
import { useDefaultProperty } from './use-default-property';

/** Who invoices the cost: the words of the cards of the marketplace. */
const INVOICER_TEXT: Readonly<Record<MarketplaceCostInvoicer, string>> = {
  Unknown: 'marketplace.card.invoicedBy.Unknown',
  Partner: 'marketplace.card.invoicedBy.Partner',
  CasaZen: 'marketplace.card.invoicedBy.CasaZen',
  ChannelManager: 'marketplace.card.invoicedBy.ChannelManager',
};

interface FunctionStepProps {
  context: LicensedContext;
}

/**
 * Step «La funzione» (E09/F02/US04/T03, MKT-03, PO-12, D21): what the function does and for whom, from the detail card; what it costs, which reads «non specificato»
 * unless the backend sent a cost (a price is never made up); and, for the property that is chosen, the plan and the limit of rooms of the license of the last read
 * (`GET /api/marketplace/functions?propertyId=`), which are said not to be read yet when there was no read. CasaZen cannot switch a module of the license on:
 * the wizard says so in the next steps, here it only explains.
 */
export function FunctionStep({ context }: FunctionStepProps) {
  const { t, i18n } = useTranslation();
  const { control } = useFormContext<LicensedRequestValues>();
  const propertyId = useWatch({ control, name: 'propertyId' }) ?? '';
  useDefaultProperty(context.properties, propertyId);
  const list = useLicensedFunctions(propertyId || undefined);
  const { entry } = context;

  if (context.entryStatus === 'pending') {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-muted p-4 text-sm" role="status" data-testid="licensed-function-loading">
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('marketplace.licensed.function.loading')}
      </div>
    );
  }
  if (context.entryStatus === 'error' || !entry) {
    return (
      <Alert variant="warning" title={t('marketplace.detail.notFound')} data-testid="licensed-function-unavailable">
        <p>{t('marketplace.detail.notFoundDescription')}</p>
        <Link to={MARKETPLACE_PATH} className={WIZARD_LINK_CLASS}>
          {t('marketplace.licensed.backToMarketplace')}
        </Link>
      </Alert>
    );
  }

  const cost = costTextOf(entry.cost);
  const summary = licenseSummary(list.data);
  const mine = functionOf(list.data, context.moduleCode);
  const phase = requestPhase(mine);
  const notRead = t('marketplace.licensed.function.notRead');

  return (
    <div className="flex flex-col gap-5" data-testid="licensed-function-step">
      <section className="min-w-0 space-y-1" aria-labelledby="licensed-what">
        <h3 id="licensed-what" className="text-sm font-semibold">
          {t('marketplace.licensed.function.whatItDoes')}
        </h3>
        <p className="break-words text-sm" data-testid="licensed-what-it-does">
          {entry.whatItDoes}
        </p>
      </section>
      <section className="min-w-0 space-y-1" aria-labelledby="licensed-audience">
        <h3 id="licensed-audience" className="text-sm font-semibold">
          {t('marketplace.licensed.function.audience')}
        </h3>
        <p className="break-words text-sm">{entry.audience}</p>
      </section>
      <section className="min-w-0 space-y-1" aria-labelledby="licensed-cost">
        <h3 id="licensed-cost" className="text-sm font-semibold">
          {t('marketplace.licensed.function.cost')}
        </h3>
        <p className="break-words text-sm" data-testid="licensed-cost">
          {cost ?? t('marketplace.licensed.function.costUnknown')}
          {cost ? ` (${t(INVOICER_TEXT[entry.cost.invoicedBy] ?? INVOICER_TEXT.Unknown)})` : null}
        </p>
      </section>

      {propertyId ? (
        <section className="min-w-0 space-y-3 rounded-lg bg-muted p-4" aria-labelledby="licensed-license" data-testid="licensed-license">
          <h3 id="licensed-license" className="text-sm font-semibold">
            {t('marketplace.licensed.function.license')}
          </h3>
          {list.isPending ? (
            <p className="flex items-center gap-2 text-sm" role="status">
              <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
              {t('marketplace.licensed.function.loadingLicense')}
            </p>
          ) : list.isError ? (
            <LicenseProblem error={list.error} onRetry={() => void list.refetch()} />
          ) : summary ? (
            <>
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{t('marketplace.licensed.function.plan')}</dt>
                  <dd className="font-medium" data-testid="licensed-plan">
                    {summary.tier ?? notRead}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('marketplace.licensed.function.rooms')}</dt>
                  <dd className="font-medium" data-testid="licensed-rooms-limit">
                    {summary.roomsLimit ?? notRead}
                  </dd>
                </div>
              </dl>
              {summary.readAt ? (
                <p className="text-xs text-muted-foreground">{t('marketplace.licensed.function.readAt', { time: formatRomeDateTime(summary.readAt, i18n.language) })}</p>
              ) : null}
              {summary.noRoomLicense ? (
                <Alert variant="warning" data-testid="licensed-no-room-license">
                  {t('marketplace.licensed.function.noRoomLicense')}
                </Alert>
              ) : null}
              {phase === 'active' ? (
                <Alert variant="success" data-testid="licensed-already-active">
                  <p>{t('marketplace.licensed.function.alreadyActive')}</p>
                  <Link to={marketplaceHref(MARKETPLACE_PATH, propertyId)} className={WIZARD_LINK_CLASS}>
                    {t('marketplace.licensed.backToMarketplace')}
                  </Link>
                </Alert>
              ) : null}
              {phase === 'requested' ? (
                <Badge variant="warning" data-testid="licensed-already-requested">
                  {t('marketplace.licensed.status.requested')}
                </Badge>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
