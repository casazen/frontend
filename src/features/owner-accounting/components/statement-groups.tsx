import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { useDownloadVersionFile } from '@/queries/use-owner-accounting';
import type { OwnerLedgerEntry, OwnerStatementVersion } from '@/types';
import { messageOf, statementGroupsOf } from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';

/** One row of the summary: the name of the part, its amount in the currency of the version, and how many lines it holds. */
interface SummaryRow {
  key: string;
  label: string;
  amount: number;
  strong?: boolean;
  note?: string;
}

interface StatementGroupsProps {
  version: OwnerStatementVersion;
  entries: readonly OwnerLedgerEntry[];
}

/**
 * The statement grouped as its PDF is (E13/F02/US01/T02, NF-110, NF-115): the stays, what the channels kept, the withholding, the commission of the property manager, the recharges
 * and expenses, the net; and the tourist tax in a box of its own, which is never part of the net. Every amount is in the currency of the version, as the server wrote it (the lines
 * are added up in cents, nothing is worked out), and the files are the ones the owner gets: the PDF and the CSV of this version, downloaded through CasaZen.
 */
export function StatementGroups({ version, entries }: StatementGroupsProps) {
  const { t, i18n } = useTranslation();
  const { money } = useOwnerFormat();
  const download = useDownloadVersionFile();
  const grouped = useMemo(() => statementGroupsOf(version, entries), [version, entries]);
  // The file being made says so on its own button (the click is ignored, the focus stays); the other button waits for it.
  const busyWith = (format: 'pdf' | 'csv') => download.isPending && download.variables?.format === format;
  const fileBase = `rendiconto-${version.year}-${String(version.month).padStart(2, '0')}-v${version.version}`;

  const save = (format: 'pdf' | 'csv') =>
    download.mutate(
      { versionId: version.id, format, language: i18n.language, fileName: `${fileBase}.${format}` },
      { onError: (error) => toast.error(messageOf(error, t)) },
    );

  const lines = (count: number) => (count > 0 ? t('ownerAccounting.summary.lines', { count }) : undefined);
  // The rows of the table, in the order of the PDF: the parts, the total of the period, then the net (opening balance, payments, closing balance).
  const rows: SummaryRow[] = [
    ...grouped.groups.map((group) => ({ key: group.section, label: t(`ownerAccounting.summary.part.${group.section}`), amount: group.amount, note: lines(group.count) })),
    { key: 'period', label: t('ownerAccounting.summary.period'), amount: grouped.period, strong: true },
    { key: 'opening', label: t('ownerAccounting.summary.opening'), amount: grouped.opening },
    { key: 'payments', label: t('ownerAccounting.summary.payments'), amount: grouped.payments.amount, note: lines(grouped.payments.count) },
    { key: 'net', label: t('ownerAccounting.summary.net'), amount: grouped.closing, strong: true },
  ];

  return (
    <PlainSection title={t('ownerAccounting.summary.title')} data-testid="statement-groups">
      <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.summary.description', { currency: version.currency })}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] text-sm">
          <caption className="sr-only">{t('ownerAccounting.summary.caption')}</caption>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-border last:border-0" data-testid={`statement-group-${row.key}`}>
                <th scope="row" className={`py-2 pr-3 text-left align-top ${row.strong ? 'font-semibold' : 'font-normal'}`}>
                  {row.label}
                  {row.note ? <span className="block text-foreground/70">{row.note}</span> : null}
                </th>
                <td className={`whitespace-nowrap py-2 text-right align-top tabular-nums ${row.strong ? 'font-semibold' : ''}`}>{money(row.amount, version.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div role="note" className="min-w-0 space-y-1 rounded-md border border-border p-3 text-sm" data-testid="statement-tourist-tax">
        <p className="font-medium">{t('ownerAccounting.summary.touristTax.title')}</p>
        <p className="break-words text-foreground/70">{t('ownerAccounting.summary.touristTax.body')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t('ownerAccounting.summary.downloadPdfLabel')}
          loading={busyWith('pdf')}
          disabled={download.isPending && !busyWith('pdf')}
          onClick={() => save('pdf')}
          data-testid="statement-download-pdf"
        >
          {t('ownerAccounting.summary.downloadPdf')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t('ownerAccounting.summary.downloadCsvLabel')}
          loading={busyWith('csv')}
          disabled={download.isPending && !busyWith('csv')}
          onClick={() => save('csv')}
          data-testid="statement-download-csv"
        >
          {t('ownerAccounting.summary.downloadCsv')}
        </Button>
      </div>
    </PlainSection>
  );
}
