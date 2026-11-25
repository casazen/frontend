import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { activationAccountsApi, type ActivationAccount, type ActivationAccountOutcome } from '@/api/property-activation.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { marketplaceActivationPath, marketplaceHref } from '@/features/marketplace/lib/marketplace-paths';
import { getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import { SHORT_PROPERTIES_OVERVIEW, useProperties } from '@/queries/use-properties';
import type { MarketplaceCatalogEntry } from '@/types/marketplace';

const accountsKey = ['activation-accounts'];

export function PropertyActivationAccounts({ propertyId, channels, canConnectChannels, complianceAvailable }: {
  propertyId: string;
  channels: MarketplaceCatalogEntry[];
  canConnectChannels: boolean;
  complianceAvailable: boolean;
}) {
  const { t, i18n } = useTranslation();
  const cache = useQueryClient();
  const properties = useProperties(SHORT_PROPERTIES_OVERVIEW);
  const accounts = useQuery({ queryKey: accountsKey, queryFn: activationAccountsApi.list });
  const [choice, setService] = useState<string>();
  const [shared, setShared] = useState(false);
  const [selection, setSelection] = useState([propertyId]);
  const [result, setResult] = useState<{ account: ActivationAccount; outcomes: ActivationAccountOutcome[] } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const visible = properties.data ?? [];
  const names = new Map(visible.map((property) => [property.id, property.name]));
  const selected = shared ? selection : [propertyId];
  const portals = canConnectChannels ? channels.filter((channel) => channel.requiresCredentials && channel.canActivate) : [];
  const service = choice ?? (complianceAvailable ? 'alloggiati' : portals[0] ? `ota:${portals[0].code}` : '');
  const choicesAvailable = complianceAvailable || portals.length > 0;

  function serviceName(code: string) {
    return code.startsWith('ota:')
      ? channels.find((channel) => channel.code === code.slice(4))?.name ?? code.slice(4)
      : t(`activationJourney.services.${code}`);
  }

  const run = useMutation({
    mutationFn: async (account: ActivationAccount) => ({ account, outcomes: await activationAccountsApi.run(account.id) }),
    onSuccess: setResult,
  });

  const save = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const values = new FormData(form);
      const request = activationAccountsApi.store({
        service,
        username: String(values.get('username') ?? ''),
        password: String(values.get('password') ?? ''),
        webServiceKey: service === 'alloggiati' ? String(values.get('webServiceKey') ?? '') : undefined,
        properties: selected.map((id) => ({ propertyId: id, code: String(values.get(`unit-${id}`) ?? '') || undefined })),
      });
      form.reset();
      return request.catch((error: unknown) => {
        throw new Error(getProblemMessage(error, t) ?? t('activationJourney.accounts.needsReview'));
      });
    },
    onSuccess: (account) => {
      void cache.invalidateQueries({ queryKey: accountsKey });
      run.mutate(account);
    },
  });
  const revoke = useMutation({
    mutationFn: activationAccountsApi.revoke,
    onSuccess: () => {
      setConfirmRevoke(null);
      void cache.invalidateQueries({ queryKey: accountsKey });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    save.mutate(event.currentTarget);
  }

  const pending = save.isPending || run.isPending || revoke.isPending;
  const error = save.error ?? run.error ?? revoke.error ?? accounts.error;
  const existing = accounts.data?.filter((account) => account.propertyIds.includes(propertyId)) ?? [];

  return (
    <details className="rounded-lg border p-3">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">{t('activationJourney.accounts.title')}</summary>
      {choicesAvailable && <form className="space-y-3 pt-2" onSubmit={submit}>
        <label className="block space-y-1">
          <span>{t('activationJourney.accounts.service')}</span>
          <select value={service} className="block min-h-11 w-full rounded-md border bg-background px-3" onChange={(event) => setService(event.target.value)}>
            {complianceAvailable && <option value="alloggiati">{t('activationJourney.services.alloggiati')}</option>}
            {complianceAvailable && <option value="istat">{t('activationJourney.services.istat')}</option>}
            {canConnectChannels && portals.map((channel) => <option key={channel.code} value={`ota:${channel.code}`}>{channel.name}</option>)}
          </select>
        </label>
        <fieldset className="flex flex-wrap gap-x-4">
          <legend>{t('activationJourney.accounts.scope')}</legend>
          <label className="flex min-h-11 items-center gap-2"><input type="radio" name="scope" checked={!shared} onChange={() => setShared(false)} />{t('activationJourney.accounts.single')}</label>
          <label className="flex min-h-11 items-center gap-2"><input type="radio" name="scope" checked={shared} onChange={() => setShared(true)} />{t('activationJourney.accounts.shared')}</label>
        </fieldset>
        {shared && <fieldset className="max-h-60 overflow-y-auto rounded-md border px-3">
          <legend className="px-1">{t('activationJourney.properties')}</legend>
          {visible.map((property) => (
            <label key={property.id} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={selected.includes(property.id)}
                onChange={(event) => setSelection(event.target.checked ? [...selected, property.id] : selected.filter((id) => id !== property.id))} />
              {property.name}
            </label>
          ))}
        </fieldset>}
        <label className="block space-y-1"><span>{t('activationJourney.accounts.username')}</span><Input name="username" maxLength={200} autoComplete="off" required /></label>
        <label className="block space-y-1"><span>{t('activationJourney.accounts.password')}</span><Input name="password" type="password" maxLength={200} autoComplete="new-password" required /></label>
        {service === 'alloggiati' && <label className="block space-y-1">
          <span>{t('activationJourney.accounts.webServiceKey')}</span><Input name="webServiceKey" type="password" maxLength={200} autoComplete="off" required />
        </label>}
        {selected.map((id) => <label key={id} className="block space-y-1">
          <span>{t('activationJourney.accounts.unitCode', { name: names.get(id) ?? id })}</span>
          <Input name={`unit-${id}`} maxLength={100} autoComplete="off" />
        </label>)}
        <Button type="submit" className="min-h-11" disabled={pending || selected.length === 0}>{t('activationJourney.accounts.submit', { count: selected.length })}</Button>
      </form>}
      {existing.length > 0 && <ul className="mt-3 space-y-2">
        {existing.map((account) => (
          <li key={account.id} className="space-y-2 rounded-md border p-2">
            <p>{serviceName(account.service)}</p>
            <p className="text-sm text-muted-foreground">{t('activationJourney.accounts.expiry', { date: new Intl.DateTimeFormat(i18n.language).format(new Date(account.expiresAt)) })}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="min-h-11" disabled={pending || Date.parse(account.expiresAt) <= Date.now()} onClick={() => run.mutate(account)}>{t('activationJourney.accounts.resume')}</Button>
              <Button size="sm" variant="outline" className="min-h-11" disabled={pending} onClick={() => setConfirmRevoke(account.id)}>{t('activationJourney.accounts.revoke')}</Button>
              {confirmRevoke === account.id && (
                <Button size="sm" className="min-h-11" disabled={pending} onClick={() => revoke.mutate(account.id)}>{t('activationJourney.accounts.confirmRevoke')}</Button>
              )}
            </div>
          </li>
        ))}
      </ul>}
      {result && <ul aria-live="polite" className="mt-3 space-y-1">
        {result.outcomes.map((row) => (
          <li key={row.propertyId} className="text-sm">
            {names.get(row.propertyId) ?? row.propertyId} · {row.errorCode ? (translateErrorCode(row.errorCode, t) ?? t('activationJourney.accounts.needsReview')) : t('activationJourney.accounts.recorded')}
            {row.activationId && <Link className="inline-flex min-h-11 items-center px-2 underline"
              to={marketplaceHref(marketplaceActivationPath('channel', result.account.service.slice(4)), row.propertyId)}>
              {t('activationJourney.resume')}
            </Link>}
          </li>
        ))}
      </ul>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{save.error?.message ?? getProblemMessage(error, t) ?? t('activationJourney.accounts.needsReview')}</p>}
    </details>
  );
}
