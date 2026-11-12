import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import type { PageHeaderMenuItem } from '@/components/layout/page-header-actions';
import { FocusBlock, PlainSection, StatStrip, StatTile } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { todayInRome } from '@/lib/stay-dates';
import {
  useCloseReadiness,
  useDownloadPublishedFile,
  useOwnerNames,
  useOwnerPayout,
  useOwnerPayouts,
  useOwnerVersions,
  useVersionDetail,
} from '@/queries/use-owner-accounting';
import { useProperties } from '@/queries/use-properties';
import type { OwnerLedgerEntry, OwnerPayout, OwnerStatementVersion } from '@/types';
import { CorrectionDialog } from './components/correction-dialog';
import { Disclosure } from './components/disclosure';
import { ExternalInvoicesPanel } from './components/external-invoices-panel';
import { LedgerLineDrawer } from './components/ledger-line-drawer';
import { OwnerActionDialogs } from './components/owner-action-dialogs';
import { FinanceAdminRequired, OwnerAccountingError } from './components/owner-accounting-error';
import { PayoutReconciliationPanel } from './components/payout-reconciliation-panel';
import { TaxEvidenceView } from './components/tax-evidence';
import {
  OWNER_CLOSE_PATH,
  actionsOf,
  camelCode,
  changesSince,
  closePath,
  isKnownIssue,
  isPeriodOver,
  issuesOfVersion,
  messageOf,
  otherActionsOf,
  ownerFinancialPath,
  previewReconciliation,
  primaryActionOf,
  shortId,
  sortedEntries,
  statementPath,
  toCents,
  type ActionContext,
  type ActionKey,
  type RowActions,
} from './owner-accounting-model';
import { useOwnerActions } from './use-owner-actions';
import { useOwnerFormat } from './use-owner-format';

/**
 * The statement of an owner for a month, one version of it (E06/F05/US02/T04, NF-110): where the version stands and the next step, the figures and the
 * formula that links them, every line with its explanation and the way to its source, what changed since the previous version, the payouts with the
 * withholding evidence and the reconciliation, and the invoices linked from the agency's external fiscal system. The statement is not a fiscal document
 * and the page says so; it offers no way to issue an invoice. A published version has no edit: a change is a new version, which supersedes it.
 */
export function StatementDetailPage() {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();
  const { versionId } = useParams();

  if (!isOrgBillingAdmin(contexts)) {
    return (
      <div className="space-y-6" data-testid="statement-detail-page">
        <PageHeader title={t('ownerAccounting.statement.titleGeneric')} crumbs="auto" />
        <FinanceAdminRequired />
      </div>
    );
  }
  return <StatementLoader versionId={versionId ?? ''} />;
}

function StatementLoader({ versionId }: { versionId: string }) {
  const { t } = useTranslation();
  const detail = useVersionDetail(versionId);

  if (detail.isPending) {
    return (
      <div className="space-y-6" data-testid="statement-detail-page">
        <PageHeader title={t('ownerAccounting.statement.titleGeneric')} crumbs="auto" />
        <SkeletonCard lines={5} label={t('ownerAccounting.statement.loading')} />
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    const notFound = getHttpStatus(detail.error) === 404;
    return (
      <div className="space-y-6" data-testid="statement-detail-page">
        <PageHeader title={t('ownerAccounting.statement.titleGeneric')} crumbs="auto" />
        {notFound ? (
          <Alert
            variant="warning"
            title={t('ownerAccounting.statement.notFound')}
            action={
              <Button asChild size="sm" variant="outline">
                <Link to={OWNER_CLOSE_PATH}>{t('ownerAccounting.statement.backToClose')}</Link>
              </Button>
            }
            data-testid="statement-not-found"
          >
            {t('ownerAccounting.statement.notFoundBody')}
          </Alert>
        ) : (
          <OwnerAccountingError error={detail.error} title={t('ownerAccounting.statement.loadError')} onRetry={() => void detail.refetch()} />
        )}
      </div>
    );
  }
  return <StatementContent version={detail.data.version} entries={detail.data.entries} />;
}

const NO_ACTIONS: RowActions = { prepare: false, regenerate: false, approve: false, publish: false, payout: false, close: false, closeWaitsForTheEnd: false, stale: false };
/** The lines shown before «Mostra tutte»: a long statement is not a wall of rows. */
const VISIBLE_LINES = 25;

function StatementContent({ version, entries }: { version: OwnerStatementVersion; entries: OwnerLedgerEntry[] }) {
  const { t } = useTranslation();
  const { money, dateTime, month } = useOwnerFormat();
  const period = useMemo(() => ({ year: version.year, month: version.month }), [version.year, version.month]);
  const owners = useOwnerNames();
  const versions = useOwnerVersions(period.year, period.month, version.ownerId);
  const readiness = useCloseReadiness(period.year, period.month);
  const payouts = useOwnerPayouts(version.ownerId);
  const properties = useProperties();
  const download = useDownloadPublishedFile();
  const [explained, setExplained] = useState<OwnerLedgerEntry | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [correcting, setCorrecting] = useState(false);

  const owner = owners.data?.find((candidate) => candidate.id === version.ownerId);
  const ownerName = owner ? `${owner.firstName} ${owner.lastName}`.trim() : t('ownerAccounting.owner.unnamed', { id: shortId(version.ownerId) });
  const periodName = month(period.year, period.month);
  const title = t('ownerAccounting.statement.title', { owner: ownerName, period: periodName });

  const allVersions = versions.data ?? [];
  const latest = allVersions.find((candidate) => candidate.status !== 'Superseded') ?? null;
  const isCurrent = latest?.id === version.id;
  const ownerReadiness = readiness.data?.owners.find((candidate) => candidate.ownerId === version.ownerId);
  const monthOver = isPeriodOver(period, todayInRome());
  const ctx: ActionContext = { period, ownerId: version.ownerId, ownerName, version: latest, versionIds: allVersions.map((candidate) => candidate.id) };
  const controller = useOwnerActions(ctx);
  // What is not known is not offered: the actions wait for the versions and the readiness of the month.
  const known = versions.isSuccess && readiness.isSuccess;
  const actions = known && isCurrent
    ? actionsOf({ status: ownerReadiness?.status ?? 'Open', version: latest, isDirty: ownerReadiness?.isDirty ?? false, issues: ownerReadiness?.issues ?? [], monthOver })
    : NO_ACTIONS;
  const closed = ownerReadiness?.status === 'Closed';
  const primary = primaryActionOf(actions);

  const propertyNames = useMemo(() => new Map((Array.isArray(properties.data) ? properties.data : []).map((property) => [property.id, property.name] as const)), [properties.data]);
  const previous = version.supersedesVersionId ? allVersions.find((candidate) => candidate.id === version.supersedesVersionId) : undefined;
  const changes = previous ? changesSince(version, previous, entries) : null;
  const sorted = useMemo(() => sortedEntries(entries), [entries]);
  const shown = showAll ? sorted : sorted.slice(0, VISIBLE_LINES);
  const flagged = issuesOfVersion(version);
  const published = version.status === 'Published' || (version.status === 'Superseded' && version.publishedAt !== null);

  const payoutsOfVersion = (payouts.data ?? []).filter((payout) => payout.statementVersionId === version.id);
  const payoutsOfMonth = (payouts.data ?? []).filter((payout) => ctx.versionIds.includes(payout.statementVersionId));
  const preview = previewReconciliation(version, payoutsOfMonth, ctx.versionIds);

  const saveFile = () =>
    download.mutate(
      { versionId: version.id, fileName: `rendiconto-${period.year}-${String(period.month).padStart(2, '0')}-v${version.version}.json` },
      { onError: (error) => toast.error(messageOf(error, t)) },
    );

  const menu: PageHeaderMenuItem[] = [
    ...otherActionsOf(actions).map((action: ActionKey) => ({ label: t(`ownerAccounting.actions.${action}.label`), onClick: () => controller.ask(action), testId: `statement-menu-${action}` })),
    ...(published ? [{ label: t('ownerAccounting.statement.downloadPublished'), onClick: saveFile, testId: 'statement-menu-download' }] : []),
    ...(closed ? [] : [{ label: t('ownerAccounting.correction.open'), onClick: () => setCorrecting(true), testId: 'statement-menu-correction' }]),
    { label: t('ownerAccounting.statement.ownerProfile'), to: ownerFinancialPath(version.ownerId), testId: 'statement-menu-profile' },
  ];

  const tone = version.status === 'Flagged' ? 'warning' : version.status === 'Published' || closed ? 'success' : 'neutral';
  const focusPrimary = primary
    ? { label: t(`ownerAccounting.actions.${primary}.label`), onClick: () => controller.ask(primary), loading: controller.generating, testId: 'statement-primary' }
    : published && version.status === 'Published'
      ? { label: t('ownerAccounting.statement.downloadPublished'), onClick: saveFile, loading: download.isPending, testId: 'statement-download' }
      : { label: t('ownerAccounting.statement.backToClose'), href: closePath(period.year, period.month), testId: 'statement-back' };

  const charges = version.charges;
  const withheld = entries.filter((entry) => entry.type === 'Withholding').reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div className="space-y-8" data-testid="statement-detail-page" data-status={version.status}>
      <PageHeader
        title={title}
        description={t('ownerAccounting.statement.description', { version: version.version, status: t(`ownerAccounting.version.status.${version.status}`) })}
        crumbs={[{ label: t('ownerAccounting.title'), to: closePath(period.year, period.month) }, { label: title }]}
        secondary={menu}
      />

      <Alert variant="info" data-testid="statement-non-fiscal">
        {t('ownerAccounting.statement.nonFiscal')}
      </Alert>

      {version.status === 'Superseded' ? (
        <Alert
          variant="warning"
          data-testid="statement-superseded"
          action={
            version.supersededByVersionId ? (
              <Button asChild size="sm" variant="outline">
                <Link to={statementPath(version.supersededByVersionId)}>{t('ownerAccounting.statement.openLatest')}</Link>
              </Button>
            ) : undefined
          }
        >
          {t('ownerAccounting.statement.superseded')}
        </Alert>
      ) : null}

      <FocusBlock
        tone={tone}
        kicker={t('ownerAccounting.statement.kicker', { period: periodName })}
        title={t('ownerAccounting.statement.focusTitle', { version: version.version, status: t(`ownerAccounting.version.status.${version.status}`) })}
        body={t('ownerAccounting.statement.focusBody', { balance: money(version.closingBalance, version.currency), cutoff: dateTime(version.cutoffAt) })}
        who={closed ? t('ownerAccounting.statement.closed') : undefined}
        then={actions.stale ? t('ownerAccounting.actions.stale') : undefined}
        primary={focusPrimary}
        data-testid="statement-focus"
      />

      {flagged.length > 0 && version.status === 'Flagged' ? (
        <Alert variant="warning" title={t('ownerAccounting.statement.flaggedTitle')} data-testid="statement-flagged">
          <ul role="list" className="list-disc space-y-1 pl-5">
            {flagged.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>{isKnownIssue(issue.code) ? t(`ownerAccounting.issue.${camelCode(issue.code)}.title`) : t('ownerAccounting.issue.unknown.title', { code: issue.code })}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <StatStrip label={t('ownerAccounting.statement.figures')}>
        <StatTile label={t('ownerAccounting.statement.revenue')} value={money(version.revenue, version.currency)} />
        <StatTile label={t('ownerAccounting.statement.costs')} value={money(version.channelFees + version.commission + charges, version.currency)} />
        <StatTile label={t('ownerAccounting.statement.paidAndWithheld')} value={money(version.payments + withheld, version.currency)} />
        <StatTile label={t('ownerAccounting.statement.closing')} value={money(version.closingBalance, version.currency)} delta={t('ownerAccounting.statement.opening', { amount: money(version.openingBalance, version.currency) })} />
      </StatStrip>
      <p className="break-words text-sm text-foreground/70" data-testid="version-formula">
        {t('ownerAccounting.statement.formula', {
          opening: money(version.openingBalance, version.currency),
          revenue: money(version.revenue, version.currency),
          costs: money(version.channelFees + version.commission + charges, version.currency),
          paid: money(version.payments + withheld, version.currency),
          corrections: money(version.corrections, version.currency),
          closing: money(version.closingBalance, version.currency),
        })}
      </p>

      <PlainSection title={t('ownerAccounting.lines.title')} count={entries.length} data-testid="statement-lines">
        {entries.length === 0 ? (
          <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.lines.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <caption className="sr-only">{t('ownerAccounting.lines.caption')}</caption>
              <thead>
                <tr className="border-b border-border text-left text-foreground/70">
                  <th scope="col" className="py-2 pr-3 font-medium">{t('ownerAccounting.lines.date')}</th>
                  <th scope="col" className="py-2 pr-3 font-medium">{t('ownerAccounting.lines.item')}</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">{t('ownerAccounting.lines.share')}</th>
                  <th scope="col" className="py-2 text-right font-medium">{t('ownerAccounting.lines.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0" data-testid="statement-line" data-type={entry.type}>
                    <td className="whitespace-nowrap py-2 pr-3 align-top">{shortDate(entry.recognitionDate)}</td>
                    <td className="py-2 pr-3 align-top">
                      <Button type="button" variant="link" className="h-auto min-h-11 whitespace-normal p-0 text-left" onClick={() => setExplained(entry)} data-testid="statement-line-explain">
                        {t(`ownerAccounting.line.type.${entry.type}`)}
                      </Button>
                      {entry.reversesEntryId ? <Badge variant="outline" className="ml-2">{t('ownerAccounting.line.reversal')}</Badge> : null}
                      <p className="break-words text-foreground/70">{lineSummary(entry, t, money)}</p>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right align-top tabular-nums">{entry.sharePercent}%</td>
                    <td className="whitespace-nowrap py-2 text-right align-top tabular-nums">{money(entry.amount, entry.statementCurrency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sorted.length > VISIBLE_LINES ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((current) => !current)}>
            {showAll ? t('ownerAccounting.lines.showLess') : t('ownerAccounting.lines.showAll', { count: sorted.length })}
          </Button>
        ) : null}
      </PlainSection>

      <Disclosure title={t('ownerAccounting.changes.title')} data-testid="statement-changes">
        {changes ? (
          changes.moved.length === 0 && changes.added.length === 0 ? (
            <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.changes.none', { version: previous?.version ?? 0 })}</p>
          ) : (
            <div className="space-y-3">
              <p className="break-words text-sm">{t('ownerAccounting.changes.intro', { version: previous?.version ?? 0, cutoff: dateTime(previous?.cutoffAt) })}</p>
              <ul role="list" className="space-y-1 text-sm">
                {changes.moved.map((figure) => (
                  <li key={figure.key} className="flex flex-wrap justify-between gap-2" data-testid="statement-change-figure">
                    <span>{t(`ownerAccounting.changes.figure.${figure.key}`)}</span>
                    <span className="tabular-nums">{t('ownerAccounting.changes.from', { before: money(figure.before, version.currency), after: money(figure.after, version.currency) })}</span>
                  </li>
                ))}
              </ul>
              {changes.added.length > 0 ? (
                <div>
                  <p className="text-sm font-medium">{t('ownerAccounting.changes.added', { count: changes.added.length })}</p>
                  <ul role="list" className="mt-1 space-y-1 text-sm">
                    {changes.added.map((entry) => (
                      <li key={entry.id}>
                        <Button type="button" variant="link" className="h-auto min-h-11 whitespace-normal p-0 text-left" onClick={() => setExplained(entry)}>
                          {t('ownerAccounting.changes.addedLine', { type: t(`ownerAccounting.line.type.${entry.type}`), amount: money(entry.amount, entry.statementCurrency) })}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )
        ) : (
          <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.changes.first')}</p>
        )}
        {allVersions.length > 1 ? (
          <div className="pt-2">
            <h3 className="text-sm font-semibold">{t('ownerAccounting.changes.history')}</h3>
            <ul role="list" className="mt-1 space-y-1 text-sm" data-testid="statement-history">
              {allVersions.map((candidate) => (
                <li key={candidate.id} className="flex flex-wrap items-center gap-2">
                  {candidate.id === version.id ? (
                    <span className="font-medium">{t('ownerAccounting.changes.versionLine', { version: candidate.version, status: t(`ownerAccounting.version.status.${candidate.status}`), cutoff: dateTime(candidate.cutoffAt) })}</span>
                  ) : (
                    <Link to={statementPath(candidate.id)} className="underline underline-offset-4">
                      {t('ownerAccounting.changes.versionLine', { version: candidate.version, status: t(`ownerAccounting.version.status.${candidate.status}`), cutoff: dateTime(candidate.cutoffAt) })}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Disclosure>

      <Disclosure title={t('ownerAccounting.payments.title')} defaultOpen={primary === 'payout' || primary === 'close'} data-testid="statement-payments">
        {payouts.isPending ? (
          <p role="status" className="text-sm text-foreground/70">
            {t('ownerAccounting.reconciliation.loading')}
          </p>
        ) : payouts.isError ? (
          <Alert variant="danger">{messageOf(payouts.error, t)}</Alert>
        ) : (
          <div className="space-y-4">
            <PayoutReconciliationPanel currency={version.currency} preview={preview} payouts={payoutsOfMonth} />
            {payoutsOfVersion.map((payout) => (
              <PayoutEvidence key={payout.id} payout={payout} />
            ))}
            {toCents(withheld) !== 0 && payoutsOfVersion.length === 0 ? <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.payments.withholdingOfAnotherVersion')}</p> : null}
          </div>
        )}
        {actions.payout || actions.close ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {actions.payout ? (
              <Button type="button" variant="outline" size="sm" onClick={() => controller.ask('payout')} data-testid="statement-payout">
                {t('ownerAccounting.actions.payout.label')}
              </Button>
            ) : null}
            {actions.close ? (
              <Button type="button" size="sm" onClick={() => controller.ask('close')} data-testid="statement-close">
                {t('ownerAccounting.actions.close.label')}
              </Button>
            ) : null}
          </div>
        ) : null}
        {actions.closeWaitsForTheEnd ? <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.actions.closeWaits')}</p> : null}
      </Disclosure>

      <Disclosure title={t('ownerAccounting.external.title')} data-testid="statement-external">
        <ExternalInvoicesPanel version={version} />
      </Disclosure>

      {published ? (
        <Disclosure title={t('ownerAccounting.statement.fileTitle')} data-testid="statement-file">
          <p className="break-words text-sm text-foreground/70">
            {t('ownerAccounting.statement.fileBody', { date: dateTime(version.publishedAt), hash: (version.publishedSha256 ?? '').slice(0, 12) })}
          </p>
          <Button type="button" variant="outline" size="sm" loading={download.isPending} onClick={saveFile} data-testid="statement-file-download">
            {t('ownerAccounting.statement.downloadPublished')}
          </Button>
        </Disclosure>
      ) : null}

      <LedgerLineDrawer entry={explained} onClose={() => setExplained(null)} propertyName={explained?.propertyId ? propertyNames.get(explained.propertyId) : undefined} />
      <OwnerActionDialogs ctx={ctx} asked={controller.asked} onDismiss={controller.dismiss} generate={controller.generate} generating={controller.generating} />
      {correcting ? <CorrectionDialog open onOpenChange={(open) => !open && setCorrecting(false)} ownerId={version.ownerId} ownerName={ownerName} currency={version.currency} /> : null}
    </div>
  );
}

/** `2026-10-14` as `14/10`: the day of a line, with the month the page is already about. */
function shortDate(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/** The one line under the name of a line of the table: the share of the source it is, or what it is made of. Ids and amounts only. */
function lineSummary(entry: OwnerLedgerEntry, t: ReturnType<typeof useTranslation>['t'], money: (amount: number, currency: string) => string): string {
  if (entry.type === 'OwnerPayment' || entry.type === 'AgencyPayment' || entry.type === 'Correction' || entry.type === 'Withholding') {
    return entry.description ?? t(`ownerAccounting.line.source.${entry.source}`);
  }
  return t('ownerAccounting.lines.summary', { share: entry.sharePercent, source: money(entry.sourceAmount, entry.originalCurrency) });
}

/** The withholding decision of a payout, as recorded when it was confirmed: read when the statement is opened, never computed here. */
function PayoutEvidence({ payout }: { payout: OwnerPayout }) {
  const { t } = useTranslation();
  const { money, date } = useOwnerFormat();
  const detail = useOwnerPayout(payout.id);

  return (
    <div className="space-y-2 rounded-md border border-border p-3" data-testid="payout-evidence">
      <p className="break-words text-sm font-medium">
        {t('ownerAccounting.payments.payout', { date: date(payout.paidOn), amount: money(payout.grossAmount, payout.currency) })}
        {payout.reference ? ` · ${payout.reference}` : ''}
      </p>
      {detail.isPending ? (
        <p role="status" className="text-sm text-foreground/70">
          {t('ownerAccounting.payments.evidenceLoading')}
        </p>
      ) : detail.isError ? (
        <Alert variant="danger">{messageOf(detail.error, t)}</Alert>
      ) : detail.data.evidence.length === 0 ? (
        <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.payments.noEvidence')}</p>
      ) : (
        detail.data.evidence.map((evidence) => <TaxEvidenceView key={evidence.id} evidence={evidence} currency={payout.currency} />)
      )}
    </div>
  );
}
