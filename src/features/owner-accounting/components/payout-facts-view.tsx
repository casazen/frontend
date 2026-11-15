import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import type { PayoutFacts, PayoutStayFact } from '@/types';
import { factWords } from '../payout-facts-model';
import { useOwnerFormat } from '../use-owner-format';

/** The page where the decision about a company tenant is recorded: the withholding page opens its dialog on the stay named by `?decision=`. */
const WITHHOLDING_PATH = '/app/account/withholding';

interface StayRowProps {
  stay: PayoutStayFact;
  facts: PayoutFacts;
  propertyName: string | undefined;
  /** The decision about a company tenant exists (the tax exports are on): a stay that waits for one has the way to it. */
  canDecide: boolean;
}

function StayRow({ stay, facts, propertyName, canDecide }: StayRowProps) {
  const { t } = useTranslation();
  const { money, date, percent } = useOwnerFormat();
  const qualifying = factWords(t, 'qualifying', stay.qualifyingReason);
  const collection = factWords(t, 'collection', stay.collection);
  const portalWithholding = stay.withheldByPortal && stay.portalWithholding ? factWords(t, 'portalWithholding', stay.portalWithholding) : null;
  const verdict = factWords(t, 'verdict', stay.reason);

  return (
    <li className="min-w-0 space-y-1.5 rounded-md border border-border p-3 text-sm" data-testid="payout-fact-stay" data-in-base={stay.inBase} data-reason={stay.reason}>
      <p className="break-words font-medium">
        {propertyName ? `${propertyName} · ` : ''}
        {t('ownerAccounting.facts.stayDays', { checkIn: date(stay.checkIn), checkOut: date(stay.checkOut), count: stay.nights })}
        <span className="font-normal text-foreground/70"> · {stay.channel}</span>
      </p>
      <p className="break-words" data-testid="payout-fact-gross">
        {t('ownerAccounting.facts.gross', { amount: money(stay.gross, stay.grossCurrency) })}
        {stay.sharePercent < 100 ? ` · ${t('ownerAccounting.facts.share', { percent: percent(stay.sharePercent) })}` : ''}
        {stay.touristTax > 0 ? ` · ${t('ownerAccounting.facts.touristTax', { amount: money(stay.touristTax, stay.grossCurrency) })}` : ''}
      </p>
      <ul role="list" className="list-disc space-y-0.5 pl-5 text-foreground/80">
        <li>{qualifying}</li>
        {stay.companyTenantDecisionPending ? (
          <li data-testid="payout-fact-decision-pending">
            {t('ownerAccounting.facts.decisionPending')}{' '}
            {canDecide ? (
              <Link to={`${WITHHOLDING_PATH}?decision=${encodeURIComponent(stay.bookingId)}`} className="font-medium text-primary underline underline-offset-4">
                {t('ownerAccounting.facts.decide')}
              </Link>
            ) : null}
          </li>
        ) : null}
        <li>{collection}</li>
        {portalWithholding ? <li>{portalWithholding}</li> : null}
      </ul>
      <div className="flex flex-wrap items-center gap-2" data-testid="payout-fact-verdict">
        <Badge variant={stay.inBase ? 'warning' : 'secondary'}>{stay.inBase ? t('ownerAccounting.facts.inBase') : t('ownerAccounting.facts.outOfBase')}</Badge>
        <span className="min-w-0 break-words">
          {verdict}
          {stay.inBase && stay.baseAmount !== null ? ` ${t('ownerAccounting.facts.baseAmount', { amount: money(stay.baseAmount, facts.withholdingCurrency) })}` : ''}
        </span>
      </div>
    </li>
  );
}

interface PayoutFactsViewProps {
  facts: PayoutFacts;
  /** The names of the properties of the agency, by id: a stay carries the id only. */
  propertyNames: ReadonlyMap<string, string>;
  /**
   * What an empty list of stays says. `none`: the facts were read and there is no stay to evaluate. `blocked`: the payout is blocked, and a server that could not read the facts (a stay it cannot judge, no
   * rate of the day) answers the same empty list, so «no stay» is not a thing to say: it says that it cannot be told.
   */
  whenNoStays?: 'none' | 'blocked';
}

/**
 * The facts a withholding is decided on, as the server read them from the owner ledger (E18/F01/US01/T01, NF-117), shown read only: each stay with its owner's gross without the tourist tax (which is never in the base),
 * whether it is a qualifying short let and why, who collected the money, whether its portal already withheld, and whether it enters the base. Nothing here is typed and nothing can be changed: what is not right is put
 * right in the ledger (a payment to record, a decision about a company tenant) and the facts are read again. For an owner paid in another currency it says at which rate of the day the withholding, decided in euro, is kept.
 */
export function PayoutFactsView({ facts, propertyNames, whenNoStays = 'none' }: PayoutFactsViewProps) {
  const { t } = useTranslation();
  const { date, locale } = useOwnerFormat();
  const { flags } = useFeatureFlags();
  const canDecide = isFeatureEnabled(flags, 'taxReportingExports');

  return (
    <div className="min-w-0 space-y-2" data-testid="payout-facts-view">
      {facts.stays.length === 0 ? (
        whenNoStays === 'blocked' ? (
          <p className="break-words text-sm text-foreground/70" data-testid="payout-facts-unknown">
            {t('ownerAccounting.facts.blockedNoStays')}
          </p>
        ) : (
          <p className="break-words text-sm text-foreground/70" data-testid="payout-facts-none">
            {t('ownerAccounting.facts.none')}
          </p>
        )
      ) : (
        <ul role="list" className="space-y-2">
          {facts.stays.map((stay) => (
            <StayRow key={`${stay.bookingId}-${stay.checkIn}`} stay={stay} facts={facts} propertyName={stay.propertyId ? propertyNames.get(stay.propertyId) : undefined} canDecide={canDecide} />
          ))}
        </ul>
      )}
      {facts.fx ? (
        <p className="break-words text-sm text-foreground/70" data-testid="payout-facts-fx">
          {t('ownerAccounting.facts.fx', {
            to: facts.fx.to,
            from: facts.fx.from,
            rate: new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(facts.fx.rate),
            day: facts.fx.day ? date(facts.fx.day) : t('ownerAccounting.facts.fxNoDay'),
          })}
        </p>
      ) : null}
    </div>
  );
}
