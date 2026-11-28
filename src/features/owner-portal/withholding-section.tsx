import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { todayInRome } from '@/lib/stay-dates';
import { useOwnerWithholding } from '@/queries/ownerPortal';
import type { OwnerPortalCu, OwnerPortalWithholding, OwnerPortalWithholdingDetail } from '@/types';
import { currentData } from './owner-portal-model';
import { currencyCode, formatMoney, periodLabel } from './owner-statement-model';
import { PortalLoading, PortalReadProblem, StatusPill, type PillTone } from './portal-parts';
import { MoneyNote } from './statement-parts';

const YEARS_SHOWN = 5;

const CU_STATE: Readonly<Record<string, { key: string; tone: PillTone }>> = {
  Generated: { key: 'preparing', tone: 'neutral' },
  Reviewed: { key: 'reviewed', tone: 'success' },
  Submitted: { key: 'submitted', tone: 'info' },
  Accepted: { key: 'accepted', tone: 'success' },
  Rejected: { key: 'rejected', tone: 'warning' },
};

const CU_ATTRIBUTION: Readonly<Record<string, string>> = {
  owner: 'owner',
  signatory: 'signatory',
  share: 'share',
};

function CuCard({ cu, currency, language }: { cu: OwnerPortalCu; currency: string; language: string }) {
  const { t } = useTranslation();
  const state = CU_STATE[cu.state] ?? { key: 'other', tone: 'neutral' as const };
  const attribution = Object.hasOwn(CU_ATTRIBUTION, cu.attribution) ? CU_ATTRIBUTION[cu.attribution] : null;

  return (
    <li className="min-w-0 space-y-3 rounded-md border bg-card p-4" data-testid="owner-cu" data-state={cu.state}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold">{t('ownerPortal.withholding.cu.title', { year: cu.year })}</h3>
          {cu.agencyName ? <p className="break-words text-sm text-muted-foreground">{cu.agencyName}</p> : null}
        </div>
        <StatusPill tone={state.tone}>{t(`ownerPortal.withholding.cu.state.${state.key}`)}</StatusPill>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">{t('ownerPortal.withholding.cu.base')}</dt>
          <dd className="font-semibold tabular-nums" data-testid="owner-cu-base">
            {formatMoney(cu.grossBase, currency, language)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('ownerPortal.withholding.cu.withheld')}</dt>
          <dd className="font-semibold tabular-nums" data-testid="owner-cu-withheld">
            {formatMoney(cu.withheld, currency, language)}
          </dd>
        </div>
        {cu.taxCode ? (
          <div>
            <dt className="text-muted-foreground">{t('ownerPortal.withholding.cu.taxCode')}</dt>
            <dd className="font-semibold">{cu.taxCode}</dd>
          </div>
        ) : null}
      </dl>
      {attribution ? <p className="break-words text-sm text-muted-foreground">{t(`ownerPortal.withholding.cu.attribution.${attribution}`)}</p> : null}
    </li>
  );
}

function DetailRows({ year, details, currency, language }: { year: number; details: readonly OwnerPortalWithholdingDetail[]; currency: string; language: string }) {
  const { t } = useTranslation();
  const sorted = [...details].sort((a, b) => a.month - b.month || a.propertyName.localeCompare(b.propertyName) || a.agencyName.localeCompare(b.agencyName));
  const agencies = new Set(details.map((detail) => detail.agencyId));

  return (
    <ul className="space-y-2" data-testid="owner-withholding-details">
      {sorted.map((detail, index) => (
        <li key={`${detail.agencyId}-${detail.propertyId}-${detail.month}-${index}`} className="min-w-0 rounded-md border bg-card p-3 text-sm" data-testid="owner-withholding-detail">
          <p className="break-words font-medium">
            {periodLabel(year, detail.month, language)}
            {detail.propertyName ? ` · ${detail.propertyName}` : ''}
            {agencies.size > 1 && detail.agencyName ? ` · ${detail.agencyName}` : ''}
          </p>
          <p className="break-words text-muted-foreground">
            {t('ownerPortal.withholding.detail.line', { base: formatMoney(detail.grossBase, currency, language), withheld: formatMoney(detail.amountWithheld, currency, language) })}
          </p>
        </li>
      ))}
    </ul>
  );
}

function WithholdingBody({ data, language }: { data: OwnerPortalWithholding; language: string }) {
  const { t } = useTranslation();
  const empty = data.details.length === 0 && data.cuStatements.length === 0;

  if (empty) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="owner-withholding-empty">
        {t('ownerPortal.withholding.empty', { year: data.year })}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">{t('ownerPortal.withholding.total', { year: data.year })}</p>
        <p className="text-lg font-semibold tabular-nums" data-testid="owner-withholding-total">
          {formatMoney(data.totalWithheld, data.currency, language)}
        </p>
      </div>
      {currencyCode(data.currency) ? null : <MoneyNote testId="owner-withholding-currency-missing">{t('ownerPortal.withholding.currencyMissing')}</MoneyNote>}
      {data.details.length > 0 ? <DetailRows year={data.year} details={data.details} currency={data.currency} language={language} /> : null}
      {data.cuStatements.length > 0 ? (
        <ul className="space-y-3" data-testid="owner-cus">
          {data.cuStatements.map((cu, index) => (
            <CuCard key={`${cu.agencyId}-${cu.year}-${index}`} cu={cu} currency={data.currency} language={language} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="owner-cu-none">
          {t('ownerPortal.withholding.cu.none', { year: data.year })}
        </p>
      )}
    </div>
  );
}

/**
 * «Ritenute e Certificazione Unica» of the owner portal (E18/F01/US02/T01, E18/F02/US01/T01, NF-117): what the agency withheld on the owner's payouts in a year, by month and property, in the currency of the data (euro:
 * the withholding is declared in euro), and the data of the owner's Certificazione Unica of the year once the agency reviewed it. It shows only what the owner may see: the totals, the state the agency recorded, the
 * tax code and how the record was made. NEVER the recipient of the CU (fiscal code, address), the stays it is made of or the co-owners: those are the agency's, and the page keeps only the members it draws, whatever the
 * answer carries (`asWithholding`). A refusal is told as such (the permission the owner did not give a contact, a part that is not open), never as «no withholding». It exists only behind the flag `taxReportingExports`:
 * off, nothing is drawn and nothing is asked. The year is a choice of the person and its figures are never shown under another.
 */
export function OwnerWithholdingSection() {
  const { t, i18n } = useTranslation();
  const { flags } = useFeatureFlags();
  const enabled = isFeatureEnabled(flags, 'taxReportingExports');
  const [today] = useState(() => todayInRome());
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const withholding = useOwnerWithholding(year, enabled);
  if (!enabled) return null;

  const data = currentData(withholding);

  return (
    <section aria-labelledby="owner-withholding-title" className="space-y-3" data-testid="owner-withholding">
      <h2 id="owner-withholding-title" className="text-xl font-semibold">
        {t('ownerPortal.withholding.title')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('ownerPortal.withholding.note')}</p>
      <Field label={t('ownerPortal.withholding.year')} className="sm:max-w-40">
        <Select value={year} onChange={(event) => setYear(Number(event.target.value))} data-testid="owner-withholding-year">
          {Array.from({ length: YEARS_SHOWN }, (_, index) => currentYear - index).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </Field>
      {withholding.isLoading ? (
        <PortalLoading label={t('ownerPortal.withholding.loading')} />
      ) : withholding.isError ? (
        <PortalReadProblem error={withholding.error} failedTitle={t('ownerPortal.withholding.error')} onRetry={() => void withholding.refetch()} testId="owner-withholding-error" />
      ) : data ? (
        <WithholdingBody data={data} language={i18n.language} />
      ) : null}
    </section>
  );
}
