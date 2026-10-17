import { useMemo } from 'react';
import { ArrowRight, CalendarDays, ClipboardList, Download, FileDown, Landmark, Wallet, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListRowAction } from '@/components/shared/list-view/list-types';
import type { ReportDefinition, ReportType } from '@/features/reports/report-catalog';
import { todayInRome } from '@/lib/stay-dates';

interface ReportsListOptions {
  /** The person asked to download this report: the page opens the dialog of the days and the format. */
  onDownload: (report: ReportDefinition) => void;
}

const TYPE_ICONS: Record<ReportType, LucideIcon> = {
  fiscal: Landmark,
  operational: ClipboardList,
  financial: Wallet,
};

/** The kind of a report, with an icon: the word says it, the icon only helps the eye. */
const typeCell = (type: ReportType, label: string) => {
  const Icon = TYPE_ICONS[type];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
};

/**
 * The eight reports of short rent (SR-10) as a unified list (UI-14) in `client` mode: fixed configuration, no call to the API.
 * Five columns at most: the report with its sentence, the period it suggests, the kind, the format. The action of a row is
 * "Scarica" (the dialog asks for the days and the format) or, for a report that already has its page (Alloggiati Web, the
 * payments statement), "Apri". The quick filters are the kinds: fiscal, operational, financial.
 */
export function useReportsList({ onDownload }: ReportsListOptions) {
  const { t } = useTranslation();

  return useMemo(() => {
    const today = todayInRome();
    const name = (report: ReportDefinition) => t(`reports.items.${report.id}.name`);
    const description = (report: ReportDefinition) => t(`reports.items.${report.id}.description`);
    const typeName = (report: ReportDefinition) => t(`reports.type.${report.type}`);
    const period = (report: ReportDefinition) => (report.suggested ? t(`reports.preset.${report.suggested}`) : '—');
    const formats = (report: ReportDefinition) => (report.formats.length > 0 ? report.formats.map((id) => t(`reports.format.${id}`)).join(' · ') : '—');

    return defineList<ReportDefinition>({
      key: 'reports',
      title: t('reports.title'),
      rowKey: (report) => report.id,
      rowLabel: name,
      columns: [
        {
          id: 'name',
          label: t('reports.columns.name'),
          default: true,
          always: true,
          rowHeader: true,
          sort: name,
          render: (report) => (
            <div className="min-w-0">
              <span className="font-medium">{name(report)}</span>
              <span className="mt-0.5 block break-words text-sm text-foreground/70">{description(report)}</span>
            </div>
          ),
        },
        { id: 'period', label: t('reports.columns.period'), default: true, render: period },
        {
          id: 'type',
          label: t('reports.columns.type'),
          default: true,
          sort: typeName,
          render: (report) => typeCell(report.type, typeName(report)),
          csv: typeName,
        },
        { id: 'format', label: t('reports.columns.format'), default: true, render: formats },
      ],

      search: {
        label: t('reports.search.label'),
        placeholder: t('reports.search.placeholder'),
        text: (report) => `${name(report)} ${description(report)} ${typeName(report)}`,
      },
      chips: [
        { id: 'all', label: t('reports.chips.all') },
        { id: 'fiscal', label: t('reports.chips.fiscal'), test: (report) => report.type === 'fiscal' },
        { id: 'operational', label: t('reports.chips.operational'), test: (report) => report.type === 'operational' },
        { id: 'financial', label: t('reports.chips.financial'), test: (report) => report.type === 'financial' },
      ],
      defaultChip: 'all',

      // The one thing to do about a row, always in sight: download it, or open the page that already has it.
      primaryAction: (report): ListRowAction =>
        report.source.kind === 'page'
          ? { id: 'open', label: t('reports.open'), icon: ArrowRight, href: report.source.href(today), variant: 'outline' }
          : { id: 'download', label: t('reports.download'), icon: Download, onSelect: () => onDownload(report), variant: 'outline' },

      card: (report) => ({
        title: name(report),
        sub: description(report),
        status: typeCell(report.type, typeName(report)),
        meta: [
          ...(report.suggested ? [{ icon: CalendarDays, text: period(report), label: t('reports.columns.period') }] : []),
          ...(report.formats.length > 0 ? [{ icon: FileDown, text: formats(report), label: t('reports.columns.format') }] : []),
        ],
      }),
      cardsUntil: 'xl',
      csv: false,

      empty: { icon: ClipboardList, title: t('reports.emptyTitle'), description: t('reports.emptyDescription') },
      noResults: { title: t('reports.noResultsTitle'), description: t('reports.noResultsDescription') },
      countLabel: (count) => t('reports.count', { count }),
    });
  }, [t, onDownload]);
}
