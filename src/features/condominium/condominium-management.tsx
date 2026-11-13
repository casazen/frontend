import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import {
  CONDO_BASE,
  CONDO_KEY,
  condominiumAccountingApi,
  type CondoBook,
  type CondoPeriod,
  type CondoReport,
} from '@/api/condominium-accounting.api';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getProblemMessage } from '@/lib/api-errors';
import { parseEuroAmount } from '@/lib/euro-amount';

const PDF_KINDS = ['paid', 'unpaid'] as const;
const OWNER_CADENCES = [
  'Monthly',
  'Bimonthly',
  'Semiannual',
  'Single',
  'Custom',
] as const;
const BALANCE_DISPOSITIONS = [
  'NextInstallment',
  'SeparateInstallment',
  'Refund',
  'CarryForward',
] as const;
const REPORT_TOTALS = [
  'ordinary',
  'extraordinary',
  'prior',
  'finalAmount',
  'paid',
  'stillToPay',
] as const;
const REPORT_COLUMNS = [
  'dueDate',
  'ordinary',
  'prior',
  'extraordinary',
  'due',
  'paid',
  'remaining',
] as const;
const REPORT_AMOUNTS = [
  'ordinary',
  'prior',
  'extraordinary',
  'due',
  'paid',
  'remaining',
] as const;
const selectClass = 'h-10 w-full rounded-md border bg-background px-3 text-sm';
const euro = (n: number) => formatCurrency(n, 'EUR');
function signedEuro(raw: string): number | null {
  const text = raw.trim();
  const negative = text.startsWith('-');
  const amount = parseEuroAmount(negative ? text.slice(1) : text);
  return amount === null ? null : negative ? -amount : amount;
}

/** The property owns the book even while vacant or without a rent schedule. */
export function CondominiumManagement({ propertyId }: { propertyId?: string }) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canWrite = hasPermission('long-rent', 'property.write');
  const qc = useQueryClient();
  const properties = useQuery({
    queryKey: [CONDO_KEY, 'properties'],
    queryFn: condominiumAccountingApi.properties,
  });
  const [selectedProperty, setProperty] = useState(propertyId ?? '');
  const [selectedBook, setBook] = useState('');
  const [name, setName] = useState('');
  const [month, setMonth] = useState('1');
  const property = properties.data?.find(
    (p) => p.propertyId === (propertyId ?? selectedProperty),
  );
  const book =
    property?.books.find((b) => b.id === selectedBook) ?? property?.books[0];
  const setup = useMutation({
    mutationFn: () =>
      ApiClient.post(`${CONDO_BASE}/properties/${property!.propertyId}`, {
        name: name.trim() || property!.propertyName,
        fiscalStartMonth: Number(month),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [CONDO_KEY] });
    },
  });
  return (
    <section className="space-y-5" data-testid="condominium-management">
      <p className="text-sm text-muted-foreground">{t('condoBook.intro')}</p>
      {properties.isPending ? (
        <p role="status">{t('condoBook.loading')}</p>
      ) : null}
      {properties.isError ? (
        <p role="alert">
          {t('condoBook.loadError')}{' '}
          <button
            className="underline"
            onClick={() => void properties.refetch()}
          >
            {t('condoBook.retry')}
          </button>
        </p>
      ) : null}
      {!propertyId && properties.data ? (
        <Field label={t('condoBook.property')}>
          <select
            className={selectClass}
            value={selectedProperty}
            onChange={(e) => {
              setProperty(e.target.value);
              setBook('');
            }}
          >
            <option value="">{t('condoBook.chooseProperty')}</option>
            {properties.data.map((p) => (
              <option key={p.propertyId} value={p.propertyId}>
                {p.propertyName}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {properties.data?.length === 0 ? (
        <p>{t('condoBook.noProperties')}</p>
      ) : null}
      {property && !book ? (
        <div className="space-y-4">
          <p>{t('condoBook.noBook')}</p>
          {canWrite ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!setup.isPending) setup.mutate();
              }}
            >
              <Field label={t('condoBook.name')}>
                <Input
                  value={name}
                  maxLength={200}
                  placeholder={property.propertyName}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label={t('condoBook.startMonth')}>
                <select
                  className={selectClass}
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {t(`condoBook.months.${i + 1}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Button disabled={setup.isPending} type="submit">
                {t('condoBook.setup')}
              </Button>
              {setup.isError ? (
                <p role="alert">
                  {getProblemMessage(setup.error, t) ??
                    t('condoBook.saveError')}
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}
      {property && property.books.length > 1 ? (
        <Field label={t('condoBook.book')}>
          <select
            className={selectClass}
            value={book?.id ?? ''}
            onChange={(e) => setBook(e.target.value)}
          >
            {property.books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {book ? <Book key={book.id} book={book} canWrite={canWrite} /> : null}
    </section>
  );
}

function Book({ book, canWrite }: { book: CondoBook; canWrite: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState('');
  const [year, setYear] = useState('');
  const period = book.periods.find((p) => p.id === selected) ?? book.periods[0];
  const create = useMutation({
    mutationFn: () =>
      ApiClient.post<CondoPeriod>(`${CONDO_BASE}/${book.id}/periods`, {
        label: year.trim(),
      }),
    onSuccess: (p) => {
      setSelected(p.id);
      setYear('');
      void qc.invalidateQueries({ queryKey: [CONDO_KEY] });
    },
  });
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{book.name}</h2>
      {book.periods.length > 0 ? (
        <Field label={t('condoBook.period')}>
          <select
            className={selectClass}
            value={period?.id ?? ''}
            onChange={(e) => setSelected(e.target.value)}
          >
            {book.periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {formatDate(p.startDate)} – {formatDate(p.endDate)}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <p>{t('condoBook.noPeriod')}</p>
      )}
      {canWrite ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!create.isPending && year.trim()) create.mutate();
          }}
        >
          <Field
            label={t('condoBook.newPeriod')}
            hint={t('condoBook.yearHint')}
          >
            <Input
              value={year}
              maxLength={9}
              placeholder={book.fiscalStartMonth === 1 ? '2027' : '2026/2027'}
              onChange={(e) => setYear(e.target.value)}
              required
            />
          </Field>
          <Button
            variant="outline"
            type="submit"
            disabled={create.isPending || !year.trim()}
          >
            {t('condoBook.createPeriod')}
          </Button>
          {create.isError ? (
            <p role="alert">
              {getProblemMessage(create.error, t) ?? t('condoBook.saveError')}
            </p>
          ) : null}
        </form>
      ) : null}
      {period ? (
        <Period
          key={period.id}
          book={book}
          period={period}
          canWrite={canWrite}
        />
      ) : null}
    </div>
  );
}

function Period({
  book,
  period,
  canWrite,
}: {
  book: CondoBook;
  period: CondoPeriod;
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const base = `${CONDO_BASE}/${book.id}/periods/${period.id}`;
  const report = useQuery({
    queryKey: [CONDO_KEY, book.id, period.id],
    queryFn: () => condominiumAccountingApi.report(book.id, period.id),
  });
  const [ordinary, setOrdinary] = useState('');
  const [extraordinary, setExtraordinary] = useState('');
  const [final, setFinal] = useState('');
  const [cadence, setCadence] = useState('Monthly');
  const [customDates, setCustomDates] = useState('');
  const [prior, setPrior] = useState('');
  const [disposition, setDisposition] = useState('NextInstallment');
  const [proposal, setProposal] = useState<{
    id: string;
    label: string;
    kind: string;
    ordinary: number | null;
    extraordinary: number | null;
    finalAmount: number | null;
    excerpt: string;
    notExtracted: string[];
  } | null>(null);
  const action = useMutation({
    mutationFn: ({ url, body }: { url: string; body: unknown }) =>
      ApiClient.post(url, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [CONDO_KEY] });
      void qc.invalidateQueries({ queryKey: ['condominium-manual-payments'] });
      void qc.invalidateQueries({ queryKey: ['lease-rent'] });
      void qc.invalidateQueries({ queryKey: ['long-rent-rents'] });
    },
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return ApiClient.post<{
        id: string;
        label: string;
        kind: string;
        ordinary: number | null;
        extraordinary: number | null;
        finalAmount: number | null;
        excerpt: string;
        notExtracted: string[];
      }>(`${CONDO_BASE}/${book.id}/statements/read`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: setProposal,
  });
  const pdf = useMutation({
    mutationFn: (kind: 'paid' | 'unpaid') =>
      condominiumAccountingApi.pdf(book.id, period.id, kind),
  });
  const pending = action.isPending;
  const amount = parseEuroAmount(ordinary);
  const extra = extraordinary.trim() ? parseEuroAmount(extraordinary) : 0;
  const finalAmount = parseEuroAmount(final);
  return (
    <div className="space-y-6">
      {report.isPending ? <p role="status">{t('condoBook.loading')}</p> : null}
      {report.isError ? (
        <p role="alert">
          {t('condoBook.loadError')}{' '}
          <button className="underline" onClick={() => void report.refetch()}>
            {t('condoBook.retry')}
          </button>
        </p>
      ) : null}
      {report.data ? <Report report={report.data} /> : null}
      <div className="flex flex-wrap gap-3">
        {PDF_KINDS.map((kind) => (
          <Button
            key={kind}
            variant="outline"
            disabled={pdf.isPending || !report.data}
            onClick={() => pdf.mutate(kind)}
          >
            {t(`condoBook.pdf.${kind}`)}
          </Button>
        ))}
      </div>
      {canWrite ? (
        <>
          <form
            className="space-y-4 border-t pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (amount && extra !== null && extra >= 0 && !pending)
                action.mutate({
                  url: `${base}/budget`,
                  body: {
                    ordinaryAmount: amount,
                    extraordinary: extra ? [{ amount: extra }] : [],
                    cadence,
                    customDueDates:
                      cadence === 'Custom'
                        ? customDates.split(/[\s,;]+/).filter(Boolean)
                        : undefined,
                  },
                });
            }}
          >
            <h3 className="font-semibold">{t('condoBook.budget')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('condoBook.budgetHint')}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('condoBook.ordinary')}>
                <Input
                  inputMode="decimal"
                  value={ordinary}
                  onChange={(e) => setOrdinary(e.target.value)}
                />
              </Field>
              <Field label={t('condoBook.extraordinary')}>
                <Input
                  inputMode="decimal"
                  value={extraordinary}
                  onChange={(e) => setExtraordinary(e.target.value)}
                />
              </Field>
              <Field label={t('condoBook.cadence')}>
                <select
                  className={selectClass}
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value)}
                >
                  {OWNER_CADENCES.map((c) => (
                    <option key={c} value={c}>
                      {t(`condoBook.cadences.${c}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {cadence === 'Custom' ? (
              <Field
                label={t('condoBook.customDates')}
                hint={t('condoBook.customDatesHint')}
              >
                <Textarea
                  value={customDates}
                  onChange={(e) => setCustomDates(e.target.value)}
                />
              </Field>
            ) : null}
            <Button
              type="submit"
              disabled={pending || !amount || extra === null || extra < 0}
            >
              {t('condoBook.saveBudget')}
            </Button>
          </form>
          <form
            className="space-y-4 border-t pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (finalAmount && !pending)
                action.mutate({
                  url: `${base}/final`,
                  body: { amount: finalAmount, settlement: disposition },
                });
            }}
          >
            <h3 className="font-semibold">{t('condoBook.final')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('condoBook.finalHint')}
            </p>
            <Field label={t('condoBook.finalAmount')}>
              <Input
                inputMode="decimal"
                value={final}
                onChange={(e) => setFinal(e.target.value)}
              />
            </Field>
            <Field label={t('condoBook.disposition')}>
              <select
                className={selectClass}
                value={disposition}
                onChange={(e) => setDisposition(e.target.value)}
              >
                {BALANCE_DISPOSITIONS.map((d) => (
                  <option key={d} value={d}>
                    {t(`condoBook.dispositions.${d}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit" disabled={pending || !finalAmount}>
              {t('condoBook.saveFinal')}
            </Button>
          </form>
          <form
            className="space-y-4 border-t pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              const value = signedEuro(prior);
              if (value !== null && !pending)
                action.mutate({
                  url: `${base}/prior-balance`,
                  body: { amount: value, disposition },
                });
            }}
          >
            <h3 className="font-semibold">{t('condoBook.priorTitle')}</h3>
            <Field
              label={t('condoBook.priorAmount')}
              hint={t('condoBook.priorHint')}
            >
              <Input
                inputMode="decimal"
                value={prior}
                onChange={(e) => setPrior(e.target.value)}
              />
            </Field>
            <Button
              type="submit"
              disabled={pending || signedEuro(prior) === null}
            >
              {t('condoBook.savePrior')}
            </Button>
          </form>
          <div className="space-y-3 border-t pt-5">
            <h3 className="font-semibold">{t('condoBook.importTitle')}</h3>
            <Field label={t('condoBook.file')} hint={t('condoBook.fileHint')}>
              <Input
                type="file"
                accept=".pdf"
                disabled={upload.isPending || pending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setProposal(null);
                    upload.mutate(file);
                  }
                  e.target.value = '';
                }}
              />
            </Field>
            {proposal ? (
              <div className="space-y-2">
                <p>{t('condoBook.proposalReady', { year: proposal.label })}</p>
                <p>
                  {t(
                    proposal.kind === 'Budget'
                      ? 'condoBook.budget'
                      : 'condoBook.final',
                  )}{' '}
                  · {euro(proposal.ordinary ?? proposal.finalAmount ?? 0)} ·{' '}
                  {euro(proposal.extraordinary ?? 0)}
                </p>
                <p className="text-sm">{proposal.excerpt}</p>
                <ul>
                  {proposal.notExtracted.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Button
                  disabled={pending}
                  onClick={() =>
                    action.mutate(
                      {
                        url: `${CONDO_BASE}/${book.id}/statements/proposals/${proposal.id}/confirm`,
                        body: {},
                      },
                      { onSuccess: () => setProposal(null) },
                    )
                  }
                >
                  {t('condoBook.confirmImport')}
                </Button>
              </div>
            ) : null}
          </div>
          {report.data ? (
            <RecordPayment base={base} report={report.data} />
          ) : null}
        </>
      ) : null}
      {action.isSuccess ? <p role="status">{t('condoBook.saved')}</p> : null}
      {action.isError || upload.isError || pdf.isError ? (
        <p role="alert">
          {getProblemMessage(action.error ?? upload.error ?? pdf.error, t) ??
            t('condoBook.saveError')}
        </p>
      ) : null}
    </div>
  );
}

function Report({ report }: { report: CondoReport }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {REPORT_TOTALS.map((key) => (
          <div key={key}>
            <dt className="text-sm text-muted-foreground">
              {t(`condoBook.totals.${key}`)}
            </dt>
            <dd className="text-lg font-semibold">
              {report[key] == null ? '—' : euro(report[key])}
            </dd>
          </div>
        ))}
      </dl>
      {report.settlement ? (
        <p>
          {t(`condoBook.settlements.${report.settlement.direction}`, {
            amount: euro(report.settlement.amount),
          })}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="text-left font-semibold">
            {t('condoBook.installments')}
          </caption>
          <thead>
            <tr>
              {REPORT_COLUMNS.map((k) => (
                <th key={k} scope="col" className="p-2 text-left">
                  {t(`condoBook.columns.${k}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.installments.map((row) => (
              <tr key={row.id} className="border-t">
                <th scope="row" className="p-2 text-left font-normal">
                  {row.label}
                  <br />
                  {formatDate(row.dueDate)}
                </th>
                {REPORT_AMOUNTS.map((k) => (
                  <td className="whitespace-nowrap p-2" key={k}>
                    {euro(row[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {report.payments.length ? (
        <section className="space-y-2">
          <h3 className="font-semibold">{t('condoBook.payments')}</h3>
          <ul>
            {report.payments.map((p) => (
              <li key={p.id}>
                {formatDate(p.paidOn)} · {euro(p.amount)} · {p.method} ·{' '}
                {p.covers}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function RecordPayment({
  base,
  report,
}: {
  base: string;
  report: CondoReport;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [installment, setInstallment] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [attempt, setAttempt] = useState(() => crypto.randomUUID());
  const value = parseEuroAmount(amount);
  const save = useMutation({
    mutationFn: () =>
      ApiClient.post(`${base}/payments`, {
        installmentId: installment || null,
        coversPriorBalance: false,
        amount: value,
        paidOn: date,
        method: 'Bonifico home banking',
        externalSourceHash: `owner-payment:${attempt}`,
      }),
    onSuccess: () => {
      setAmount('');
      setAttempt(crypto.randomUUID());
      void qc.invalidateQueries({ queryKey: [CONDO_KEY] });
      void qc.invalidateQueries({ queryKey: ['condominium-manual-payments'] });
    },
  });
  return (
    <form
      className="space-y-4 border-t pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (value && date && !save.isPending) save.mutate();
      }}
    >
      <h3 className="font-semibold">{t('condoBook.recordPayment')}</h3>
      <p className="text-sm text-muted-foreground">
        {t('condoBook.paymentHint')}
      </p>
      <Field label={t('condoBook.installment')}>
        <select
          className={selectClass}
          value={installment}
          onChange={(e) => setInstallment(e.target.value)}
        >
          <option value="">{t('condoBook.yearPayment')}</option>
          {report.installments
            .filter((i) => i.remaining > 0)
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.label} · {euro(i.remaining)}
              </option>
            ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('condoBook.paymentAmount')}>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label={t('condoBook.paymentDate')}>
          <Input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      <Button type="submit" disabled={save.isPending || !value || !date}>
        {t('condoBook.recordPayment')}
      </Button>
      {save.isError ? (
        <p role="alert">
          {getProblemMessage(save.error, t) ?? t('condoBook.saveError')}
        </p>
      ) : null}
      {save.isSuccess ? <p role="status">{t('condoBook.saved')}</p> : null}
    </form>
  );
}
