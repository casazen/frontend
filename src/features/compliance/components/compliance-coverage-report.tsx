import { useState } from 'react';
import type { TFunction } from 'i18next';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { generatePath, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatRomeDateTime, formatStayDate } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { CassettoTopic, ComplianceProofKind, CoverageEvidenceClass, CoverageReport, CoverageRow } from '@/types';
import { COVERAGE_GROUPS, formatPeriod, proofKindOfRow, rowMatchesKind, rowsOf, summarizeCoverage, type SummaryTone } from '../lib/archive-model';
import { useCassettoAvailable } from '../lib/cassetto';
import { CassettoVerifyButton } from './cassetto-verify-button';
import type { ProofUploadPrefill } from './proof-upload-dialog';

/** Rows of a group shown at first: a year of stays can hold hundreds, and the page is for what needs the host, not for a wall of rows. */
const FIRST_ROWS = 25;

const TONES: Record<SummaryTone, { Icon: LucideIcon; box: string }> = {
  danger: { Icon: AlertCircle, box: 'bg-[color:var(--color-danger-soft,#fdedee)] ring-[color:var(--color-danger-border,#f4b8bb)]' },
  warning: { Icon: AlertTriangle, box: 'bg-[color:var(--color-warning-soft,#fef4e2)] ring-[color:var(--color-warning-border,#f5d49a)]' },
  success: { Icon: CheckCircle2, box: 'bg-[color:var(--color-success-soft,#eaf7ee)] ring-[color:var(--color-success-border,#b7e2c3)]' },
  neutral: { Icon: Info, box: 'bg-muted ring-border' },
};

const ICON_TONES: Record<SummaryTone, string> = {
  danger: 'text-[color:var(--color-danger-foreground,#b4232a)]',
  warning: 'text-[color:var(--color-warning-foreground,#8a4b05)]',
  success: 'text-[color:var(--color-success-foreground,#166534)]',
  neutral: 'text-muted-foreground',
};

/** The reasons of the report that have words of their own (`complianceArchive.reason.<code>`): a code this version does not know says nothing, never the raw code. */
const KNOWN_REASONS: ReadonlySet<string> = new Set([
  'alloggiati_failed',
  'alloggiati_incomplete',
  'alloggiati_not_sent',
  'alloggiati_sending',
  'awaiting_receipt',
  'deadline_overdue',
  'entrusted_to_channel_manager',
  'evidence_missing',
  'external_verification_required',
  'no_show',
  'over_thirty_nights_not_sent',
  'period_open',
  'receipt_archived',
  'receipt_missing',
  'short_stay_at_risk',
]);

interface ComplianceCoverageReportProps {
  report: CoverageReport;
  /** The kind of proof the page is filtered to: the rows are narrowed to what that kind is about (the report has no such filter). */
  kind?: ComplianceProofKind;
  /** Whether the person may upload a proof of that kind (`alloggiati.submit`, and `payment.write` for a tax proof). */
  canUpload: (kind: ComplianceProofKind) => boolean;
  /** Starts the upload of the proof of a row, with what the row says already filled in. */
  onUpload: (prefill: ProofUploadPrefill) => void;
}

/**
 * «Cosa dobbiamo avere» for a period (CHK-12 point 8, NF-52): the obligations the host is expected to prove, with the state of each one: a proof CasaZen
 * holds («Prova disponibile»), an outcome only the area of the channel manager can tell («Da verificare nel Cassetto Compliance»), «Mancante», or
 * «Non applicabile». It never shows an inferred result: a row held only in the connected area says so and offers the shared verification, and the
 * headline says «tutte le prove sono archiviate» only when the API says the report is complete with nothing missing and nothing to verify. What
 * needs the host (missing, to verify) comes first and is open; the rest is closed behind its count.
 */
export function ComplianceCoverageReport({ report, kind, canUpload, onUpload }: ComplianceCoverageReportProps) {
  const { t, i18n } = useTranslation();
  const summary = summarizeCoverage(report);
  const { Icon, box } = TONES[summary.tone];
  const language = i18n.language;
  const narrowed = report.rows.filter((row) => rowMatchesKind(row, kind));

  return (
    <div className="space-y-6" data-testid="coverage-report">
      <div className={cn('flex items-start gap-3 rounded-xl p-4 ring-1 ring-inset', box)} data-testid="coverage-headline" data-tone={summary.tone}>
        <Icon className={cn('mt-0.5 size-5 shrink-0', ICON_TONES[summary.tone])} aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="break-words text-lg font-semibold">{t(`complianceArchive.coverage.headline.${summary.key}`, summary.key === 'missing' ? { count: summary.missing } : summary.key === 'toVerify' ? { count: summary.toVerify } : {})}</p>
          <p className="text-sm text-muted-foreground">
            {t('complianceArchive.coverage.period', { from: formatStayDate(report.from, language), to: formatStayDate(report.to, language) })}
          </p>
          <p className="text-sm" data-testid="coverage-counts">
            {t('complianceArchive.coverage.counts', { proven: summary.proven, toVerify: summary.toVerify, missing: summary.missing, notApplicable: report.notApplicable })}
          </p>
        </div>
      </div>

      {kind ? (
        <p className="text-sm text-muted-foreground" data-testid="coverage-narrowed">
          {t('complianceArchive.coverage.narrowed', { kind: t(`complianceArchive.kind.${kind}`) })}
        </p>
      ) : null}

      {COVERAGE_GROUPS.map((state) => (
        <CoverageGroup key={state} state={state} rows={rowsOf(narrowed, state)} canUpload={canUpload} onUpload={onUpload} language={language} />
      ))}
    </div>
  );
}

interface CoverageGroupProps {
  state: CoverageEvidenceClass;
  rows: CoverageRow[];
  canUpload: (kind: ComplianceProofKind) => boolean;
  onUpload: (prefill: ProofUploadPrefill) => void;
  language: string;
}

/** The rows of one state under its title. The states that need the host are open; the proven and the not applicable ones are behind their count. */
function CoverageGroup({ state, rows, canUpload, onUpload, language }: CoverageGroupProps) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(FIRST_ROWS);
  if (rows.length === 0) return null;

  const needsHost = state === 'Missing' || state === 'ExternalVerificationRequired';
  const title = `${t(`complianceArchive.coverage.group.${state}`)} (${rows.length})`;
  const list = (
    <>
      <ul className="divide-y divide-border rounded-xl border border-border" data-testid={`coverage-group-${state}`}>
        {rows.slice(0, shown).map((row) => (
          <CoverageRowItem key={rowKey(row)} row={row} canUpload={canUpload} onUpload={onUpload} language={language} />
        ))}
      </ul>
      {rows.length > shown ? (
        <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setShown((current) => current + FIRST_ROWS)}>
          {t('complianceArchive.coverage.showMore', { count: rows.length - shown })}
        </Button>
      ) : null}
    </>
  );

  return needsHost ? (
    <section className="space-y-2" aria-label={title}>
      <h2 className="font-semibold">{title}</h2>
      {list}
    </section>
  ) : (
    <details className="space-y-2" data-testid={`coverage-details-${state}`}>
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">{title}</summary>
      {list}
    </details>
  );
}

function rowKey(row: CoverageRow): string {
  return [row.kind, row.propertyId, row.bookingId ?? '', row.period ?? row.day ?? ''].join(':');
}

/** What an obligation is, in words: the communication of a stay (its code and arrival), or of a month. */
function rowTitle(t: TFunction, row: CoverageRow, language: string): string {
  if (row.kind === 'Alloggiati') {
    return t('complianceArchive.coverage.row.Alloggiati', {
      code: row.bookingCode ?? '',
      day: row.day ? formatStayDate(row.day, language) : '',
    });
  }
  const month = row.period ? formatPeriod(row.period, language) : '';
  return t(row.kind === 'Istat' ? 'complianceArchive.coverage.row.Istat' : 'complianceArchive.coverage.row.TouristTax', { month });
}

interface CoverageRowItemProps {
  row: CoverageRow;
  canUpload: (kind: ComplianceProofKind) => boolean;
  onUpload: (prefill: ProofUploadPrefill) => void;
  language: string;
}

function CoverageRowItem({ row, canUpload, onUpload, language }: CoverageRowItemProps) {
  const { t } = useTranslation();
  const cassetto = useCassettoAvailable();
  const proofKind = proofKindOfRow(row.kind);
  const mayUpload = canUpload(proofKind);
  const external = row.evidenceClass !== 'OfficialProof' && row.evidenceClass !== 'Missing' && row.evidenceClass !== 'NotApplicable';
  const topic: CassettoTopic | null = row.handoffTopic ?? (row.kind === 'Alloggiati' ? 'Alloggiati' : row.kind === 'Istat' ? 'Istat' : null);
  const prefill: ProofUploadPrefill = { propertyId: row.propertyId, kind: proofKind, ...(row.kind === 'Alloggiati' ? { day: row.day ?? undefined } : { period: row.period ?? undefined }) };
  const reason = KNOWN_REASONS.has(row.reason) ? t(`complianceArchive.reason.${row.reason}`) : '';
  const deadline = row.deadlineAt && row.evidenceClass === 'Missing' ? formatRomeDateTime(row.deadlineAt, language, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  const proofAt = row.proofAt && row.evidenceClass === 'OfficialProof' ? formatRomeDateTime(row.proofAt, language, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <li className="space-y-2 p-4" data-testid="coverage-row" data-evidence={row.evidenceClass}>
      <div className="min-w-0">
        <p className="break-words font-medium">{rowTitle(t, row, language)}</p>
        <p className="break-words text-sm text-muted-foreground">{row.propertyName}</p>
      </div>

      {reason ? <p className="text-sm">{reason}</p> : null}
      {deadline ? <p className="text-sm text-muted-foreground">{t('complianceArchive.coverage.deadline', { when: deadline })}</p> : null}
      {proofAt ? <p className="text-sm text-muted-foreground">{t('complianceArchive.coverage.proofAt', { when: proofAt })}</p> : null}

      {row.evidenceClass === 'Missing' ? (
        <div className="flex flex-wrap gap-2">
          {mayUpload ? (
            <Button type="button" size="sm" className="min-h-11" onClick={() => onUpload(prefill)} data-testid="coverage-upload">
              {t('complianceArchive.coverage.upload')}
            </Button>
          ) : null}
          {row.kind === 'Alloggiati' && row.bookingId ? (
            <Button asChild size="sm" variant="outline" className="min-h-11">
              <Link to={`${generatePath('/app/short-rent/bookings/:id', { id: row.bookingId })}?tab=alloggiati`} data-testid="coverage-open-stay">
                {t('complianceArchive.coverage.openStay')}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {external ? (
        <div className="space-y-2" data-testid="coverage-external">
          <p className="text-sm font-medium">{t('complianceArchive.coverage.toVerifyTitle')}</p>
          {topic && cassetto ? (
            <div className="flex flex-wrap items-start gap-2">
              <CassettoVerifyButton
                topic={topic}
                propertyId={row.propertyId}
                bookingId={row.kind === 'Alloggiati' ? row.bookingId : null}
                period={row.kind === 'Istat' ? row.period : null}
              />
              {mayUpload ? (
                <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => onUpload(prefill)} data-testid="coverage-have-receipt">
                  {t('complianceArchive.coverage.haveReceipt')}
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm">{t('complianceArchive.coverage.toVerifyByHand')}</p>
          )}
          <p className="text-xs text-muted-foreground" data-testid="coverage-consulted">
            {t('complianceArchive.cassetto.disclosureTitle')}
          </p>
        </div>
      ) : null}
    </li>
  );
}
