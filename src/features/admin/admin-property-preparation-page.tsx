import { useState } from 'react';
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

function isImportRow(value: unknown): value is ImportRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Partial<ImportRow>;
  return typeof row.orgId === 'string' && uuid.test(row.orgId) && typeof row.propertyId === 'string' && uuid.test(row.propertyId)
    && typeof row.snapshot?.provider === 'string' && typeof row.snapshot.sourceId === 'string'
    && Array.isArray(row.snapshot.findings) && Array.isArray(row.snapshot.ratePlans);
}

function ImportInventory({ onPrepared }: { onPrepared: (rows: PreparationSelection[]) => void }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [outcomes, setOutcomes] = useState<{ propertyId: string; problem: string | null }[]>([]);
  const upload = useMutation({
    mutationFn: async () => {
      setOutcomes([]);
      const prepared: PreparationSelection[] = [];
      for (const row of rows) {
        let problem: string | null = null;
        try {
          await propertyActivationApi.record(row.orgId, row.propertyId, row.snapshot);
          prepared.push({ orgId: row.orgId, propertyId: row.propertyId });
        } catch (error) {
          problem = getProblemMessage(error, t) ?? t('activationStaff.importFailure');
        }
        setOutcomes((previous) => [...previous, { propertyId: row.propertyId, problem }]);
      }
      return prepared;
    },
    onSuccess: onPrepared,
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
  const [imported, setImported] = useState<PreparationSelection[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const selected = imported.filter((row) => !excluded.includes(row.propertyId));
  const recent = useQuery({ queryKey: preparationKey, queryFn: propertyPreparationApi.recent, refetchInterval: 5000 });
  const start = useMutation({
    mutationFn: () => propertyPreparationApi.start(selected),
    onSuccess: () => cache.invalidateQueries({ queryKey: preparationKey }),
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
        <ImportInventory onPrepared={(rows) => { setImported(rows); setExcluded([]); }} />
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-lg font-semibold">{t('activationStaff.prepareTitle')}</h2>
          <p>{t('activationStaff.selection', { count: selected.length })}</p>
          {imported.length > 0 && <fieldset className="max-h-52 overflow-y-auto rounded-lg border px-3">
            <legend className="px-1">{t('activationStaff.selectProperties')}</legend>
            {imported.map((row) => (
              <label key={row.propertyId} className="flex min-h-11 items-center gap-2 break-all">
                <input type="checkbox" checked={!excluded.includes(row.propertyId)} onChange={(event) => setExcluded((previous) =>
                  event.target.checked ? previous.filter((id) => id !== row.propertyId) : [...previous, row.propertyId])} />
                {row.propertyId}
              </label>
            ))}
          </fieldset>}
          <Button disabled={!selected.length || start.isPending} onClick={() => start.mutate()}>{t('activationStaff.start')}</Button>
          {start.isError && <p role="alert">{getProblemMessage(start.error, t) ?? t('activationStaff.importFailure')}</p>}
          {recent.isError && <ErrorState title={t('activationStaff.loadError')} error={recent.error} onRetry={() => void recent.refetch()} />}
          {[...batches].map(([id, rows]) => <Batch key={id} rows={rows} />)}
        </section>
      </div>
    </AppShell>
  );
}
