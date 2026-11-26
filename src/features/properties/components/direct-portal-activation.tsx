import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { getProblemCode } from '@/lib/api-errors';

export type DirectService = 'alloggiati' | 'istat';
interface DirectRoutes {
  effectiveFrom: Record<DirectService, string | null>;
  alloggiatiAvailable: boolean;
  istatAvailable: boolean;
  istatSupported: boolean;
}

const route = (id: string) => `/properties/${encodeURIComponent(id)}/institutional-routes`;
const key = (id: string) => ['institutional-routes', id] as const;

export function useDirectRoutes(id: string) {
  return useQuery({ queryKey: key(id), queryFn: () => ApiClient.get<DirectRoutes>(route(id)) });
}

export function DirectPortalActivation({ propertyId, service, routes, canWrite }: {
  propertyId: string; service: DirectService; routes: DirectRoutes; canWrite: boolean;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [reconciled, setReconciled] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const mutation = useMutation({
    mutationFn: () => ApiClient.put<DirectRoutes>(`${route(propertyId)}/${service}`, {
      previousSendersDisabled: disabled, periodReconciled: reconciled,
    }),
    onSuccess: (value) => {
      cache.setQueryData(key(propertyId), value);
      void cache.invalidateQueries({ predicate: (query) => query.queryKey.includes(propertyId) });
      setConfirming(false);
    },
  });
  const date = routes.effectiveFrom[service];
  if (date) return <p className="font-medium" role="status">{t('institutionalPortals.directSince', { date })}</p>;
  if (!canWrite || !(service === 'istat' ? routes.istatAvailable : routes.alloggiatiAvailable)) return null;
  const code = isAxiosError(mutation.error) ? getProblemCode(mutation.error.response?.data) : undefined;
  return (
    <div className="space-y-3 border-t pt-3">
      {!confirming ? <Button variant="outline" onClick={() => setConfirming(true)}>{t('institutionalPortals.chooseDirect')}</Button> : (
        <fieldset className="space-y-3" disabled={mutation.isPending}>
          <legend className="font-semibold">{t('institutionalPortals.cutoverTitle')}</legend>
          <p className="text-sm">{t('institutionalPortals.cutoverHint')}</p>
          <label className="flex items-start gap-2"><input type="checkbox" checked={disabled} onChange={e => setDisabled(e.target.checked)} />{t('institutionalPortals.disabled')}</label>
          <label className="flex items-start gap-2"><input type="checkbox" checked={reconciled} onChange={e => setReconciled(e.target.checked)} />{t('institutionalPortals.reconciled')}</label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!disabled || !reconciled || mutation.isPending} onClick={() => mutation.mutate()}>{t('institutionalPortals.activate')}</Button>
            <Button variant="ghost" onClick={() => { setConfirming(false); setDisabled(false); setReconciled(false); mutation.reset(); }}>{t('questuraCredentials.cancel')}</Button>
          </div>
          {mutation.isError && <p role="alert">{t(code === 'alloggiati_delegation_required' ? 'institutionalPortals.delegation' : 'institutionalPortals.activationFailed')}</p>}
        </fieldset>
      )}
    </div>
  );
}
