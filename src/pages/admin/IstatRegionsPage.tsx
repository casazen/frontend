import { useState, type ReactNode } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SkeletonLine } from '@/components/ui/skeleton';
import { deadlineShown } from '@/features/compliance/lib/istat-coverage-model';
import { isHttpsAddress } from '@/lib/onboarding-panel';
import { formatDate } from '@/lib/utils';
import { useIstatRegions, useRereadIstatRegions } from '@/queries/use-istat-regions';
import { ISTAT_COVERAGES, type IstatCoverage, type IstatRegionRule } from '@/types/istat.types';
import { IstatRegionDialog } from './istat-region-dialog';
import { territoryName } from './istat-region-form';

const COVERAGE_BADGE: Record<IstatCoverage, 'success' | 'secondary' | 'warning'> = {
  Covered: 'success',
  NotCovered: 'secondary',
  Unknown: 'warning',
};

/** A coverage this version does not know is «da verificare», never a yes. */
const coverageOf = (value: string): IstatCoverage => ISTAT_COVERAGES.find((candidate) => candidate === value) ?? 'Unknown';

const rowId = (row: Pick<IstatRegionRule, 'regionIstatCode' | 'provinceCode'>): string => (row.provinceCode ? `${row.regionIstatCode}-${row.provinceCode}` : row.regionIstatCode);

/** A link to an address of the table: opened in another tab, and only when it is an https address (a value of the table is data, never a link to trust). */
function TableLink({ href, label, testId }: { href: string | null; label: string; testId: string }) {
  const { t } = useTranslation();
  if (!isHttpsAddress(href)) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-1 font-medium text-primary-text underline underline-offset-4"
      data-testid={testId}
    >
      {label}
      <ExternalLink aria-hidden="true" className="size-3.5" />
      <span className="sr-only">{t('istatRegions.newTab')}</span>
    </a>
  );
}

function RegionRow({ row, onEdit, busy, reading }: { row: IstatRegionRule; onEdit: () => void; busy: boolean; reading: boolean }) {
  const { t } = useTranslation();
  const coverage = coverageOf(row.octorateCoverage);
  const deadline = deadlineShown(row);

  return (
    <tr className="border-b align-top last:border-0" data-testid={`istat-region-row-${rowId(row)}`} data-coverage={coverage}>
      <th scope="row" className="px-3 py-2 text-left font-medium">
        {territoryName(row)}
      </th>
      <td className="px-3 py-2">
        <span data-testid={`istat-region-system-${rowId(row)}`}>{row.system?.trim() ? row.system : t('istatRegions.notStated')}</span>
        <span className="block">
          <TableLink href={row.portalUrl} label={t('istatRegions.portal')} testId={`istat-region-portal-link-${rowId(row)}`} />
        </span>
      </td>
      <td className="px-3 py-2">{deadline.kind === 'monthly' ? t('istatRegions.deadline.monthly', { day: deadline.day }) : t(`istatRegions.deadline.${deadline.kind}`)}</td>
      <td className="px-3 py-2">
        <Badge variant={COVERAGE_BADGE[coverage]} data-testid={`istat-region-coverage-${rowId(row)}`}>
          {t(`istatRegions.coverage.${coverage}`)}
        </Badge>
      </td>
      <td className="px-3 py-2" data-testid={`istat-region-verified-${rowId(row)}`}>
        {row.verifiedAt ? formatDate(row.verifiedAt) : t('istatRegions.neverVerified')}
      </td>
      <td className="px-3 py-2">
        <TableLink href={row.sourceUrl} label={t('istatRegions.source')} testId={`istat-region-source-link-${rowId(row)}`} />
      </td>
      <td className="px-3 py-2 text-right">
        <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onEdit} loading={reading} disabled={busy} data-testid={`istat-region-edit-${rowId(row)}`}>
          <Pencil aria-hidden="true" className="mr-1 size-4" />
          {t('istatRegions.edit')}
          <span className="sr-only"> {territoryName(row)}</span>
        </Button>
      </td>
    </tr>
  );
}

/**
 * «Regioni ISTAT» (E21/F01/US02/T01, decision O6, NF-44, NF-52): the table the platform staff keeps of the ISTAT communication of each region, which the hosts read from their wizard and
 * their property page. For each region (and each of the two autonomous provinces of Trentino-Alto Adige): the system of its portal, the deadline, the statistical fields it requires,
 * whether the channel manager sends it, the source the values were read from and the day they were checked. Every row starts «da verificare» and only a save, with its source, says otherwise.
 * A tab of «Conformità» in the staff console: the platform administrator's only (the server answers 403 to anyone else). A read that failed shows the error, never the rows it held before:
 * a save replaces a whole row, so it is never made from an old read.
 */
export function IstatRegionsPage() {
  const { t } = useTranslation();
  const regions = useIstatRegions();
  const reread = useRereadIstatRegions();
  const [editing, setEditing] = useState<IstatRegionRule | null>(null);
  // The row whose form is being opened: the table is read again first, and nothing else can be opened meanwhile.
  const [opening, setOpening] = useState<string | null>(null);

  // A save replaces the whole row and the API has no version: the form starts from the row the server holds now, never from an older read, and when the table cannot be read nothing opens.
  const edit = async (row: IstatRegionRule) => {
    if (opening !== null) return;
    setOpening(row.id);
    try {
      const fresh = (await reread()).find((candidate) => candidate.id === row.id);
      if (fresh) setEditing(fresh);
      else toast.error(t('istatRegions.toast.rereadFailed'));
    } catch {
      toast.error(t('istatRegions.toast.rereadFailed'));
    } finally {
      setOpening(null);
    }
  };

  let body: ReactNode;
  if (regions.isError) {
    body = <ErrorState testId="istat-regions-error" title={t('istatRegions.loadError')} error={regions.error} onRetry={() => void regions.refetch()} />;
  } else if (!regions.data) {
    body = (
      <div data-testid="istat-regions-loading">
        <SkeletonLine lines={6} label={t('istatRegions.loading')} />
      </div>
    );
  } else if (regions.data.length === 0) {
    body = (
      <p className="py-6 text-center text-sm text-muted-foreground" data-testid="istat-regions-empty">
        {t('istatRegions.empty')}
      </p>
    );
  } else {
    const rows = regions.data;
    const toVerify = rows.filter((row) => !row.verifiedAt).length;
    body = (
      <>
        <p className="text-sm text-muted-foreground" data-testid="istat-regions-summary">
          {t('istatRegions.summary', { pending: toVerify, total: rows.length })}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="istat-regions-table">
            <caption className="sr-only">{t('istatRegions.title')}</caption>
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('istatRegions.columns.region')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('istatRegions.columns.system')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('istatRegions.columns.deadline')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('istatRegions.columns.coverage')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('istatRegions.columns.verified')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('istatRegions.columns.source')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('istatRegions.columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <RegionRow key={row.id} row={row} onEdit={() => void edit(row)} busy={opening !== null} reading={opening === row.id} />
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6" data-testid="istat-regions-page">
      <PageHeader title={t('istatRegions.title')} description={t('istatRegions.description')} />
      <Card>
        <CardContent className="space-y-3 pt-6">{body}</CardContent>
      </Card>
      {editing ? (
        <IstatRegionDialog
          key={editing.id}
          rule={editing}
          live={regions.data?.find((row) => row.id === editing.id) ?? null}
          readFailed={regions.isError}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
