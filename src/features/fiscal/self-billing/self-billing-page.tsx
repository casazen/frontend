import { Fragment, useMemo, useState, type KeyboardEvent } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AgencyAccessRefused, AgencyFinanceGate } from '@/components/finance/agency-finance-gate';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { getManifestEntry, hasEntryPermission, isEntryFeatureEnabled } from '@/config/route-manifest';
import { isFeatureEnabled } from '@/config/feature-flags';
import { defaultPeriod, parsePeriod, periodParam, shiftPeriod } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { DocumentSdiPanel } from '@/features/fiscal/documents/document-sdi-panel';
import { formatDocumentAmount, formatDocumentDay, hasCurrencyCode, sdiScopeOf, sdiStateOf } from '@/features/fiscal/documents/document-model';
import { StatePill } from '@/features/fiscal/documents/document-state-badge';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus, getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import { romeDateOf, todayInRome } from '@/lib/stay-dates';
import { useDocumentSdi, useDownloadFiscalDocument } from '@/queries/use-fiscal-documents';
import {
  useCloseSelfBilling,
  useCorrectSelfBilling,
  useCreateSelfBillingDrafts,
  useDiscardSelfBilling,
  useIssueSelfBilling,
  useSelfBilling,
  useSelfBillingBusy,
  useSelfBillingDetail,
} from '@/queries/use-self-billing';
import type { SelfBillingDetail, SelfBillingGeneration, SelfBillingListItem } from '@/types';
import {
  CLOSE_NOTE_MAX,
  CLOSE_REASONS,
  SELF_BILLING_PATH,
  canCloseNotDue,
  canDiscardDraft,
  canIssueDraft,
  closeProblemOf,
  closeReasonKeyOf,
  closeRequestOf,
  correctionProblemOf,
  isClosedNotDue,
  isCorrectedOriginal,
  isDraftOutdated,
  keptKeyOf,
  replacesAnInvoice,
  type CloseProblem,
  type CorrectionProblem,
} from './self-billing-model';

/** The months the filter offers, counting back from the current one. */
const MONTHS_OFFERED = 24;

/** A missing amount is never a zero: nothing is shown for a figure that is not a number. */
const money = (amount: number, currency: string, language: string) => formatDocumentAmount(amount, currency, language);

/**
 * «Autofatture (TD17)» (E17/F03/US01/T02, E17/F01/US03/T01, NF-116, D17): the invoices that CasaZen makes for an Italian account holder when a foreign portal charges it a commission with no VAT (TD17, the reverse
 * charge on a service from abroad). Per month: «Prepara le bozze» makes (or makes again) the drafts from the owner ledger of the month, one for each holder and portal; each draft is reviewed (its lines, one for each
 * property, the VAT integrated, and the part of the amount that is an estimate, which the person has to accept) and issued after a confirmation; an issued one has its PDF, its XML and its state towards the SDI, with the
 * panel that sends it or declares it. The choices of the accountant (the rate, the day, the series) are the configuration of the server (⚖), and the page says so. It is behind the role and the plan of the
 * agency's money (`AgencyFinanceGate`) and the flag of the issuance of fiscal documents (off: no page, no entry in the menu); the amounts are the server's, each in its own currency.
 *
 * A TD17 the SDI rejected is corrected from here («Correggi e rimanda», FIX/FE-TD17-CORRECTION, backend `POST api/fiscal/self-billing/{id}/correct`): it counts as not issued, stays in the list as history (with a reference to
 * what replaces it, and no action) and a draft with the same number replaces it, which is issued with the issue of the page and can never be discarded. A draft that holds such a number and that nothing gives any more is
 * kept, and says why. The action is for who may use the actions of the page and needs the flag of the sending to the SDI too; with the flag off nothing of it is drawn or asked.
 *
 * A kept replacement draft (it holds the number of a rejected TD17 and the month no longer supports it) leaves with «Chiudi come non più dovuta» (FIX/FE-TD17-CLOSE-NOT-DUE, backend
 * `POST api/fiscal/self-billing/{id}/close-not-due`), for the same people and with the same flags as the correction: the person says why (mandatory, three reasons) and may leave a note, and the draft is closed for
 * good, its number staying reserved (never given to another invoice, and listed for the accountant in the register of the unused numbers). The closed draft is history in the list and in its detail, with the reason, the
 * day, the name of the person (nothing when the person is not known any more, never an id) and the note, and with no action.
 */
export function SelfBillingPage() {
  const { t } = useTranslation();
  return (
    <AgencyFinanceGate testId="self-billing-page" title={t('selfBilling.page.title')} description={t('selfBilling.page.description')} loadingLabel={t('selfBilling.page.loading')}>
      <SelfBillingBody />
    </AgencyFinanceGate>
  );
}

function SelfBillingBody() {
  const { t } = useTranslation();
  const { month } = useOwnerFormat();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const [today] = useState(() => todayInRome());
  const thisMonth = useMemo(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }), [today]);
  // The month that is over is the one to work on: it is when the commissions are known and the TD17 is due (by the 15th of the next month).
  const [period, setPeriod] = useState(() => periodParam(defaultPeriod(today)));
  const [openId, setOpenId] = useState<string | null>(null);
  // The rejected TD17 whose «Correggi e rimanda» is being confirmed: kept whole (not looked up in the list), so that a refusal told in the dialog stays there while the list is read again behind it.
  const [correcting, setCorrecting] = useState<SelfBillingListItem | null>(null);
  // The kept draft whose «Chiudi come non più dovuta» is being confirmed: kept whole for the same reason.
  const [closing, setClosing] = useState<SelfBillingListItem | null>(null);
  const [generation, setGeneration] = useState<SelfBillingGeneration | null>(null);
  const list = useSelfBilling(period === '' ? undefined : period);
  // The drafts of the list that were closed as «non più dovuta»: the rejected original they replaced says so (its replacement is not an invoice that will ever carry its number).
  const closedIds = useMemo(() => new Set((list.data ?? []).filter(isClosedNotDue).map((item) => item.id)), [list.data]);
  const drafts = useCreateSelfBillingDrafts();
  const busy = useSelfBillingBusy();
  const months = useMemo(() => Array.from({ length: MONTHS_OFFERED }, (_, index) => periodParam(shiftPeriod(thisMonth, -index))), [thisMonth]);
  const monthOptions = period !== '' && !months.includes(period) ? [period, ...months] : months;
  // Who may use the actions of the page is who its entry in the menu lets in (the role of the organization's administrators, with the flag of the issuance), as the backend asks `agency.invoice.manage` for the whole
  // organization. «Correggi e rimanda» asks the flag of the sending to the SDI too, as the endpoint does: with it off, or without the role, the action is not drawn and nothing is asked.
  const entry = getManifestEntry(SELF_BILLING_PATH);
  const mayManage = entry !== undefined && isEntryFeatureEnabled(entry, flags) && hasEntryPermission(entry, hasPermission);
  const mayCorrect = mayManage && isFeatureEnabled(flags, 'sdiSubmission');
  // «Chiudi come non più dovuta» is behind the same role and the same two flags as the correction that makes the draft it closes.
  const mayClose = mayCorrect;

  const prepare = (target: string) => {
    if (target === '') return;
    setGeneration(null);
    drafts.mutate(
      { period: target },
      {
        onSuccess: (result) => setGeneration(result),
        onError: (error) => toast.error(getProblemMessage(error, t) ?? t('selfBilling.drafts.failed')),
      },
    );
  };

  // A draft refused as outdated (409): the drafts of ITS month are made again with the same action as the button of the page, and the person is taken to its report.
  const redoDrafts = (year: number, monthOfDraft: number) => {
    const target = periodParam({ year, month: monthOfDraft });
    setPeriod(target);
    setOpenId(null);
    prepare(target);
  };

  let content;
  if (getHttpStatus(list.error) === 404) {
    // A 404 is the module being off at the server, whatever the cache still holds: said, never an empty list.
    content = (
      <p className="break-words text-sm text-foreground/70" data-testid="self-billing-unavailable">
        {t('selfBilling.page.unavailable')}
      </p>
    );
  } else if (list.isPending) {
    content = <SkeletonCard lines={4} label={t('selfBilling.page.loading')} />;
  } else if (getHttpStatus(list.error) === 403) {
    content = <AgencyAccessRefused />;
  } else if (list.isError) {
    content = <ErrorState title={t('selfBilling.page.loadError')} error={list.error} onRetry={() => void list.refetch()} testId="self-billing-error" />;
  } else if (list.data.length === 0) {
    content = (
      <p className="break-words text-sm text-foreground/70" data-testid="self-billing-empty">
        {t(period === '' ? 'selfBilling.page.empty' : 'selfBilling.page.emptyMonth')}
      </p>
    );
  } else {
    content = (
      <PlainSection title={t('selfBilling.page.listTitle')} count={list.data.length} data-testid="self-billing-list">
        {list.data.some((item) => !hasCurrencyCode(item.currency)) ? <CurrencyMissing /> : null}
        <ul role="list" className="divide-y divide-border">
          {list.data.map((item) => (
            <SelfBillingRow
              key={item.id}
              item={item}
              mayCorrect={mayCorrect}
              mayClose={mayClose}
              replacementClosed={item.replacedByDocumentId !== null && closedIds.has(item.replacedByDocumentId)}
              onOpen={() => setOpenId(item.id)}
              onCorrect={() => setCorrecting(item)}
              onCloseNotDue={() => setClosing(item)}
              onOpenReplacement={setOpenId}
            />
          ))}
        </ul>
      </PlainSection>
    );
  }

  return (
    <div className="space-y-6" data-testid="self-billing-page">
      <PageHeader title={t('selfBilling.page.title')} description={t('selfBilling.page.description')} crumbs="auto" />
      <div className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
        <p className="max-w-prose break-words text-sm text-muted-foreground" data-testid="self-billing-note">
          {t('selfBilling.page.note')}
        </p>

        <div className="flex flex-wrap items-end gap-3" data-testid="self-billing-filters">
          <Field label={t('selfBilling.page.filterPeriod')} className="w-full sm:w-64">
            <Select value={period} onChange={(event) => setPeriod(event.target.value)} data-testid="self-billing-period">
              <option value="">{t('selfBilling.page.allMonths')}</option>
              {monthOptions.map((value) => {
                const parsed = parsePeriod(value, thisMonth);
                return (
                  <option key={value} value={value}>
                    {month(parsed.year, parsed.month)}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Button type="button" disabled={period === '' || busy} loading={drafts.isPending} onClick={() => prepare(period)} data-testid="self-billing-prepare">
            {t('selfBilling.drafts.button')}
          </Button>
        </div>
        {period === '' ? <p className="text-sm text-foreground/70">{t('selfBilling.drafts.needMonth')}</p> : null}

      </div>

      {generation ? <GenerationReport generation={generation} closedIds={closedIds} mayClose={mayClose} /> : null}
      {content}

      <SelfBillingDrawer
        id={openId}
        onClose={() => setOpenId(null)}
        mayCorrect={mayCorrect}
        mayClose={mayClose}
        closedIds={closedIds}
        onCorrect={setCorrecting}
        onCloseNotDue={setClosing}
        onRedoDrafts={redoDrafts}
        onOpenReplacement={setOpenId}
      />

      {correcting !== null ? (
        <CorrectDialog
          key={correcting.id}
          item={correcting}
          onClose={() => setCorrecting(null)}
          // The replacement draft is shown at once (in the drawer, which is where it is reviewed and issued); a correction whose answer could not be read leaves the page as it is: the list says the rest.
          onCorrected={(replacement) => {
            if (replacement !== null) setOpenId(replacement.invoice.id);
          }}
        />
      ) : null}

      {/* Nothing is opened after the closing: the list and the detail are read again and show the closed draft where it is (history, no action). */}
      {closing !== null ? <CloseNotDueDialog key={closing.id} item={closing} onClose={() => setClosing(null)} /> : null}
    </div>
  );
}

/** A currency that is not a code is never made one: the amounts are written without a symbol, and this says so. */
function CurrencyMissing() {
  const { t } = useTranslation();
  return (
    <p className="break-words text-sm text-foreground/70" data-testid="self-billing-currency-missing">
      {t('selfBilling.currencyMissing')}
    </p>
  );
}

/** The word of a code when the app has one, else the code as it came (the server is newer): never a blank. */
function codeWords(prefix: string, code: string, t: TFunction, exists: (key: string) => boolean): string {
  const key = `${prefix}.${code}`;
  return exists(key) ? t(key) : (translateErrorCode(code, t) ?? code);
}

/**
 * What the drafts of the month did, in words: the counts, the owner ledger of the month when it is not posted yet (the drafts read it), the holders that need an invoice and cannot get one yet with what their issuer
 * profile misses, the commissions that are not self-billed with the reason, and the drafts that hold the number of a rejected TD17 and that nothing gives now (kept, with their number and why). It says «fatto» only for
 * what was done: a holder that could not get its draft, and a number that is held, are told, never left out and never read as «nothing to do».
 * The report is what the run found, but a draft it listed as kept that the list says was closed since (`closedIds`) holds nothing any more: it is left out, so the report never contradicts the list below it.
 */
function GenerationReport({ generation, closedIds, mayClose }: { generation: SelfBillingGeneration; closedIds: ReadonlySet<string>; mayClose: boolean }) {
  const { t, i18n } = useTranslation();
  const { month } = useOwnerFormat();
  const kept = generation.kept.filter((row) => !closedIds.has(row.documentId));
  const problems = generation.failed.length > 0 || kept.length > 0 || !generation.ledgerPosted;

  return (
    <Alert variant={problems ? 'warning' : 'success'} title={t('selfBilling.drafts.report.title', { month: month(generation.year, generation.month) })} role="status" data-testid="self-billing-report">
      <div className="space-y-2">
        {!generation.ledgerPosted ? (
          <p className="break-words" data-testid="self-billing-ledger-not-posted">
            {t('selfBilling.drafts.report.ledgerNotPosted')}
          </p>
        ) : null}
        <p className="break-words" data-testid="self-billing-report-counts">
          {t('selfBilling.drafts.report.counts', { created: generation.created, updated: generation.updated, issued: generation.alreadyIssued, discarded: generation.discarded })}
        </p>
        {generation.failed.length > 0 ? (
          <div data-testid="self-billing-report-failed">
            <p className="font-medium">{t('selfBilling.drafts.report.failed', { count: generation.failed.length })}</p>
            <ul role="list" className="mt-1 list-disc space-y-1 pl-5">
              {generation.failed.map((failure, index) => (
                <li key={`${failure.holderKind}-${failure.holderOwnerId ?? ''}-${failure.portalName}-${index}`} className="break-words">
                  {t('selfBilling.drafts.report.failedRow', {
                    holder: t(`selfBilling.holder.${failure.holderKind === 'Owner' ? 'Owner' : 'Agency'}`),
                    portal: failure.portalName,
                    reason: codeWords('selfBilling.reason', failure.code, t, i18n.exists),
                  })}
                  {failure.fields.length > 0 ? ` ${t('selfBilling.drafts.report.fields', { fields: failure.fields.map((field) => (i18n.exists(`ownerIssuer.fields.${field}.label`) ? t(`ownerIssuer.fields.${field}.label`) : field)).join(', ') })}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {kept.length > 0 ? (
          <div data-testid="self-billing-report-kept">
            <p className="font-medium">{t('selfBilling.drafts.report.kept', { count: kept.length })}</p>
            <ul role="list" className="mt-1 list-disc space-y-1 pl-5">
              {kept.map((row) => {
                const holder = t(`selfBilling.holder.${row.holderKind === 'Owner' ? 'Owner' : 'Agency'}`);
                return (
                  <li key={row.documentId} className="break-words" data-testid="self-billing-report-kept-row">
                    <span className="font-medium">
                      {row.number ? t('selfBilling.drafts.report.keptRow', { holder, portal: row.portalName, number: row.number }) : t('selfBilling.drafts.report.keptRowNoNumber', { holder, portal: row.portalName })}
                    </span>
                    <span className="block">{keptWords(t, row.reason, mayClose)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {generation.notDue.length > 0 ? (
          <div data-testid="self-billing-report-not-due">
            <p className="font-medium">{t('selfBilling.drafts.report.notDue')}</p>
            <ul role="list" className="mt-1 list-disc space-y-1 pl-5">
              {generation.notDue.map((row, index) => (
                <li key={`${row.channel}-${row.reason}-${index}`} className="break-words">
                  {t('selfBilling.drafts.report.notDueRow', {
                    channel: row.channel,
                    count: row.stays,
                    amount: money(row.amount, row.currency, i18n.language),
                    reason: codeWords('selfBilling.notDue', row.reason, t, i18n.exists),
                  })}
                </li>
              ))}
            </ul>
            {generation.notDue.some((row) => !hasCurrencyCode(row.currency)) ? <CurrencyMissing /> : null}
          </div>
        ) : null}
      </div>
    </Alert>
  );
}

/**
 * The state of the TD17 itself: a draft, issued, a discarded draft, an original a correction replaced («Sostituita»), an original whose replacement was closed as «non più dovuta» (it is not replaced by any invoice: the
 * rejection of the SDI stays, `RejectedClosed`), or a replacement closed as «non più dovuta»; a state this client does not know is shown as it came.
 */
function StatusBadge({ status }: { status: string }) {
  const { t, i18n } = useTranslation();
  return (
    <Badge variant={status === 'Issued' ? 'success' : status === 'Draft' ? 'warning' : 'outline'} data-testid="self-billing-status" data-status={status}>
      {i18n.exists(`selfBilling.status.${status}`) ? t(`selfBilling.status.${status}`) : status}
    </Badge>
  );
}

/** What a draft that replaces a rejected TD17 says of it: its number (the draft holds it) when there is one. */
function replacesWords(t: TFunction, number: string | null): string {
  return number ? t('selfBilling.row.replaces', { number }) : t('selfBilling.row.replacesUnknown');
}

/**
 * Why a draft is kept, in words, and, for a person who may close it, the way out too («chiudila come non più dovuta», the number never given again). Someone who cannot (the flag of the sending is off) is not invited to an
 * action that is not drawn for them.
 */
function keptWords(t: TFunction, code: string, mayClose: boolean): string {
  const why = t(keptKeyOf(code), { code });
  return mayClose ? `${why} ${t('selfBilling.kept.exit')}` : why;
}

/**
 * What a draft closed as «non più dovuta» says of itself, as history: that it took the number of a rejected TD17 and that the number stays reserved (never given to another invoice), and then, one line each, why it was
 * closed, the day (Europe/Rome), who (the name; nothing when the person is not known any more, never an id) and the note the person left. A member the server does not give is left out, never filled with a placeholder.
 * `testId` names the block (`<testId>-intro`, `-reason`, `-at`, `-by`, `-note`): the list and the drawer both draw it.
 */
function ClosedDetails({ item, testId }: { item: SelfBillingListItem; testId: string }) {
  const { t, i18n } = useTranslation();
  const reasonKey = item.closedReason === null ? null : closeReasonKeyOf(item.closedReason);
  const day = romeDateOf(item.closedAt);
  const rows: { key: string; label: string; value: string; className?: string }[] = [];
  if (item.closedReason !== null) rows.push({ key: 'reason', label: t('selfBilling.closed.reason'), value: reasonKey !== null ? t(reasonKey) : item.closedReason });
  if (day !== '') rows.push({ key: 'at', label: t('selfBilling.closed.at'), value: formatDocumentDay(day, i18n.language) });
  if (item.closedBy !== null) rows.push({ key: 'by', label: t('selfBilling.closed.by'), value: item.closedBy });
  if (item.closedNote !== null) rows.push({ key: 'note', label: t('selfBilling.closed.note'), value: item.closedNote, className: 'whitespace-pre-line' });

  return (
    <div className="space-y-1 text-sm" data-testid={testId}>
      <p className="break-words" data-testid={`${testId}-intro`}>
        {item.number ? t('selfBilling.closed.intro', { number: item.number }) : t('selfBilling.closed.introUnknown')}
      </p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
        {rows.map((row) => (
          <Fragment key={row.key}>
            <dt className="text-foreground/70">{row.label}</dt>
            <dd className={`min-w-0 break-words ${row.className ?? ''}`} data-testid={`${testId}-${row.key}`}>
              {row.value}
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

interface RowProps {
  item: SelfBillingListItem;
  /** The person may use «Correggi e rimanda» (role and flags): the button is drawn only with it AND when the server says the row `canCorrect`. */
  mayCorrect: boolean;
  /** The person may use «Chiudi come non più dovuta» (role and flags): the button is drawn only with it AND for a kept replacement draft. */
  mayClose: boolean;
  /** This row is the rejected original of a replacement that was closed as «non più dovuta»: no invoice will ever carry its number, and the row does not say it was replaced by one. */
  replacementClosed: boolean;
  onOpen: () => void;
  onCorrect: () => void;
  onCloseNotDue: () => void;
  onOpenReplacement: (id: string) => void;
}

/**
 * One TD17: who holds the account of the portal (the agency, or an owner) and which portal charges the commission, the month, the day it is due by, its number once it is issued, the amounts in their own currency and where
 * it stands. A TD17 the SDI rejected offers «Correggi e rimanda» when the server says it can be corrected; the original a correction discarded is history, with a reference to what replaces it and no action; a draft that
 * replaces one says which and holds its number; a draft that is kept says why it cannot be issued and offers «Chiudi come non più dovuta»; a draft that was closed that way is history too (reason, day, name, note), with no action.
 */
function SelfBillingRow({ item, mayCorrect, mayClose, replacementClosed, onOpen, onCorrect, onCloseNotDue, onOpenReplacement }: RowProps) {
  const { t, i18n } = useTranslation();
  const { month } = useOwnerFormat();
  // The buttons of the card wait while any write on this TD17 (or the drafts of the month, which name none) is on its way.
  const busy = useSelfBillingBusy([item.id]);
  const issued = item.status === 'Issued';
  const replacementId = item.replacedByDocumentId;
  const original = isCorrectedOriginal(item);
  const closed = isClosedNotDue(item);
  const reviewable = canIssueDraft(item);
  const correctable = mayCorrect && item.canCorrect;
  const closable = mayClose && canCloseNotDue(item);
  const title = `${item.holderName} · ${item.portalName}`;
  const opens = issued || !reviewable;

  let standing;
  if (original) {
    if (replacementClosed) standing = item.number ? t('selfBilling.row.correctedClosed', { number: item.number }) : t('selfBilling.row.correctedClosedUnknown');
    else standing = item.number ? t('selfBilling.row.corrected', { number: item.number }) : t('selfBilling.row.correctedUnknown');
  } else if (issued && item.number) standing = t('selfBilling.row.issued', { number: item.number, date: item.issueDate ? formatDocumentDay(item.issueDate, i18n.language) : '' });
  else standing = t('selfBilling.row.due', { date: formatDocumentDay(item.dueDate, i18n.language) });

  return (
    <li className="flex flex-col gap-3 rounded-xl p-4 even:bg-muted/40 sm:flex-row sm:items-start sm:justify-between" data-testid="self-billing-row" data-status={item.status} data-id={item.id}>
      <div className="min-w-0 space-y-1">
        <h3 className="break-words text-base font-semibold" data-testid="self-billing-row-title">
          {title}
        </h3>
        <p className="break-words text-sm text-foreground/70">
          {t('selfBilling.row.monthAndHolder', { month: month(item.periodYear, item.periodMonth), holder: t(`selfBilling.holder.${item.holderKind === 'Owner' ? 'Owner' : 'Agency'}`), country: item.portalCountry })}
        </p>
        {closed ? (
          // A closed draft is not «da emettere»: it says what it was and why it ended, in place of the line of the due day and of the draft that replaces an invoice.
          <ClosedDetails item={item} testId="self-billing-row-closed" />
        ) : (
          <>
            <p className="break-words text-sm text-foreground/70" data-testid={original ? 'self-billing-row-corrected' : 'self-billing-row-due'}>
              {standing}
            </p>
            {replacesAnInvoice(item) ? (
              <p className="break-words text-sm text-foreground/70" data-testid="self-billing-row-replaces">
                {replacesWords(t, item.number)}
              </p>
            ) : null}
          </>
        )}
        {item.keptReason !== null ? (
          <p className="break-words text-sm font-medium text-foreground" data-testid="self-billing-row-kept" data-reason={item.keptReason}>
            {keptWords(t, item.keptReason, closable)}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium tabular-nums" data-testid="self-billing-row-total">
            {t('selfBilling.row.total', { amount: money(item.total, item.currency, i18n.language) })}
          </span>
          <span className="text-foreground/70 tabular-nums">{t('selfBilling.row.parts', { base: money(item.taxableBase, item.currency, i18n.language), vat: money(item.vatAmount, item.currency, i18n.language) })}</span>
          <StatusBadge status={original ? (replacementClosed ? 'RejectedClosed' : 'Replaced') : closed ? 'ClosedNotDue' : item.status} />
          {issued || original ? <StatePill state={sdiStateOf({ sdiStatus: item.sdiStatus, sdiErrorCode: null })} testId="self-billing-row-sdi" /> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-2 self-start">
        {replacementId !== null ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenReplacement(replacementId)} aria-label={t('selfBilling.row.replacementLabel', { title })} data-testid="self-billing-row-replacement">
            {t('selfBilling.row.replacement')}
          </Button>
        ) : (
          <>
            {correctable ? (
              <Button type="button" size="sm" disabled={busy} onClick={onCorrect} aria-label={t('selfBilling.correct.buttonLabel', { title })} data-testid="self-billing-row-correct">
                {t('selfBilling.correct.button')}
              </Button>
            ) : null}
            {closable ? (
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCloseNotDue} aria-label={t('selfBilling.close.buttonLabel', { title })} data-testid="self-billing-row-close">
                {t('selfBilling.close.button')}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant={opens || correctable ? 'outline' : 'default'} onClick={onOpen} aria-label={t(opens ? 'selfBilling.row.openLabel' : 'selfBilling.row.reviewLabel', { title })} data-testid="self-billing-row-open">
              {t(opens ? 'selfBilling.row.open' : 'selfBilling.row.review')}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

interface DrawerProps {
  id: string | null;
  onClose: () => void;
  mayCorrect: boolean;
  mayClose: boolean;
  /** The drafts of the list that were closed as «non più dovuta» (see `replacementClosed` of the rows). */
  closedIds: ReadonlySet<string>;
  onCorrect: (item: SelfBillingListItem) => void;
  onCloseNotDue: (item: SelfBillingListItem) => void;
  onRedoDrafts: (year: number, month: number) => void;
  onOpenReplacement: (id: string) => void;
}

/**
 * The detail of a TD17 in a drawer: the lines and the totals, the review before the issue and the issue, the discard of a draft, the correction of a rejected one, the closing of a kept replacement, and for an issued one its
 * files and its state towards the SDI. The original a correction discarded is history here too: «Sostituita», with the way to its replacement and no other action; so is a draft closed as «non più dovuta».
 */
function SelfBillingDrawer({ id, onClose, mayCorrect, mayClose, closedIds, onCorrect, onCloseNotDue, onRedoDrafts, onOpenReplacement }: DrawerProps) {
  const { t } = useTranslation();
  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl" data-testid="self-billing-drawer">
        {id !== null ? (
          <DrawerBody
            key={id}
            id={id}
            onClose={onClose}
            mayCorrect={mayCorrect}
            mayClose={mayClose}
            closedIds={closedIds}
            onCorrect={onCorrect}
            onCloseNotDue={onCloseNotDue}
            onRedoDrafts={onRedoDrafts}
            onOpenReplacement={onOpenReplacement}
          />
        ) : (
          <SheetHeader>
            <SheetTitle>{t('selfBilling.detail.title')}</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

const TH = 'px-2 py-2 text-left font-medium text-foreground/70';
const TH_NUM = 'px-2 py-2 text-right font-medium text-foreground/70';
const TD = 'px-2 py-2 align-top';
const TD_NUM = 'px-2 py-2 text-right align-top tabular-nums';

interface DrawerBodyProps {
  id: string;
  onClose: () => void;
  mayCorrect: boolean;
  mayClose: boolean;
  closedIds: ReadonlySet<string>;
  onCorrect: (item: SelfBillingListItem) => void;
  onCloseNotDue: (item: SelfBillingListItem) => void;
  onRedoDrafts: (year: number, month: number) => void;
  onOpenReplacement: (id: string) => void;
}

function DrawerBody({ id, onClose, mayCorrect, mayClose, closedIds, onCorrect, onCloseNotDue, onRedoDrafts, onOpenReplacement }: DrawerBodyProps) {
  const { t, i18n } = useTranslation();
  const { month } = useOwnerFormat();
  const query = useSelfBillingDetail(id);
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const download = useDownloadFiscalDocument();
  const busy = useSelfBillingBusy([id]);
  const [dialog, setDialog] = useState<'issue' | 'discard' | null>(null);
  const detail = getHttpStatus(query.error) === 404 || query.isError ? undefined : query.data;
  // What the API asks. The TD17 themselves (the issue, the discard) are behind `agency.invoice.manage`, which is the role that opens this page (`AgencyFinanceGate`: the owner and the administrators), and the flag of the
  // issuance: nothing of the rental areas is asked of them (an administrator of the account may hold no membership of those). The sending of an issued TD17 to the SDI is on the endpoints of the fiscal documents, which
  // ask `payment.write`: the panel offers it only to who holds it.
  const canManage = isFeatureEnabled(flags, 'fiscalDocumentIssuance');
  const canSend = canManage && hasPermission('short-rent', 'payment.write');

  let content;
  if (getHttpStatus(query.error) === 404) {
    content = (
      <p className="text-sm text-foreground/70" data-testid="self-billing-detail-gone">
        {t('selfBilling.detail.gone')}
      </p>
    );
  } else if (query.isPending) {
    content = (
      <p role="status" className="text-sm text-foreground/70">
        {t('selfBilling.detail.loading')}
      </p>
    );
  } else if (query.isError || detail === undefined) {
    content = <ErrorState title={t('selfBilling.detail.loadError')} error={query.error} onRetry={() => void query.refetch()} />;
  } else {
    const { invoice } = detail;
    const issued = invoice.status === 'Issued';
    const draft = invoice.status === 'Draft';
    // A draft that holds the number of a rejected TD17 is issued, never discarded; one that is kept (nothing gives it a TD17 now) can be neither, and says why, and is closed as «non più dovuta» by who may. A rejected TD17
    // is corrected when the server says it can be. The original a correction discarded is history, as in its row: «Sostituita», its rejection, the way to what replaces it, and no action; a draft that was closed is history too.
    const issuable = draft && canManage && canIssueDraft(invoice);
    const discardable = draft && canManage && canDiscardDraft(invoice);
    const correctable = mayCorrect && invoice.canCorrect;
    const closable = mayClose && canCloseNotDue(invoice);
    const closed = isClosedNotDue(invoice);
    const original = isCorrectedOriginal(invoice);
    const replacementId = invoice.replacedByDocumentId;
    const replacementClosed = replacementId !== null && closedIds.has(replacementId);
    const money2 = (amount: number) => money(amount, invoice.currency, i18n.language);
    content = (
      <div className="space-y-5" data-testid="self-billing-detail" data-status={invoice.status}>
        <div className="space-y-2">
          <p className="text-3xl font-semibold tabular-nums" data-testid="self-billing-detail-total">
            {money2(invoice.total)}
          </p>
          {hasCurrencyCode(invoice.currency) ? null : <CurrencyMissing />}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={original ? (replacementClosed ? 'RejectedClosed' : 'Replaced') : closed ? 'ClosedNotDue' : invoice.status} />
            {issued || original ? <StatePill state={sdiStateOf({ sdiStatus: invoice.sdiStatus, sdiErrorCode: null })} testId="self-billing-detail-sdi" /> : null}
          </div>
          <p className="break-words text-sm text-foreground/70">{t('selfBilling.detail.holder', { holder: invoice.holderName, portal: invoice.portalName })}</p>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t('selfBilling.detail.lines.title')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="self-billing-lines">
              <caption className="sr-only">{t('selfBilling.detail.lines.title')}</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className={TH}>{t('selfBilling.detail.lines.description')}</th>
                  <th scope="col" className={TH_NUM}>{t('selfBilling.detail.lines.amount')}</th>
                  <th scope="col" className={TH_NUM}>{t('selfBilling.detail.lines.vat')}</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((line) => (
                  <tr key={line.lineNumber} className="border-b last:border-0" data-testid="self-billing-line">
                    <td className={`${TD} min-w-0 break-words`}>{line.description}</td>
                    <td className={TD_NUM}>{money2(line.totalPrice)}</td>
                    <td className={TD_NUM}>{line.vatAmount === null ? t('selfBilling.detail.lines.rate', { rate: line.vatRatePercent }) : `${money2(line.vatAmount)} (${t('selfBilling.detail.lines.rate', { rate: line.vatRatePercent })})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex items-baseline justify-between gap-4"><dt className="text-foreground/70">{t('selfBilling.detail.totals.base')}</dt><dd className="tabular-nums">{money2(invoice.taxableBase)}</dd></div>
            <div className="flex items-baseline justify-between gap-4"><dt className="text-foreground/70">{t('selfBilling.detail.totals.vat')}</dt><dd className="tabular-nums">{money2(invoice.vatAmount)}</dd></div>
            <div className="flex items-baseline justify-between gap-4 border-t border-border pt-1 font-semibold"><dt>{t('selfBilling.detail.totals.total')}</dt><dd className="tabular-nums">{money2(invoice.total)}</dd></div>
          </dl>
        </section>

        {draft && detail.estimatedAmount > 0 ? (
          <Alert variant="warning" title={t('selfBilling.detail.estimate.title')} data-testid="self-billing-estimate">
            {t('selfBilling.detail.estimate.body', { amount: money2(detail.estimatedAmount) })}
          </Alert>
        ) : null}
        {detail.ruleVersion ? <p className="text-xs text-foreground/70">{t('selfBilling.detail.rule', { version: detail.ruleVersion })}</p> : null}
        {original && replacementId !== null ? (
          <Alert
            variant="info"
            title={t(replacementClosed ? 'selfBilling.detail.replaced.closedTitle' : 'selfBilling.detail.replaced.title')}
            data-testid="self-billing-replaced"
            data-replacement-closed={replacementClosed ? 'true' : undefined}
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenReplacement(replacementId)} data-testid="self-billing-replacement-open">
                {t('selfBilling.detail.replaced.open')}
              </Button>
            }
          >
            {t(replacementClosed ? 'selfBilling.detail.replaced.closedBody' : 'selfBilling.detail.replaced.body')}
          </Alert>
        ) : closed ? (
          <Alert variant="info" title={t('selfBilling.closed.title')} data-testid="self-billing-closed-alert">
            <ClosedDetails item={invoice} testId="self-billing-closed" />
          </Alert>
        ) : invoice.keptReason !== null ? (
          <Alert variant="warning" title={t('selfBilling.detail.kept.title')} data-testid="self-billing-kept" data-reason={invoice.keptReason}>
            {keptWords(t, invoice.keptReason, closable)}
          </Alert>
        ) : replacesAnInvoice(invoice) ? (
          <Alert
            variant="info"
            title={invoice.number ? t('selfBilling.detail.replaces.title', { number: invoice.number }) : t('selfBilling.detail.replaces.titleUnknown')}
            data-testid="self-billing-replaces"
          >
            {draft ? t('selfBilling.detail.replaces.body') : null}
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-2" data-testid="self-billing-actions">
          {issuable ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => setDialog('issue')} data-testid="self-billing-issue">
              {t('selfBilling.detail.issue.button')}
            </Button>
          ) : null}
          {discardable ? (
            <Button type="button" size="sm" variant="danger-outline" disabled={busy} onClick={() => setDialog('discard')} data-testid="self-billing-discard">
              {t('selfBilling.detail.discard.button')}
            </Button>
          ) : null}
          {correctable ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => onCorrect(invoice)} aria-label={t('selfBilling.correct.buttonLabel', { title: `${invoice.holderName} · ${invoice.portalName}` })} data-testid="self-billing-correct">
              {t('selfBilling.correct.button')}
            </Button>
          ) : null}
          {closable ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onCloseNotDue(invoice)} aria-label={t('selfBilling.close.buttonLabel', { title: `${invoice.holderName} · ${invoice.portalName}` })} data-testid="self-billing-close">
              {t('selfBilling.close.button')}
            </Button>
          ) : null}
          {issued ? (
            <>
              <Button type="button" size="sm" variant="outline" disabled={busy || download.isPending} loading={download.isPending && download.variables?.format === 'pdf'} onClick={() => download.mutate({ document: { id: invoice.id, source: 'CasaZen', number: invoice.number }, format: 'pdf' })} data-testid="self-billing-pdf">
                {t('selfBilling.detail.pdf')}
              </Button>
              {detail.hasXml ? (
                <Button type="button" size="sm" variant="outline" disabled={busy || download.isPending} loading={download.isPending && download.variables?.format === 'xml'} onClick={() => download.mutate({ document: { id: invoice.id, source: 'CasaZen', number: invoice.number }, format: 'xml' })} data-testid="self-billing-xml">
                  {t('selfBilling.detail.xml')}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>

        {issued ? (
          <DocumentSdiPanel
            document={{ id: invoice.id, source: 'CasaZen', status: invoice.status, sdiStatus: invoice.sdiStatus, purpose: 'SelfBilling', kind: 'Invoice', number: invoice.number, issueDate: invoice.issueDate }}
            flags={flags}
            canWrite={canSend}
            onCorrect={() => undefined}
          />
        ) : null}

        {dialog === 'issue' ? <IssueDialog detail={detail} onClose={() => setDialog(null)} onRedoDrafts={onRedoDrafts} /> : null}
        {dialog === 'discard' ? <DiscardDialog id={id} onClose={() => setDialog(null)} onDiscarded={onClose} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <SheetHeader>
        <SheetTitle>{detail ? t('selfBilling.detail.titleFor', { month: month(detail.invoice.periodYear, detail.invoice.periodMonth) }) : t('selfBilling.detail.title')}</SheetTitle>
        <SheetDescription>{t('selfBilling.detail.description')}</SheetDescription>
      </SheetHeader>
      <div className="px-6">{content}</div>
    </div>
  );
}

/**
 * The confirmation of the discard of a draft (no number is consumed). A refusal or a call that gets no answer is told in the dialog, in the words of its code (else a sentence that says the draft is still there), and the dialog
 * stays open: the confirmation lets the dialog stay open on a failure and says nothing itself, so a failure that is not told here would be a silent one.
 */
function DiscardDialog({ id, onClose, onDiscarded }: { id: string; onClose: () => void; onDiscarded: () => void }) {
  const { t } = useTranslation();
  const discard = useDiscardSelfBilling();
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        // While the call is on its way the dialog stays, so that a failure is told in it.
        if (!open && !discard.isPending) onClose();
      }}
      title={t('selfBilling.detail.discard.title')}
      description={t('selfBilling.detail.discard.description')}
      confirmLabel={t('selfBilling.detail.discard.confirm')}
      variant="destructive"
      isLoading={discard.isPending}
      onConfirm={async () => {
        setProblem(null);
        try {
          await discard.mutateAsync({ documentId: id });
        } catch (error) {
          setProblem(getProblemMessage(error, t) ?? t('selfBilling.detail.discard.failed'));
          throw error;
        }
        toast.success(t('selfBilling.detail.discard.done'));
        onDiscarded();
      }}
    >
      {problem ? (
        <Alert variant="danger" data-testid="self-billing-discard-problem">
          {problem}
        </Alert>
      ) : null}
    </ConfirmationDialog>
  );
}

/**
 * The confirmation of the issue (the TD17 is numbered in the series of its holder, and from then on it does not change): the total in its own currency and, when part of the amount is an estimate (a rule of the
 * agency or the default of the channel, not the figure of the portal), the box the person ticks to accept it, without which the button stays off and the server would refuse. A refusal is told in the dialog, in the words of
 * its code, and the dialog stays open. A draft refused as outdated (409 `document_draft_outdated`: it was made with data that changed since) is told as «rifai le bozze del mese», with the action that makes them
 * again (the same as the button of the page, for the month of this draft); until then the issue is not offered again, since it would be refused in the same way.
 */
function IssueDialog({ detail, onClose, onRedoDrafts }: { detail: SelfBillingDetail; onClose: () => void; onRedoDrafts: (year: number, month: number) => void }) {
  const { t, i18n } = useTranslation();
  const issue = useIssueSelfBilling();
  const [accepted, setAccepted] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [outdated, setOutdated] = useState(false);
  const estimate = detail.estimatedAmount > 0;
  const redo = outdated ? (
    <Button type="button" size="sm" variant="outline" onClick={() => onRedoDrafts(detail.invoice.periodYear, detail.invoice.periodMonth)} data-testid="self-billing-redo-drafts">
      {t('selfBilling.detail.issue.redo')}
    </Button>
  ) : undefined;

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        // While the call is on its way the dialog stays (Esc, the cross and a click outside included): closed, it would leave a failure with nowhere to be told.
        if (!open && !issue.isPending) onClose();
      }}
      title={t('selfBilling.detail.issue.title')}
      description={t('selfBilling.detail.issue.description', { total: money(detail.invoice.total, detail.invoice.currency, i18n.language) })}
      confirmLabel={t('selfBilling.detail.issue.confirm')}
      consequences={[t('selfBilling.detail.issue.consequence')]}
      confirmDisabled={(estimate && !accepted) || outdated}
      isLoading={issue.isPending}
      onConfirm={async () => {
        setProblem(null);
        setOutdated(false);
        try {
          const issued = await issue.mutateAsync({ documentId: detail.invoice.id, request: { acceptEstimate: estimate && accepted } });
          toast.success(issued.invoice.number ? t('selfBilling.detail.issue.doneNumbered', { number: issued.invoice.number }) : t('selfBilling.detail.issue.done'));
        } catch (error) {
          const refusedAsOutdated = isDraftOutdated(error);
          setOutdated(refusedAsOutdated);
          setProblem(refusedAsOutdated ? t('selfBilling.detail.issue.outdated') : (getProblemMessage(error, t) ?? t('selfBilling.detail.issue.failed')));
          throw error;
        }
      }}
    >
      {estimate ? (
        <label className="flex min-h-11 cursor-pointer items-start gap-2 text-sm" data-testid="self-billing-accept-estimate">
          <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>{t('selfBilling.detail.issue.accept', { amount: money(detail.estimatedAmount, detail.invoice.currency, i18n.language) })}</span>
        </label>
      ) : null}
      {problem ? (
        <Alert variant="danger" data-testid="self-billing-issue-problem" action={redo}>
          {problem}
        </Alert>
      ) : null}
    </ConfirmationDialog>
  );
}

/**
 * The confirmation of «Correggi e rimanda» of a TD17 the SDI rejected: for the tax office it was never issued, so it counts as not issued and stays in the history, a draft with the same number replaces it, and the person fixes
 * what the SDI refused and issues the draft (nothing goes to the SDI by itself). It says why the SDI refused it when the page can read that (the same read as the panel of the SDI of the detail; left out when it cannot, since
 * the correction does not depend on it). Every refusal has its own words and the dialog stays open, with no way to ask again what the server refused (not found, not correctable, no access, not open); a call that failed
 * can be asked again with «Riprova». On a 201 the dialog closes and the replacement is shown; nothing is told as done before the server answers.
 */
function CorrectDialog({ item, onClose, onCorrected }: { item: SelfBillingListItem; onClose: () => void; onCorrected: (replacement: SelfBillingDetail | null) => void }) {
  const { t } = useTranslation();
  const correct = useCorrectSelfBilling();
  const busy = useSelfBillingBusy([item.id]);
  const sdi = useDocumentSdi(item.id, sdiScopeOf({ purpose: 'SelfBilling' }));
  const [problem, setProblem] = useState<{ kind: CorrectionProblem; words: string } | null>(null);
  // The reason of the refusal in plain words, only while the read worked and says the SDI rejected it: a 404 or a 403 of that read leaves it out (a query keeps its old answer on an error: not shown then).
  const reason = !sdi.isError && sdi.data?.status === 'rejected' ? sdi.data.reason : null;
  const refused = problem !== null && problem.kind !== 'failed';

  const wordsOf = (kind: CorrectionProblem, error: unknown): string => {
    switch (kind) {
      case 'forbidden':
        return t('selfBilling.correct.problem.forbidden');
      case 'notFound':
        return t('selfBilling.correct.problem.notFound');
      case 'notCorrectable':
        return t('selfBilling.correct.problem.notCorrectable');
      case 'unavailable':
        return t('selfBilling.correct.problem.unavailable');
      default:
        return getProblemMessage(error, t) ?? t('selfBilling.correct.problem.failed');
    }
  };

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        // While the call is on its way the dialog stays (Esc, the cross and a click outside included): closed, it would leave a failure with nowhere to be told.
        if (!open && !correct.isPending) onClose();
      }}
      title={t('selfBilling.correct.title')}
      description={item.number ? t('selfBilling.correct.description', { number: item.number }) : t('selfBilling.correct.descriptionUnknown')}
      confirmLabel={problem?.kind === 'failed' ? t('shared.errorState.retry') : t('selfBilling.correct.confirm')}
      consequences={[t('selfBilling.correct.consequenceDiscarded'), t('selfBilling.correct.consequenceDraft'), t('selfBilling.correct.consequenceIssue')]}
      confirmDisabled={refused || busy}
      isLoading={correct.isPending}
      onConfirm={async () => {
        setProblem(null);
        let replacement: SelfBillingDetail | null;
        try {
          replacement = await correct.mutateAsync({ documentId: item.id });
        } catch (error) {
          const kind = correctionProblemOf(error);
          setProblem({ kind, words: wordsOf(kind, error) });
          throw error;
        }
        if (replacement === null) toast.warning(t('selfBilling.correct.unreadable'));
        else toast.success(replacement.invoice.number ? t('selfBilling.correct.done', { number: replacement.invoice.number }) : t('selfBilling.correct.doneUnknown'));
        onCorrected(replacement);
      }}
    >
      {reason ? (
        <Alert variant="warning" title={t('selfBilling.correct.reasonTitle')} data-testid="self-billing-correct-reason">
          <span className="block break-words">{reason}</span>
        </Alert>
      ) : null}
      {problem ? (
        <Alert variant="danger" data-testid="self-billing-correct-problem" data-problem={problem.kind}>
          {problem.words}
        </Alert>
      ) : null}
    </ConfirmationDialog>
  );
}

/** The closing cannot be undone: choosing a reason with the keyboard never confirms it (Enter on a radio would submit the form of the dialog); the confirmation is the button. */
const keepFromSubmitting = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter') event.preventDefault();
};

/**
 * The confirmation of «Chiudi come non più dovuta» of a kept replacement draft (the draft that holds the number of a rejected TD17 when the month no longer supports it): the person says why (one of three reasons, mandatory:
 * the confirmation stays off until one is chosen) and may leave a note (500 characters, with its count), and the dialog says plainly what the closing does: the draft is closed for good, its number stays reserved (it is
 * never given to another invoice) and goes in the register of the unused numbers that the accountant receives, and it cannot be undone. Every refusal has its own words and the dialog stays open: what the server refused is
 * not offered again (not found, already closed, not closable, no access, not open), a reason or a note the server found missing or too long is put right in place, and a call that failed can be asked again with «Riprova» (the
 * same call again with the same reason answers the closed draft, so a double click is not an error). On a 200 the dialog closes and the list and the detail, read again, show the closed draft; nothing is told as done
 * before the server answers. The note is free text that can name a person: it is in the state of this dialog and in the body of the call only, never in the address, the storage or a log, and the mutation is reset as soon
 * as a failure has been read (so its variables, which hold the note, do not stay in the cache of the mutations while the dialog waits for a retry).
 */
function CloseNotDueDialog({ item, onClose }: { item: SelfBillingListItem; onClose: () => void }) {
  const { t } = useTranslation();
  const close = useCloseSelfBilling();
  const busy = useSelfBillingBusy([item.id]);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<{ kind: CloseProblem; words: string } | null>(null);
  // What the person can put right in the dialog (a missing reason, a note that is too long) does not keep the confirmation off, and is told away as soon as they touch the form; what the server refused and asking again as it is
  // will not change does keep it off (the dialog can still be left).
  const putRight = problem?.kind === 'reasonRequired' || problem?.kind === 'noteTooLong';
  const refused = problem !== null && problem.kind !== 'failed' && !putRight;

  const wordsOf = (kind: CloseProblem, error: unknown): string => {
    switch (kind) {
      case 'reasonRequired':
        return t('selfBilling.close.problem.reasonRequired');
      case 'noteTooLong':
        return t('selfBilling.close.problem.noteTooLong', { max: CLOSE_NOTE_MAX });
      case 'alreadyClosed':
        return t('selfBilling.close.problem.alreadyClosed');
      case 'notClosable':
        return t('selfBilling.close.problem.notClosable');
      case 'notFound':
        return t('selfBilling.close.problem.notFound');
      case 'unavailable':
        return t('selfBilling.close.problem.unavailable');
      case 'forbidden':
        return t('selfBilling.close.problem.forbidden');
      default:
        return getProblemMessage(error, t) ?? t('selfBilling.close.problem.failed');
    }
  };

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        // While the call is on its way the dialog stays (Esc, the cross and a click outside included): closed, it would leave a failure with nowhere to be told.
        if (!open && !close.isPending) onClose();
      }}
      title={t('selfBilling.close.title')}
      description={item.number ? t('selfBilling.close.description', { number: item.number }) : t('selfBilling.close.descriptionUnknown')}
      confirmLabel={problem?.kind === 'failed' ? t('shared.errorState.retry') : t('selfBilling.close.confirm')}
      variant="destructive"
      // Taller than the other confirmations of the page (the reasons, the note and three consequences): on a short window it scrolls inside, and the confirmation is never out of reach.
      contentClassName="sm:max-h-[90dvh] sm:overflow-y-auto"
      consequences={[t('selfBilling.close.consequenceClosed'), t('selfBilling.close.consequenceReserved'), t('selfBilling.close.consequenceRegister')]}
      confirmDisabled={reason === '' || refused || busy}
      isLoading={close.isPending}
      onConfirm={async () => {
        setProblem(null);
        let closed: SelfBillingDetail;
        try {
          closed = await close.mutateAsync({ documentId: item.id, request: closeRequestOf(reason, note) });
        } catch (error) {
          const kind = closeProblemOf(error);
          setProblem({ kind, words: wordsOf(kind, error) });
          // The failure is told from the state of this dialog, so the mutation is dropped at once: its variables hold the note (free text that can name a person) and must not stay in the cache of the mutations while the
          // dialog waits for a retry. A retry is a new call with the same reason and note, still in the form.
          close.reset();
          throw error;
        }
        toast.success(closed.invoice.number ? t('selfBilling.close.done', { number: closed.invoice.number }) : t('selfBilling.close.doneUnknown'));
      }}
    >
      <fieldset className="grid gap-1" data-testid="self-billing-close-reasons">
        <legend className="mb-1 text-sm font-medium">{t('selfBilling.close.reasonLegend')}</legend>
        {CLOSE_REASONS.map((code) => (
          <label key={code} className="flex min-h-11 cursor-pointer items-start gap-2 py-2 text-sm">
            <input
              type="radio"
              name="self-billing-close-reason"
              className="mt-0.5 size-4 shrink-0 accent-primary"
              value={code}
              checked={reason === code}
              disabled={close.isPending}
              onKeyDown={keepFromSubmitting}
              onChange={() => {
                setReason(code);
                if (putRight) setProblem(null);
              }}
              data-testid={`self-billing-close-reason-${code}`}
            />
            <span className="min-w-0 break-words">{t(`selfBilling.close.reason.${code}`)}</span>
          </label>
        ))}
      </fieldset>

      <Field label={t('selfBilling.close.note.label')} hint={t('selfBilling.close.note.hint')} optional counter={`${note.length}/${CLOSE_NOTE_MAX}`}>
        <Textarea
          rows={3}
          maxLength={CLOSE_NOTE_MAX}
          value={note}
          disabled={close.isPending}
          onChange={(event) => {
            setNote(event.target.value);
            if (putRight) setProblem(null);
          }}
          data-testid="self-billing-close-note"
        />
      </Field>

      {problem ? (
        <Alert variant="danger" data-testid="self-billing-close-problem" data-problem={problem.kind}>
          {problem.words}
        </Alert>
      ) : null}
    </ConfirmationDialog>
  );
}
