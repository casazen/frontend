import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ApiClient } from '@/api/client';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getProblemMessage } from '@/lib/api-errors';

const ROOT = '/admin/agent-playground';
const presets = {
  cleaning: 'cleaningTitle', 'arrival-instructions': 'instructionsTitle',
  review: 'reviewTitle', 'document-reminder': 'documentReminderTitle',
} as const;
type Preset = keyof typeof presets;
type Example = { channel: string; status: string; nights: number; guests: number; noShow: boolean; execute: boolean };
type Draft = { guidance: string; training: Example[]; evaluation: Example[] };
type Score = { execute: boolean | null; tokens: number; milliseconds: number; error?: string };
type Result = { example: Example; current: Score; candidate: Score };
type State = {
  revision: number; active: { version: number } | null; previous: { version: number } | null;
  candidate: { version: number } | null; draft: Draft | null; results: Result[] | null;
};
const channels = ['Direct', 'Airbnb', 'BookingCom', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda', 'Local', 'Manual', 'OtherChannel'];
const statuses = ['Pending', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled'];

function useAgentPlaygroundAccess() {
  return useQuery({ queryKey: ['agent-playground-access'], queryFn: () => ApiClient.get<{ allowed: boolean }>(ROOT + '/access'), retry: false });
}

export function AgentPlaygroundLink() {
  const { t } = useTranslation();
  const access = useAgentPlaygroundAccess();
  return access.data?.allowed ? <Button asChild variant="outline"><Link to="/app/admin/ai/playground">{t('agentPlayground.title')}</Link></Button> : null;
}

function emptyDraft(preset: Preset): Draft {
  const example: Example = { channel: 'Direct', status: preset === 'review' || preset === 'cleaning' ? 'CheckedOut' : 'Confirmed',
    nights: 2, guests: 2, noShow: false, execute: true };
  return {
    guidance: '',
    training: [example, { ...example, status: 'Cancelled', execute: false }],
    evaluation: [{ ...example, nights: 4 }, { ...example, nights: 5, status: 'Cancelled', execute: false }],
  };
}

const selectStyle = 'min-h-9 rounded-md border bg-background px-2 text-sm';

function Examples({ name, rows, onChange, limit }: { name: string; rows: Example[]; onChange: (rows: Example[]) => void; limit: number }) {
  const { t } = useTranslation();
  function update(index: number, values: Partial<Example>) {
    onChange(rows.map((row, position) => position === index ? { ...row, ...values } : row));
  }
  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">{name}</legend>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-2 gap-2 rounded border p-3 md:grid-cols-4 xl:grid-cols-7">
          <label className="grid gap-1 text-xs">{t('agentPlayground.channel')}
            <select className={selectStyle} value={row.channel} onChange={e => update(index, { channel: e.target.value })}>
              {channels.map(channel => <option key={channel}>{channel}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs">{t('agentPlayground.status')}
            <select className={selectStyle} value={row.status} onChange={e => update(index, { status: e.target.value })}>
              {statuses.map(status => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs">{t('agentPlayground.nights')}
            <Input required type="number" min={1} max={365} value={row.nights} onChange={e => update(index, { nights: Number(e.target.value) })} />
          </label>
          <label className="grid gap-1 text-xs">{t('agentPlayground.guests')}
            <Input required type="number" min={1} max={100} value={row.guests} onChange={e => update(index, { guests: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={row.noShow} onChange={e => update(index, { noShow: e.target.checked })} />{t('agentPlayground.noShow')}
          </label>
          <label className="grid gap-1 text-xs">{t('agentPlayground.expected')}
            <select className={selectStyle} value={String(row.execute)} onChange={e => update(index, { execute: e.target.value === 'true' })}>
              <option value="true">{t('agentPlayground.execute')}</option><option value="false">{t('agentPlayground.skip')}</option>
            </select>
          </label>
          <Button type="button" variant="ghost" disabled={rows.length <= 2} onClick={() => onChange(rows.filter((_, position) => position !== index))}>
            {t('agentPlayground.remove')}
          </Button>
        </div>
      ))}
      <Button variant="outline" type="button" disabled={rows.length >= limit} onClick={() => onChange([...rows, { ...rows[0], nights: rows.length + 7 }])}>
        {t('agentPlayground.add')}
      </Button>
    </fieldset>
  );
}

function TrainingWorkspace({ preset, initial }: { preset: Preset; initial: State }) {
  const { t } = useTranslation();
  const [state, setState] = useState(initial);
  const [draft, setDraft] = useState(initial.draft ?? emptyDraft(preset));
  const [dirty, setDirty] = useState(false);
  const action = useMutation({
    mutationFn: (operation: 'train' | 'trainWithAi' | 'activate' | 'restore') => {
      const url = ROOT + '/' + preset;
      const { revision } = state;
      if (operation === 'trainWithAi') return ApiClient.post<State>(url + '/train-with-ai', { revision, prompt: draft.guidance.trim() }, { timeout: 240_000 });
      if (operation === 'train') return ApiClient.post<State>(url + '/train', { revision, draft }, { timeout: 240_000 });
      return ApiClient.put<State>(url + '/active', { revision, restore: operation === 'restore' });
    },
    onSuccess: (next, operation) => {
      setState(next);
      if (operation === 'trainWithAi' && next.draft) setDraft(next.draft);
      if (operation === 'train' || operation === 'trainWithAi') setDirty(false);
    },
  });
  const results = state.results ?? [];
  const correct = (key: 'current' | 'candidate') => results.filter(result => result[key].execute === result.example.execute).length;
  const label = (value: boolean | null) => t(value === null ? 'agentPlayground.failed' : value ? 'agentPlayground.execute' : 'agentPlayground.skip');
  const version = (candidate: { version: number } | null) => candidate ? 'v' + candidate.version : t('agentPlayground.base');
  const change = (patch: Partial<Draft>) => { setDraft({ ...draft, ...patch }); setDirty(true); };
  return (
    <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] 2xl:items-start">
      <Card>
        <CardHeader><CardTitle>{t('agentPlayground.training')}</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={e => { e.preventDefault(); action.mutate('train'); }}>
            <fieldset disabled={action.isPending} className="space-y-5">
              <label className="grid gap-2 text-sm font-medium">{t('agentPlayground.guidance')}
                <textarea maxLength={800} rows={3} className="rounded-md border bg-background p-3 text-sm" value={draft.guidance}
                  onChange={e => change({ guidance: e.target.value })} />
              </label>
              <div className="space-y-2">
                <Button type="button" disabled={!draft.guidance.trim()} onClick={() => action.mutate('trainWithAi')}>
                  {t('agentPlayground.trainWithAi')}
                </Button>
                <p className="text-sm text-muted-foreground">{t('agentPlayground.trainWithAiHint')}</p>
              </div>
              <Examples name={t('agentPlayground.examples')} rows={draft.training} limit={40} onChange={training => change({ training })} />
              <Examples name={t('agentPlayground.evaluation')} rows={draft.evaluation} limit={12} onChange={evaluation => change({ evaluation })} />
              <Button type="submit" variant="outline">{t('agentPlayground.train')}</Button>
            </fieldset>
          </form>
          <p aria-live="polite" className="mt-3 text-sm">{action.isPending && t(action.variables === 'trainWithAi' ? 'agentPlayground.generating' : 'agentPlayground.running')}</p>
          {action.isError && <p role="alert" className="text-sm text-destructive">{getProblemMessage(action.error, t) ?? t('agentPlayground.failed')}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t('agentPlayground.versions')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p>{t('agentPlayground.active', { version: version(state.active) })}</p>
          {state.candidate && <p>{t('agentPlayground.proposal', { version: version(state.candidate) })}</p>}
          {results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b">
                  <th className="p-2">{t('agentPlayground.scenario')}</th><th className="p-2">{t('agentPlayground.expected')}</th>
                  <th className="p-2">{t('agentPlayground.current', { score: correct('current'), total: results.length })}</th>
                  <th className="p-2">{t('agentPlayground.candidate', { score: correct('candidate'), total: results.length })}</th>
                </tr></thead>
                <tbody>{results.map(({ example, current, candidate }, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{t('agentPlayground.exampleDetail', example)}{example.noShow && ' · ' + t('agentPlayground.noShow')}</td>
                    <td className="p-2">{label(example.execute)}</td>
                    {[current, candidate].map((score, column) => (
                      <td key={column} className="p-2">{label(score.execute)}<br /><span className="text-xs text-muted-foreground">
                        {score.error ?? t('agentPlayground.usage', score)}
                      </span></td>
                    ))}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {state.candidate && <Button disabled={dirty || action.isPending || results.some(row => row.candidate.error) || correct('candidate') < correct('current')}
              onClick={() => action.mutate('activate')}>{t('agentPlayground.publish')}</Button>}
            {(state.active || state.previous) && <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate('restore')}>
              {t('agentPlayground.restore', { version: version(state.previous) })}
            </Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AgentPlaygroundPage() {
  const { t } = useTranslation();
  const access = useAgentPlaygroundAccess();
  const [preset, setPreset] = useState<Preset>('cleaning');
  const state = useQuery({ queryKey: ['agent-playground', preset], queryFn: () => ApiClient.get<State>(ROOT + '/' + preset),
    enabled: access.data?.allowed === true, staleTime: 0, refetchOnWindowFocus: false });
  return (
    <div className="space-y-5">
      <PageHeader title={t('agentPlayground.title')} description={t('agentPlayground.description')} />
      {access.isPending && <p>{t('agentPlayground.running')}</p>}
      {!access.isPending && !access.data?.allowed && <p role="alert">{t('agentPlayground.forbidden')}</p>}
      {access.data?.allowed && <>
        <label className="grid max-w-md gap-2 rounded-xl border bg-surface-2 p-4 text-sm font-medium">{t('agentPlayground.preset')}
          <select className={selectStyle} value={preset} onChange={e => setPreset(e.target.value as Preset)}>
            {(Object.keys(presets) as Preset[]).map(key => <option key={key} value={key}>{t('routines.library.' + presets[key])}</option>)}
          </select>
        </label>
        {state.isFetching ? <p>{t('agentPlayground.running')}</p> : state.data
          ? <TrainingWorkspace key={preset} preset={preset} initial={state.data} />
          : <p role="alert">{t('agentPlayground.failed')}</p>}
      </>}
    </div>
  );
}
