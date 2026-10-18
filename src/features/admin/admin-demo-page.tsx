import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AdminApi, type DemoEnvironmentStatus } from '@/api/admin.api';

const DEMO_KEY = ['admin', 'demo'] as const;

function problemDetail(error: unknown): string | null {
  if (!isAxiosError(error)) return null;
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
  return typeof detail === 'string' && detail.length > 0 ? detail : null;
}

export function AdminDemoPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [orgId, setOrgId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [removeUnpublished, setRemoveUnpublished] = useState(false);

  const status = useQuery({
    queryKey: DEMO_KEY,
    queryFn: () => AdminApi.getDemoStatus(),
  });
  const orgs = useQuery({
    queryKey: [...DEMO_KEY, 'orgs'],
    queryFn: () => AdminApi.listDemoOrgs(),
    enabled: status.data?.available === true,
  });

  function remember(next: DemoEnvironmentStatus) {
    queryClient.setQueryData(DEMO_KEY, next);
  }

  const enable = useMutation({
    mutationFn: (enabled: boolean) => AdminApi.setDemoEnabled(enabled),
    onSuccess: (next) => {
      setActionError(null);
      remember(next);
    },
    onError: (error) => setActionError(problemDetail(error) ?? t('admin.demo.actionError')),
  });

  const apply = useMutation({
    mutationFn: () => AdminApi.applyDemoCompliance(orgId),
    onSuccess: async (result) => {
      setActionError(null);
      setNotice(t('admin.demo.applyDone', { published: result.published, filled: result.filled }));
      await queryClient.invalidateQueries({ queryKey: DEMO_KEY });
    },
    onError: (error) => setActionError(problemDetail(error) ?? t('admin.demo.actionError')),
  });

  const reset = useMutation({
    mutationFn: () => AdminApi.resetDemoShowcase(orgId, confirmation, removeUnpublished),
    onSuccess: async (result) => {
      setActionError(null);
      setResetOpen(false);
      setConfirmation('');
      setRemoveUnpublished(false);
      setNotice(t('admin.demo.resetDone', { created: result.created, removed: result.removed }));
      await queryClient.invalidateQueries({ queryKey: DEMO_KEY });
    },
    onError: (error) => setActionError(problemDetail(error) ?? t('admin.demo.actionError')),
  });

  const data = status.data;
  const busy = enable.isPending || apply.isPending || reset.isPending;
  const canAct = Boolean(data?.available && data.enabled && orgId) && !busy;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.demo.title')} description={t('admin.demo.description')} />

      {status.isError ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-destructive">{t('admin.demo.loadError')}</p>
            <Button variant="outline" size="sm" onClick={() => status.refetch()}>
              {t('admin.demo.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {data && !data.available ? (
        <Card>
          <CardContent className="space-y-2 py-6">
            <h2 className="text-lg font-semibold">{t('admin.demo.unavailableTitle')}</h2>
            <p className="text-muted-foreground">{t('admin.demo.unavailable')}</p>
          </CardContent>
        </Card>
      ) : null}

      {data?.available ? (
        <Card>
          <CardContent className="space-y-6 py-6">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={data.enabled}
                disabled={enable.isPending}
                onChange={(event) => enable.mutate(event.target.checked)}
              />
              <span>{data.enabled ? t('admin.demo.enabled') : t('admin.demo.disabled')}</span>
            </label>

            <p className="text-sm text-muted-foreground">
              {t('admin.demo.template', { version: data.templateVersion })}
              {' · '}
              {data.lastResetAt
                ? t('admin.demo.lastReset', {
                    when: new Date(data.lastResetAt).toLocaleString(i18n.language),
                  })
                : t('admin.demo.neverReset')}
              {' · '}
              {t('admin.demo.showcaseCount', { count: data.showcaseProperties })}
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="demo-org">
                {t('admin.demo.orgLabel')}
              </label>
              <select
                id="demo-org"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={orgId}
                onChange={(event) => setOrgId(event.target.value)}
              >
                <option value="">{t('admin.demo.orgPlaceholder')}</option>
                {(orgs.data ?? []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.slug})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-medium">{t('admin.demo.scenariosTitle')}</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {data.scenarios.map((scenario) => (
                  <li key={scenario}>{scenario}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button disabled={!canAct} loading={apply.isPending} onClick={() => apply.mutate()}>
                {apply.isPending ? t('admin.demo.applying') : t('admin.demo.apply')}
              </Button>
              <Button variant="outline" disabled={!canAct} onClick={() => setResetOpen(true)}>
                {t('admin.demo.reset')}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{t('admin.demo.applyHelp')}</p>
            <p className="text-sm text-muted-foreground">{t('admin.demo.resetHelp')}</p>

            {notice ? <p className="text-sm">{notice}</p> : null}
            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {resetOpen ? (
        <Dialog open onOpenChange={(open) => !open && !reset.isPending && setResetOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('admin.demo.reset')}</DialogTitle>
              <DialogDescription>{t('admin.demo.resetHelp')}</DialogDescription>
            </DialogHeader>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={removeUnpublished}
                onChange={(event) => setRemoveUnpublished(event.target.checked)}
              />
              {t('admin.demo.removeUnpublished')}
            </label>
            <label className="space-y-2 text-sm">
              <span>{t('admin.demo.confirmLabel')}</span>
              <Input
                value={confirmation}
                placeholder={t('admin.demo.confirmPlaceholder')}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            <DialogFooter>
              <Button variant="outline" disabled={reset.isPending} onClick={() => setResetOpen(false)}>
                {t('admin.demo.cancel')}
              </Button>
              <Button
                variant="destructive"
                data-testid="demo-reset-confirm"
                loading={reset.isPending}
                disabled={confirmation !== 'RESET' || reset.isPending}
                onClick={() => reset.mutate()}
              >
                {reset.isPending ? t('admin.demo.resetting') : t('admin.demo.reset')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
