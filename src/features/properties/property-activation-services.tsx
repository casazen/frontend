import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { propertyActivationServicesApi, type ActivationServicesState } from '@/api/property-activation.api';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/error-state';
import { getProblemMessage } from '@/lib/api-errors';
import type { MarketplaceCatalogEntry } from '@/types/marketplace';
import { PropertyActivationAccounts } from './property-activation-accounts';

type Service = 'alloggiati' | 'istat';
const services: Service[] = ['alloggiati', 'istat'];

interface Props {
  propertyId: string;
  channels: MarketplaceCatalogEntry[];
  canSetPortals: boolean;
  canRequestHelp: boolean;
}

export function PropertyActivationServices({ propertyId, channels, canSetPortals, canRequestHelp }: Props) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [choice, setChoice] = useState<string[] | null>(null);
  const [confirm, setConfirm] = useState<Service | null>(null);
  const queryKey = ['property-activation-services', propertyId];
  const state = useQuery({ queryKey, queryFn: () => propertyActivationServicesApi.detail(propertyId), staleTime: 0 });
  const save = useMutation({
    mutationFn: (portals: string[]) => propertyActivationServicesApi.savePortals(propertyId, portals),
    onSuccess: (data: ActivationServicesState) => {
      cache.setQueryData(queryKey, data);
      setChoice(null);
    },
  });
  const request = useMutation({
    mutationFn: (kind: Service) => propertyActivationServicesApi.request(propertyId, kind),
    onSuccess: () => setConfirm(null),
  });

  if (state.isError) return <ErrorState title={t('activationJourney.services.loadError')} error={state.error} onRetry={() => void state.refetch()} />;
  if (!state.data) return null;
  const { requiredPortals, pendingPortals, complianceAvailable, complianceApplies, preparationStatus } = state.data;
  const selected = choice ?? requiredPortals ?? [];
  const labels = new Map(channels.map((channel) => [channel.code, channel.name]));
  const available = channels.filter((channel) => channel.canActivate || channel.status !== 'NotActive' || selected.includes(channel.code));
  const error = save.error ?? request.error;

  return (
    <>
      <section className="space-y-2 border-t pt-4">
        <h3 className="font-semibold">{t('activationJourney.preparation.title')}</h3>
        <p className="text-sm text-muted-foreground">{t(`activationJourney.preparation.${preparationStatus ?? 'NotStarted'}`)}</p>
      </section>
      <section className="space-y-3 border-t pt-4">
        <h3 className="font-semibold">{t('activationJourney.services.title')}</h3>
      {canSetPortals && (
        <details className="rounded-lg border px-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">{t('activationJourney.services.configure')}</summary>
          <fieldset className="space-y-2 pb-3">
            <legend className="sr-only">{t('activationJourney.services.configure')}</legend>
            {available.map((channel) => (
              <label key={channel.code} className="flex min-h-11 items-center gap-3">
                <input type="checkbox" className="size-4" checked={selected.includes(channel.code)}
                  onChange={(event) => setChoice(event.target.checked ? [...selected, channel.code] : selected.filter((item) => item !== channel.code))} />
                {channel.name}
              </label>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={save.isPending || selected.length === 0} onClick={() => save.mutate(selected)}>{t('activationJourney.services.save')}</Button>
              <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate([])}>{t('activationJourney.services.noPortals')}</Button>
            </div>
          </fieldset>
        </details>
      )}
      {!complianceApplies ? <p className="text-sm">{t('activationJourney.services.notApplicable')}</p> : !complianceAvailable ? (
        <p className="text-sm text-muted-foreground" role="status">
          {pendingPortals.length > 0
            ? t('activationJourney.services.pending', { names: pendingPortals.map((code) => labels.get(code) ?? code).join(', ') })
            : t('activationJourney.services.waiting')}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">{t('activationJourney.services.available')}</p>
          {canRequestHelp && (
            <div className="flex flex-wrap gap-2">
              {services.map((service) => (
                <Button key={service} variant="outline" className="min-h-11" onClick={() => { request.reset(); setConfirm(service); }}>
                  {t(`activationJourney.services.${service}`)}
                </Button>
              ))}
            </div>
          )}
          {confirm && (
            <div className="space-y-2 rounded-md border p-3">
              <p>{t('activationJourney.services.confirm', { service: t(`activationJourney.services.${confirm}`) })}</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={request.isPending} onClick={() => request.mutate(confirm)}>{t('activationJourney.services.send')}</Button>
                <Button disabled={request.isPending} variant="outline" onClick={() => setConfirm(null)}>{t('activationJourney.services.cancel')}</Button>
              </div>
            </div>
          )}
          {request.isSuccess && <p role="status">{t('activationJourney.services.sent')}</p>}
          <Link to="/app/short-rent/compliance" className="inline-flex min-h-11 items-center underline">{t('activationJourney.services.openCompliance')}</Link>
        </div>
      )}
      {canRequestHelp && (complianceAvailable || canSetPortals) && (
        <PropertyActivationAccounts propertyId={propertyId} channels={channels} canConnectChannels={canSetPortals} complianceAvailable={complianceAvailable} />
      )}
      {error && <p role="alert" className="text-sm text-destructive">{getProblemMessage(error, t) ?? t('activationJourney.services.loadError')}</p>}
      </section>
    </>
  );
}
