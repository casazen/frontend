import { useTranslation } from 'react-i18next';
import { PAGE_COLUMNS_WIDE } from '@/components/layout/page-columns';
import { PlainSection } from '@/components/shared/calm';
import type {
  AgencyAmounts,
  AgencyCommission,
  AgencyGuestDocuments,
  AgencyMargin,
  AgencyOwnerInvoiceCount,
  AgencyOwnerRevenue,
  AgencyPayout,
  AgencyPortalCommissionBorne,
  AgencyPortalCost,
  AgencyRate,
  AgencySummary,
  AgencySwissTouristTax,
  AgencyWire,
} from '@/types';
import { channelName, codeLabel, ownerLabel } from './accountant-package-model';
import { NotAvailable, SummaryTable, TableBlock, type TableColumn } from './summary-table';
import { hasCurrency, useSummaryFormat, type SummaryFormat } from './use-summary-format';

const NOTE = 'break-words text-sm text-foreground/70';

const lacksCurrency = (rows: readonly { currency: string }[]): boolean => rows.some((row) => !hasCurrency(row.currency));

interface AmountsWithVatProps {
  amounts: AgencyAmounts;
  currency: string;
  format: SummaryFormat;
}

/** The taxable amount of a line of an invoice and, under it, its VAT: both in the currency of the row. */
function AmountsWithVat({ amounts, currency, format }: AmountsWithVatProps) {
  const { t } = useTranslation();
  return (
    <>
      <div>{format.money(amounts.taxable, currency)}</div>
      <div className="text-xs text-foreground/70">{t('accountantPackage.vatLine', { amount: format.money(amounts.vat, currency) })}</div>
    </>
  );
}

interface SectionProps {
  summary: AgencySummary;
}

/**
 * The documents issued in the period: to the guests, for each issuer, kind and currency, and, for a caller who may read the owner accounting, the invoices to the owners (how many, and the
 * totals for each VAT rate). Every row is in its own currency, written with it, and no row is added to another.
 */
export function DocumentsSection({ summary }: SectionProps) {
  const { t } = useTranslation();
  const format = useSummaryFormat();
  const guest = summary.guestDocuments;
  const counts: readonly AgencyOwnerInvoiceCount[] = summary.ownerAccountingIncluded ? summary.ownerInvoices.counts : [];
  const rates: readonly AgencyRate[] = summary.ownerAccountingIncluded ? summary.ownerInvoices.rates : [];
  const missing = t('accountantPackage.currencyMissing');

  const guestColumns: TableColumn<AgencyGuestDocuments>[] = [
    {
      id: 'issuer',
      header: t('accountantPackage.columns.issuer'),
      rowHeader: true,
      cell: (row) => {
        const identity = [row.issuer.countryCode, row.issuer.taxId].filter(Boolean).join(' · ');
        return (
          <>
            <div className="break-words">{row.issuer.name}</div>
            {identity ? <div className="break-words text-xs font-normal text-foreground/70">{identity}</div> : null}
          </>
        );
      },
    },
    { id: 'kind', header: t('accountantPackage.columns.kind'), cell: (row) => codeLabel('accountantPackage.kind', row.kind, t) },
    { id: 'documents', header: t('accountantPackage.columns.documents'), numeric: true, cell: (row) => format.count(row.documents) },
    { id: 'taxable', header: t('accountantPackage.columns.taxable'), numeric: true, cell: (row) => format.money(row.amounts.taxable, row.currency) },
    { id: 'vat', header: t('accountantPackage.columns.vat'), numeric: true, cell: (row) => format.money(row.amounts.vat, row.currency) },
    { id: 'total', header: t('accountantPackage.columns.total'), numeric: true, cell: (row) => format.money(row.amounts.total, row.currency) },
  ];

  const countColumns: TableColumn<AgencyOwnerInvoiceCount>[] = [
    { id: 'currency', header: t('accountantPackage.columns.currency'), rowHeader: true, cell: (row) => row.currency },
    { id: 'invoices', header: t('accountantPackage.columns.invoices'), numeric: true, cell: (row) => format.count(row.invoices) },
    { id: 'creditNotes', header: t('accountantPackage.columns.creditNotes'), numeric: true, cell: (row) => format.count(row.creditNotes) },
  ];

  const rateColumns: TableColumn<AgencyRate>[] = [
    { id: 'currency', header: t('accountantPackage.columns.currency'), rowHeader: true, cell: (row) => row.currency },
    {
      id: 'rate',
      header: t('accountantPackage.columns.rate'),
      cell: (row) => {
        if (row.ratePercent === null) return t('accountantPackage.rate.none');
        const percent = format.percent(row.ratePercent);
        return row.natureCode ? t('accountantPackage.rate.withNature', { rate: percent, code: row.natureCode }) : percent;
      },
    },
    { id: 'taxable', header: t('accountantPackage.columns.taxable'), numeric: true, cell: (row) => format.money(row.amounts.taxable, row.currency) },
    { id: 'vat', header: t('accountantPackage.columns.vat'), numeric: true, cell: (row) => format.money(row.amounts.vat, row.currency) },
    { id: 'total', header: t('accountantPackage.columns.total'), numeric: true, cell: (row) => format.money(row.amounts.total, row.currency) },
  ];

  const empty = guest.length + counts.length + rates.length === 0;

  return (
    <PlainSection title={t('accountantPackage.documents.title')} id="accountant-documents" className="scroll-mt-24" data-testid="accountant-documents">
      {empty ? (
        <p className={NOTE} data-testid="accountant-documents-empty">
          {t('accountantPackage.documents.empty')}
        </p>
      ) : (
        <div className={PAGE_COLUMNS_WIDE}>
          {guest.length > 0 ? (
            <TableBlock title={t('accountantPackage.documents.guest.title')} note={lacksCurrency(guest) ? missing : undefined} wide testId="accountant-guest-documents">
              <SummaryTable caption={t('accountantPackage.documents.guest.caption')} testId="accountant-guest-documents-table" columns={guestColumns} rows={guest} rowKey={(_, index) => String(index)} />
            </TableBlock>
          ) : null}
          {counts.length > 0 ? (
            <TableBlock title={t('accountantPackage.documents.owners.counts.title')} testId="accountant-owner-invoice-counts">
              <SummaryTable
                caption={t('accountantPackage.documents.owners.counts.caption')}
                testId="accountant-owner-invoice-counts-table"
                columns={countColumns}
                rows={counts}
                rowKey={(row, index) => `${index}-${row.currency}`}
              />
            </TableBlock>
          ) : null}
          {rates.length > 0 ? (
            <TableBlock title={t('accountantPackage.documents.owners.rates.title')} note={lacksCurrency(rates) ? missing : undefined} wide testId="accountant-owner-invoice-rates">
              <SummaryTable
                caption={t('accountantPackage.documents.owners.rates.caption')}
                testId="accountant-owner-invoice-rates-table"
                columns={rateColumns}
                rows={rates}
                rowKey={(_, index) => String(index)}
              />
            </TableBlock>
          ) : null}
        </div>
      )}
    </PlainSection>
  );
}

export function OwnersSection({ summary }: SectionProps) {
  const { t } = useTranslation();
  const format = useSummaryFormat();
  const { commissions, margin, payouts, wires, portalCommissionsBorne, owners } = summary;

  const commissionColumns: TableColumn<AgencyCommission>[] = [
    { id: 'owner', header: t('accountantPackage.columns.owner'), rowHeader: true, cell: (row) => <span className="break-words">{ownerLabel(row, t)}</span> },
    { id: 'documents', header: t('accountantPackage.columns.documents'), numeric: true, cell: (row) => format.count(row.documents) },
    { id: 'commission', header: t('accountantPackage.columns.commission'), numeric: true, cell: (row) => <AmountsWithVat amounts={row.commission} currency={row.currency} format={format} /> },
    { id: 'recharges', header: t('accountantPackage.columns.recharges'), numeric: true, cell: (row) => <AmountsWithVat amounts={row.recharges} currency={row.currency} format={format} /> },
    { id: 'expenses', header: t('accountantPackage.columns.expenses'), numeric: true, cell: (row) => format.money(row.advancedExpenses, row.currency) },
    { id: 'invoiced', header: t('accountantPackage.columns.invoiced'), numeric: true, cell: (row) => format.money(row.invoicedTotal, row.currency) },
  ];

  const marginColumns: TableColumn<AgencyMargin>[] = [
    { id: 'currency', header: t('accountantPackage.columns.currency'), rowHeader: true, cell: (row) => row.currency },
    { id: 'commissions', header: t('accountantPackage.columns.commissions'), numeric: true, cell: (row) => format.money(row.commissions, row.currency) },
    { id: 'recharges', header: t('accountantPackage.columns.recharges'), numeric: true, cell: (row) => format.money(row.recharges, row.currency) },
    { id: 'borne', header: t('accountantPackage.columns.portalCommissionsBorne'), numeric: true, cell: (row) => format.money(row.portalCommissionsBorne, row.currency) },
    { id: 'margin', header: t('accountantPackage.columns.margin'), numeric: true, cell: (row) => format.money(row.margin, row.currency) },
  ];

  const payoutColumns: TableColumn<AgencyPayout>[] = [
    { id: 'currency', header: t('accountantPackage.columns.currency'), rowHeader: true, cell: (row) => row.currency },
    { id: 'payouts', header: t('accountantPackage.columns.payouts'), numeric: true, cell: (row) => format.count(row.payouts) },
    { id: 'gross', header: t('accountantPackage.columns.gross'), numeric: true, cell: (row) => format.money(row.gross, row.currency) },
    { id: 'withholding', header: t('accountantPackage.columns.withholding'), numeric: true, cell: (row) => format.money(row.withholding, row.currency) },
    { id: 'net', header: t('accountantPackage.columns.net'), numeric: true, cell: (row) => format.money(row.net, row.currency) },
  ];

  const wireColumns: TableColumn<AgencyWire>[] = [
    { id: 'currency', header: t('accountantPackage.columns.currency'), rowHeader: true, cell: (row) => row.currency },
    { id: 'status', header: t('accountantPackage.columns.status'), cell: (row) => codeLabel('accountantPackage.wireStatus', row.status, t) },
    { id: 'batches', header: t('accountantPackage.columns.batches'), numeric: true, cell: (row) => format.count(row.batches) },
    { id: 'transfers', header: t('accountantPackage.columns.transfers'), numeric: true, cell: (row) => format.count(row.transfers) },
    { id: 'total', header: t('accountantPackage.columns.total'), numeric: true, cell: (row) => format.money(row.total, row.currency) },
  ];

  const borneColumns: TableColumn<AgencyPortalCommissionBorne>[] = [
    { id: 'channel', header: t('accountantPackage.columns.channel'), rowHeader: true, cell: (row) => channelName(row.source, t) },
    { id: 'amount', header: t('accountantPackage.columns.amount'), numeric: true, cell: (row) => format.money(row.amount, row.currency) },
  ];

  const performanceColumns: TableColumn<AgencyOwnerRevenue>[] = [
    { id: 'owner', header: t('accountantPackage.columns.owner'), rowHeader: true, cell: (row) => <span className="break-words">{ownerLabel(row, t)}</span> },
    { id: 'properties', header: t('accountantPackage.columns.properties'), numeric: true, cell: (row) => format.count(row.properties) },
    { id: 'revenue', header: t('accountantPackage.columns.revenue'), numeric: true, cell: (row) => format.plain(row.revenue) },
    {
      id: 'nights',
      header: t('accountantPackage.columns.occupiedNights'),
      numeric: true,
      cell: (row) => t('accountantPackage.stays.nights', { occupied: format.plain(row.occupiedNights), available: format.plain(row.availableNights) }),
    },
    {
      id: 'occupancy',
      header: t('accountantPackage.columns.occupancy'),
      numeric: true,
      cell: (row) => (row.occupancyRate === null ? <NotAvailable label={t('accountantPackage.notAvailable')} /> : format.ratio(row.occupancyRate)),
    },
    { id: 'stays', header: t('accountantPackage.columns.stays'), numeric: true, cell: (row) => format.plain(row.stays) },
  ];

  const empty = [commissions, margin, payouts, wires, portalCommissionsBorne, owners].every((rows) => rows.length === 0);

  return (
    <PlainSection title={t('accountantPackage.owners.title')} id="accountant-owners" className="scroll-mt-24" data-testid="accountant-owners">
      {empty ? (
        <p className={NOTE} data-testid="accountant-owners-empty">
          {t('accountantPackage.owners.empty')}
        </p>
      ) : (
        <div className={PAGE_COLUMNS_WIDE}>
          {commissions.length > 0 ? (
            <TableBlock title={t('accountantPackage.owners.commissions.title')} note={lacksCurrency(commissions) ? t('accountantPackage.currencyMissing') : undefined} wide testId="accountant-commissions">
              <SummaryTable caption={t('accountantPackage.owners.commissions.caption')} testId="accountant-commissions-table" columns={commissionColumns} rows={commissions} rowKey={(row, index) => `${index}-${row.ownerId}-${row.currency}`} />
            </TableBlock>
          ) : null}
          {margin.length > 0 ? (
            <TableBlock title={t('accountantPackage.owners.margin.title')} note={t('accountantPackage.owners.margin.note')} wide testId="accountant-margin">
              <SummaryTable caption={t('accountantPackage.owners.margin.caption')} testId="accountant-margin-table" columns={marginColumns} rows={margin} rowKey={(row, index) => `${index}-${row.currency}`} />
            </TableBlock>
          ) : null}
          {payouts.length > 0 ? (
            <TableBlock title={t('accountantPackage.owners.payouts.title')} testId="accountant-payouts">
              <SummaryTable caption={t('accountantPackage.owners.payouts.caption')} testId="accountant-payouts-table" columns={payoutColumns} rows={payouts} rowKey={(row, index) => `${index}-${row.currency}`} />
            </TableBlock>
          ) : null}
          {wires.length > 0 ? (
            <TableBlock title={t('accountantPackage.owners.wires.title')} testId="accountant-wires">
              <SummaryTable caption={t('accountantPackage.owners.wires.caption')} testId="accountant-wires-table" columns={wireColumns} rows={wires} rowKey={(row, index) => `${index}-${row.currency}-${row.status}`} />
            </TableBlock>
          ) : null}
          {portalCommissionsBorne.length > 0 ? (
            <TableBlock title={t('accountantPackage.owners.borne.title')} note={t('accountantPackage.owners.borne.note')} testId="accountant-portal-commissions-borne">
              <SummaryTable
                caption={t('accountantPackage.owners.borne.caption')}
                testId="accountant-portal-commissions-borne-table"
                columns={borneColumns}
                rows={portalCommissionsBorne}
                rowKey={(row, index) => `${index}-${row.source}-${row.currency}`}
              />
            </TableBlock>
          ) : null}
          {owners.length > 0 ? (
            <TableBlock title={t('accountantPackage.owners.performance.title')} note={t('accountantPackage.currencyNotGiven')} wide testId="accountant-owner-performance">
              <SummaryTable
                caption={t('accountantPackage.owners.performance.caption')}
                testId="accountant-owner-performance-table"
                columns={performanceColumns}
                rows={owners}
                rowKey={(row, index) => `${index}-${row.ownerId ?? 'none'}`}
              />
            </TableBlock>
          ) : null}
        </div>
      )}
    </PlainSection>
  );
}

function hasItalianTouristTax(tax: AgencySummary['touristTax']['italy']): boolean {
  return tax.owed !== 0 || (tax.paid ?? 0) !== 0 || (tax.toRemit ?? 0) !== 0 || tax.staysWithoutAmount > 0;
}

export function StaysSection({ summary }: SectionProps) {
  const { t } = useTranslation();
  const format = useSummaryFormat();
  const { stays, collections, touristTax } = summary;
  const costs = summary.portalCosts.filter((row) => row.source !== null);
  const italy = touristTax.italy;
  const notAvailable = <NotAvailable label={t('accountantPackage.notAvailable')} />;
  const orNotAvailable = (value: number | null) => (value === null ? notAvailable : format.plain(value));

  const staysColumns: TableColumn<AgencySummary['stays']>[] = [
    { id: 'stays', header: t('accountantPackage.columns.stays'), numeric: true, cell: (row) => format.count(row.stays) },
    {
      id: 'nights',
      header: t('accountantPackage.columns.occupiedNights'),
      numeric: true,
      cell: (row) => t('accountantPackage.stays.nights', { occupied: format.count(row.occupiedNights), available: format.count(row.availableNights) }),
    },
    { id: 'occupancy', header: t('accountantPackage.columns.occupancy'), numeric: true, cell: (row) => (row.occupancyRate === null ? notAvailable : format.ratio(row.occupancyRate)) },
    { id: 'revenue', header: t('accountantPackage.columns.revenue'), numeric: true, cell: (row) => format.plain(row.revenue) },
    { id: 'adr', header: t('accountantPackage.columns.adr'), numeric: true, cell: (row) => orNotAvailable(row.adr) },
    { id: 'revPar', header: t('accountantPackage.columns.revPar'), numeric: true, cell: (row) => orNotAvailable(row.revPar) },
  ];

  const collectedColumns: TableColumn<AgencySummary['collections']>[] = [
    { id: 'collected', header: t('accountantPackage.columns.amount'), numeric: true, cell: (row) => format.plain(row.collected) },
    { id: 'payments', header: t('accountantPackage.columns.payments'), numeric: true, cell: (row) => format.count(row.payments) },
  ];

  const toCollectColumns: TableColumn<AgencySummary['collections']['toCollect'][number]>[] = [
    { id: 'amount', header: t('accountantPackage.columns.amount'), numeric: true, cell: (row) => format.money(row.amount, row.currency) },
    { id: 'stays', header: t('accountantPackage.columns.stays'), numeric: true, cell: (row) => format.count(row.stays) },
  ];

  const costColumns: TableColumn<AgencyPortalCost>[] = [
    { id: 'channel', header: t('accountantPackage.columns.channel'), rowHeader: true, cell: (row) => channelName(row.source, t) },
    { id: 'kind', header: t('accountantPackage.columns.costKind'), cell: (row) => codeLabel('accountantPackage.costKind', row.kind, t) },
    { id: 'stays', header: t('accountantPackage.columns.stays'), numeric: true, cell: (row) => format.count(row.stays) },
    { id: 'gross', header: t('accountantPackage.columns.gross'), numeric: true, cell: (row) => format.plain(row.gross) },
    { id: 'cost', header: t('accountantPackage.columns.cost'), numeric: true, cell: (row) => orNotAvailable(row.cost) },
    { id: 'net', header: t('accountantPackage.columns.net'), numeric: true, cell: (row) => orNotAvailable(row.net) },
    { id: 'costRate', header: t('accountantPackage.columns.costRate'), numeric: true, cell: (row) => (row.costRate === null ? notAvailable : format.ratio(row.costRate)) },
  ];

  const italyColumns: TableColumn<AgencySummary['touristTax']['italy']>[] = [
    { id: 'owed', header: t('accountantPackage.columns.owed'), numeric: true, cell: (row) => format.plain(row.owed) },
    { id: 'paid', header: t('accountantPackage.columns.paid'), numeric: true, cell: (row) => orNotAvailable(row.paid) },
    { id: 'toRemit', header: t('accountantPackage.columns.toRemit'), numeric: true, cell: (row) => orNotAvailable(row.toRemit) },
    { id: 'withoutAmount', header: t('accountantPackage.columns.staysWithoutAmount'), numeric: true, cell: (row) => format.count(row.staysWithoutAmount) },
  ];

  const swissColumns: TableColumn<AgencySwissTouristTax>[] = [
    { id: 'canton', header: t('accountantPackage.columns.canton'), rowHeader: true, cell: (row) => row.canton || t('accountantPackage.touristTax.noCanton') },
    { id: 'documents', header: t('accountantPackage.columns.documents'), numeric: true, cell: (row) => format.count(row.documents) },
    { id: 'collected', header: t('accountantPackage.columns.collected'), numeric: true, cell: (row) => format.money(row.collected, row.currency) },
  ];

  return (
    <PlainSection title={t('accountantPackage.stays.title')} id="accountant-stays" className="scroll-mt-24" data-testid="accountant-stays">
      <p className={NOTE} data-testid="accountant-stays-currency-note">
        {t('accountantPackage.currencyNotGiven')}
      </p>
      <div className={PAGE_COLUMNS_WIDE}>
        <TableBlock title={t('accountantPackage.stays.stays.title')} wide testId="accountant-stays-figures">
          <SummaryTable caption={t('accountantPackage.stays.stays.caption')} testId="accountant-stays-table" columns={staysColumns} rows={[stays]} rowKey={() => 'stays'} />
        </TableBlock>
        <TableBlock title={t('accountantPackage.stays.collected.title')} testId="accountant-collected">
          <SummaryTable caption={t('accountantPackage.stays.collected.caption')} testId="accountant-collected-table" columns={collectedColumns} rows={[collections]} rowKey={() => 'collected'} />
        </TableBlock>
        {collections.toCollect.length > 0 ? (
          <TableBlock title={t('accountantPackage.stays.toCollect.title')} note={lacksCurrency(collections.toCollect) ? t('accountantPackage.currencyMissing') : undefined} testId="accountant-to-collect">
            <SummaryTable
              caption={t('accountantPackage.stays.toCollect.caption')}
              testId="accountant-to-collect-table"
              columns={toCollectColumns}
              rows={collections.toCollect}
              rowKey={(balance, index) => `${index}-${balance.currency}`}
            />
          </TableBlock>
        ) : null}
        {costs.length > 0 ? (
          <TableBlock title={t('accountantPackage.stays.costs.title')} note={t('accountantPackage.stays.costs.note')} wide testId="accountant-portal-costs">
            <SummaryTable caption={t('accountantPackage.stays.costs.caption')} testId="accountant-portal-costs-table" columns={costColumns} rows={costs} rowKey={(cost, index) => `${index}-${cost.source}-${cost.kind}`} />
          </TableBlock>
        ) : null}
        {hasItalianTouristTax(italy) ? (
          <TableBlock title={t('accountantPackage.touristTax.italy.title')} note={italy.paid === null ? t('accountantPackage.touristTax.italy.partial') : undefined} testId="accountant-tourist-tax-italy">
            <SummaryTable caption={t('accountantPackage.touristTax.italy.caption')} testId="accountant-tourist-tax-italy-table" columns={italyColumns} rows={[italy]} rowKey={() => 'italy'} />
          </TableBlock>
        ) : null}
        {touristTax.switzerland.length > 0 ? (
          <TableBlock title={t('accountantPackage.touristTax.switzerland.title')} note={t('accountantPackage.touristTax.switzerland.note')} testId="accountant-tourist-tax-switzerland">
            <SummaryTable
              caption={t('accountantPackage.touristTax.switzerland.caption')}
              testId="accountant-tourist-tax-switzerland-table"
              columns={swissColumns}
              rows={touristTax.switzerland}
              rowKey={(tax, index) => `${index}-${tax.canton}-${tax.currency}`}
            />
          </TableBlock>
        ) : null}
      </div>
    </PlainSection>
  );
}
