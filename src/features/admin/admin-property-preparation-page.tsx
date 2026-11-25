import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  propertyActivationApi, propertyPreparationApi, type PreparationRow, type PreparationSelection, type PropertyImportSnapshot,
} from '@/api/property-activation.api';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getProblemMessage } from '@/lib/api-errors';

type ImportRow = PreparationSelection & { snapshot: PropertyImportSnapshot };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const preparationKey = ['property-preparation'];
const candidateKey = [...preparationKey, 'candidates'];

function isImportRow(value: unknown): value is ImportRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Partial<ImportRow>;
  return typeof row.orgId === 'string' && uuid.test(row.orgId) && typeof row.propertyId === 'string' && uuid.test(row.propertyId)
    && typeof row.snapshot?.provider === 'string' && typeof row.snapshot.sourceId === 'string'
    && Array.isArray(row.snapshot.findings) && Array.isArray(row.snapshot.ratePlans);
}

function ImportInventory({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [outcomes, setOutcomes] = useState<{ propertyId: string; problem: string | null }[]>([]);
  const upload = useMutation({
    mutationFn: async () => {
      setOutcomes([]);
      for (const row of rows) {
        let problem: string | null = null;
        try {
          await propertyActivationApi.record(row.orgId, row.propertyId, row.snapshot);
        } catch (error) {
          problem = getProblemMessage(error, t) ?? t('activationStaff.importFailure');
        }
        setOutcomes((previous) => [...previous, { propertyId: row.propertyId, problem }]);
      }
    },
    onSuccess: onSaved,
  });

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">{t('activationStaff.importTitle')}</h2>
      <label className="block space-y-2">
        <span>{t('activationStaff.importFile')}</span>
        <Input type="file" accept=".json,application/json" disabled={upload.isPending} onChange={async (event) => {
          const file = event.target.files?.[0];
          setRows([]);
          setOutcomes([]);
          setInvalid(false);
          if (!file) return;
          try {
            if (file.size > 32_000_000) throw new Error();
            const parsed: unknown = JSON.parse(await file.text());
            if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 300 || !parsed.every(isImportRow)) throw new Error();
            if (new Set(parsed.map((row) => row.propertyId)).size !== parsed.length) throw new Error();
            setRows(parsed);
          } catch {
            setInvalid(true);
          }
        }} />
      </label>
      {invalid && <p role="alert">{t('activationStaff.invalidImport')}</p>}
      {rows.length > 0 && <p>{t('activationStaff.selection', { count: rows.length })}</p>}
      <Button type="button" disabled={rows.length === 0 || upload.isPending} onClick={() => upload.mutate()}>
        {t(upload.isPending ? 'activationStaff.importing' : 'activationStaff.importAction')}
      </Button>
      {outcomes.length > 0 && <ul className="max-h-72 space-y-1 overflow-y-auto" aria-live="polite">
        {outcomes.map((row) => <li key={row.propertyId} className="break-words text-sm">{row.propertyId} · {row.problem ?? t('activationStaff.imported')}</li>)}
      </ul>}
    </section>
  );
}

function Batch({ rows }: { rows: PreparationRow[] }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const batchId = rows[0].batchId;
  const [reference, setReference] = useState(rows[0].supplierReference ?? '');
  const [reconciliation, setReconciliation] = useState<Record<string, string>>({});
  const job = useMutation({
    mutationFn: async (action: { kind: 'resume' | 'reference' } | { kind: 'reconcile'; rowId: string }) => {
      if (action.kind === 'reference') return propertyPreparationApi.supplierReference(batchId, reference.trim());
      if (action.kind === 'reconcile') return propertyPreparationApi.reconcile(batchId, action.rowId, reconciliation[action.rowId].trim());
      return propertyPreparationApi.resume(batchId);
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: preparationKey }),
  });

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="break-all font-semibold">{t('activationStaff.batch', { id: batchId })}</h3>
      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.id} className="space-y-2 py-2">
            <p className="font-medium">{row.propertyName || row.propertyId}</p>
            <p className="text-sm text-muted-foreground">{t(`activationStaff.status.${row.status}`)}{row.accommodationId && ` · ${row.accommodationId}`}</p>
            {row.errorCode && <p className="break-words text-sm">{t(`activationStaff.reasons.${row.errorCode}`, { defaultValue: row.errorCode })}</p>}
            {!row.accommodationId && (row.status === 'ReconcileCreation' || row.status === 'NeedsReview') && (
              <div className="flex flex-wrap gap-2">
                <Input className="w-56" aria-label={t('activationStaff.externalId')} placeholder={t('activationStaff.externalId')}
                  value={reconciliation[row.id] ?? ''} onChange={(event) => setReconciliation((previous) => ({ ...previous, [row.id]: event.target.value }))} />
                <Button variant="outline" disabled={job.isPending || !reconciliation[row.id]?.trim()} onClick={() => job.mutate({ kind: 'reconcile', rowId: row.id })}>
                  {t('activationStaff.reconcile')}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {rows.every((row) => row.accommodationId) && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">{t('activationStaff.reference')}
            <Input value={reference} maxLength={120} onChange={(event) => setReference(event.target.value)} />
          </label>
          <Button variant="outline" disabled={job.isPending || !reference.trim()} onClick={() => job.mutate({ kind: 'reference' })}>{t('activationStaff.save')}</Button>
        </div>
      )}
      {rows.some((row) => row.status !== 'Ready') && (
        <Button disabled={job.isPending} onClick={() => job.mutate({ kind: 'resume' })}>{t('activationStaff.resume')}</Button>
      )}
      {job.isError && <p role="alert">{getProblemMessage(job.error, t) ?? t('activationStaff.importFailure')}</p>}
      {job.isSuccess && <p role="status">{t('activationStaff.saved')}</p>}
    </section>
  );
}

export function AdminPropertyPreparationPage() {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const deferredSearch = useDeferredValue(search.trim());
  const candidates = useQuery({ queryKey: [...candidateKey, deferredSearch], queryFn: () => propertyPreparationApi.candidates(deferredSearch) });
  const available = candidates.data?.items ?? [];
  const selected = available.filter((row) => row.missingFields.length === 0 && selectedIds.includes(row.propertyId))
    .map(({ orgId, propertyId }) => ({ orgId, propertyId }));
  const recent = useQuery({ queryKey: preparationKey, queryFn: propertyPreparationApi.recent, refetchInterval: 5000 });
  const start = useMutation({
    mutationFn: () => propertyPreparationApi.start(selected),
    onSuccess: async () => {
      setSelectedIds([]);
      await cache.invalidateQueries({ queryKey: preparationKey });
    },
  });
  const batches = new Map<string, PreparationRow[]>();
  for (const row of recent.data ?? []) {
    const bucket = batches.get(row.batchId) ?? [];
    bucket.push(row);
    batches.set(row.batchId, bucket);
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title={t('activationStaff.title')} />
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-lg font-semibold">{t('activationStaff.candidatesTitle')}</h2>
          <label className="block space-y-1">
            <span>{t('activationStaff.search')}</span>
            <Input type="search" value={search} maxLength={120} onChange={(event) => { setSearch(event.target.value); setSelectedIds([]); }} />
          </label>
          {candidates.isPending && <p role="status">{t('activationStaff.loadingCandidates')}</p>}
          {candidates.isError && <ErrorState title={t('activationStaff.candidatesError')} onRetry={() => void candidates.refetch()} />}
          {candidates.isSuccess && available.length === 0 && <p>{t('activationStaff.emptyCandidates')}</p>}
          {candidates.data?.hasMore && <p>{t('activationStaff.moreCandidates')}</p>}
          {available.length > 0 && <fieldset className="max-h-96 divide-y overflow-y-auto rounded-lg border px-3">
            <legend className="px-1">{t('activationStaff.selectProperties')}</legend>
            {available.map((row) => (
              <label key={row.propertyId} className="flex items-start gap-3 py-2">
                <input type="checkbox" className="mt-1" disabled={row.missingFields.length > 0 || start.isPending}
                  checked={row.missingFields.length === 0 && selectedIds.includes(row.propertyId)} onChange={(event) => {
                    const checked = event.target.checked;
                    setSelectedIds((previous) => checked ? [...previous, row.propertyId] : previous.filter((id) => id !== row.propertyId));
                  }} />
                <span>
                  <span className="block font-medium">{row.propertyName}</span>
                  <span className="block text-sm text-muted-foreground">{row.organizationName}</span>
                  {row.missingFields.length > 0 && <span className="block text-sm text-muted-foreground">
                    {t('activationStaff.missingFields', { fields: row.missingFields.map((field) => t(`activationStaff.fields.${field}`, { defaultValue: field })).join(', ') })}
                  </span>}
                </span>
              </label>
            ))}
          </fieldset>}
          <p>{t('activationStaff.selection', { count: selected.length })}</p>
          <Button disabled={!selected.length || search.trim() !== deferredSearch || start.isPending} onClick={() => start.mutate()}>{t('activationStaff.start')}</Button>
          {start.isError && <p role="alert">{getProblemMessage(start.error, t) ?? t('activationStaff.importFailure')}</p>}
        </section>
        <ImportInventory onSaved={() => { void cache.invalidateQueries({ queryKey: candidateKey }); }} />
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-lg font-semibold">{t('activationStaff.prepareTitle')}</h2>
          {recent.isError && <ErrorState title={t('activationStaff.loadError')} error={recent.error} onRetry={() => void recent.refetch()} />}
          {recent.isSuccess && batches.size === 0 && <p>{t('activationStaff.emptyBatches')}</p>}
          {[...batches].map(([id, rows]) => <Batch key={id} rows={rows} />)}
        </section>
      </div>
    </AppShell>
  );
}
