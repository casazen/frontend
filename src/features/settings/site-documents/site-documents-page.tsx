import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ExternalLink, Info, Loader2, ShieldAlert, TriangleAlert } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatLegalDate } from '@/features/legal/legal-paths';
import { useWorkspace } from '@/hooks/use-workspace';
import { needsOrgSetup } from '@/lib/onboarding';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { orgDocumentPath } from '@/lib/org-document-paths';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/queries/use-users';
import type { OrgSiteDocumentSource, OrgSiteDocumentState, OrgSiteDocumentVersion } from '@/types';
import {
  DOCUMENT_CONTENT_MAX_LENGTH,
  DOCUMENT_URL_MAX_LENGTH,
  checkSiteDocumentForm,
  normalizeDocumentText,
} from './site-documents-rules';
import {
  useLoadSiteDocumentVersion,
  usePublishSiteDocument,
  useSiteDocuments,
  useWithdrawSiteDocument,
} from './use-site-documents';

/** "Documenti sito" (BK-14, A3-21): the host's own privacy notice and booking terms, shown on the public booking site. */
export function SiteDocumentsPage() {
  return (
    <AppShell>
      <SiteDocumentsContent />
    </AppShell>
  );
}

export function SiteDocumentsContent() {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();
  const isAdmin = isOrgBillingAdmin(contexts);
  const { user, org } = useCurrentUser();
  const documentsQuery = useSiteDocuments(isAdmin);

  if (user && needsOrgSetup(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  const renderContent = () => {
    if (!isAdmin) {
      return (
        <div
          role="alert"
          data-testid="site-documents-admin-required"
          className="flex items-start gap-3 rounded-lg border bg-muted/40 p-6 text-sm"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">{t('orgSettings.adminRequired.title')}</p>
            <p className="text-muted-foreground">{t('siteDocuments.adminRequired')}</p>
          </div>
        </div>
      );
    }

    if (documentsQuery.isPending) {
      return (
        <div className="space-y-6" data-testid="site-documents-loading">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      );
    }

    if (documentsQuery.isError) {
      return (
        <div
          role="alert"
          data-testid="site-documents-error"
          className="space-y-3 rounded-md border border-destructive/40 p-4 text-sm"
        >
          <p className="text-destructive">{t('siteDocuments.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void documentsQuery.refetch()}>
            {t('shared.errorFallback.tryAgain')}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div
          className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm"
          data-testid="site-documents-responsibility"
        >
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">{t('siteDocuments.responsibility.title')}</p>
            <p className="text-muted-foreground">{t('siteDocuments.responsibility.body')}</p>
          </div>
        </div>
        {documentsQuery.data.map((state) => (
          <SiteDocumentCard key={state.kind} state={state} orgSlug={org?.slug ?? null} />
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="site-documents-page">
      <PageHeader title={t('siteDocuments.title')} description={t('siteDocuments.description')} />
      {renderContent()}
    </div>
  );
}

interface DocumentForm {
  source: OrgSiteDocumentSource;
  content: string;
  externalUrl: string;
}

/** What the editor shows for a state: the current version (even when withdrawn, to republish it), else an empty text. */
function toForm(state: OrgSiteDocumentState): DocumentForm {
  const current = state.current;
  return {
    source: current?.source ?? 'Text',
    content: current?.content ?? '',
    externalUrl: current?.externalUrl ?? '',
  };
}

/** True when the form is exactly the version the public site shows now. */
function isUnchanged(state: OrgSiteDocumentState, form: DocumentForm): boolean {
  const current = state.current;
  if (!state.published || !current) return false;
  if (form.source !== current.source) return false;
  return form.source === 'Text'
    ? normalizeDocumentText(form.content) === normalizeDocumentText(current.content ?? '')
    : form.externalUrl.trim() === (current.externalUrl ?? '');
}

function SiteDocumentCard({ state, orgSlug }: { state: OrgSiteDocumentState; orgSlug: string | null }) {
  const { t, i18n } = useTranslation();
  const { kind } = state;
  const publish = usePublishSiteDocument(kind);
  const withdraw = useWithdrawSiteDocument(kind);
  const loadVersion = useLoadSiteDocumentVersion(kind);

  const [form, setForm] = useState<DocumentForm>(() => toForm(state));
  const [submitted, setSubmitted] = useState(false);
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  // Sync the editor from the server state whenever a publish or a withdrawal changes it (adjusting state during render).
  const [synced, setSynced] = useState(state);
  if (state !== synced) {
    setSynced(state);
    setForm(toForm(state));
    setSubmitted(false);
    setConfirmingWithdraw(false);
  }

  const errorKey = submitted ? checkSiteDocumentForm(form.source, form.content, form.externalUrl) : null;
  const unchanged = isUnchanged(state, form);
  const contentLength = normalizeDocumentText(form.content).length;
  const busy = publish.isPending || withdraw.isPending;
  const idPrefix = `site-document-${kind}`;

  const handlePublish = () => {
    setSubmitted(true);
    if (checkSiteDocumentForm(form.source, form.content, form.externalUrl)) return;
    publish.mutate(
      form.source === 'Text'
        ? { source: 'Text', content: form.content }
        : { source: 'ExternalUrl', externalUrl: form.externalUrl.trim() },
    );
  };

  const handleUseAsBase = (version: OrgSiteDocumentVersion) => {
    loadVersion.mutate(version.version, {
      onSuccess: (loaded) => {
        setForm({ source: loaded.source, content: loaded.content ?? '', externalUrl: loaded.externalUrl ?? '' });
        setSubmitted(false);
      },
    });
  };

  const statusText = state.published
    ? t('siteDocuments.status.published', {
        version: state.current?.version,
        date: state.current ? formatLegalDate(state.current.publishedAt, i18n.language) : '',
      })
    : state.current?.withdrawnAt
      ? t('siteDocuments.status.withdrawn', { date: formatLegalDate(state.current.withdrawnAt, i18n.language) })
      : t('siteDocuments.status.never');

  return (
    <Card data-testid={`site-document-${kind}`}>
      <CardHeader className="space-y-2">
        <CardTitle>{t(`siteDocuments.kinds.${kind}.title`)}</CardTitle>
        <CardDescription>{t(`siteDocuments.kinds.${kind}.description`)}</CardDescription>
        <p
          className={cn('flex items-center gap-2 text-sm', state.published ? 'text-foreground' : 'text-muted-foreground')}
          data-testid={`${idPrefix}-status`}
        >
          {state.published ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
          ) : (
            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          )}
          {statusText}
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('siteDocuments.source.label')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['Text', 'ExternalUrl'] as const).map((source) => (
              <label
                key={source}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm',
                  form.source === source && 'border-primary ring-1 ring-primary',
                )}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-source`}
                  value={source}
                  checked={form.source === source}
                  onChange={() => setForm((f) => ({ ...f, source }))}
                  data-testid={`${idPrefix}-source-${source}`}
                />
                {t(`siteDocuments.source.options.${source}`)}
              </label>
            ))}
          </div>
        </fieldset>

        {form.source === 'Text' ? (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-content`}>{t('siteDocuments.content.label')}</Label>
            <Textarea
              id={`${idPrefix}-content`}
              rows={14}
              value={form.content}
              placeholder={t('siteDocuments.content.placeholder')}
              aria-invalid={errorKey ? true : undefined}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              data-testid={`${idPrefix}-content`}
            />
            <p
              className={cn(
                'text-sm',
                contentLength > DOCUMENT_CONTENT_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground',
              )}
              data-testid={`${idPrefix}-counter`}
            >
              {t('siteDocuments.content.counter', {
                length: contentLength.toLocaleString(i18n.language),
                max: DOCUMENT_CONTENT_MAX_LENGTH.toLocaleString(i18n.language),
              })}
            </p>
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer">{t('siteDocuments.format.summary')}</summary>
              <p className="mt-2">{t('siteDocuments.format.body')}</p>
            </details>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-url`}>{t('siteDocuments.url.label')}</Label>
            <Input
              id={`${idPrefix}-url`}
              type="url"
              inputMode="url"
              maxLength={DOCUMENT_URL_MAX_LENGTH}
              value={form.externalUrl}
              placeholder={t('siteDocuments.url.placeholder')}
              aria-invalid={errorKey ? true : undefined}
              onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))}
              data-testid={`${idPrefix}-url`}
            />
            <p className="text-sm text-muted-foreground">{t('siteDocuments.url.hint')}</p>
          </div>
        )}

        {errorKey ? (
          <p className="text-sm text-destructive" role="alert" data-testid={`${idPrefix}-error`}>
            {t(errorKey, { max: DOCUMENT_CONTENT_MAX_LENGTH.toLocaleString(i18n.language) })}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={handlePublish}
            disabled={busy || unchanged}
            data-testid={`${idPrefix}-publish`}
          >
            {publish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {state.current ? t('siteDocuments.actions.publishNew') : t('siteDocuments.actions.publishFirst')}
          </Button>

          {state.published && !confirmingWithdraw ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmingWithdraw(true)}
              data-testid={`${idPrefix}-withdraw`}
            >
              {t('siteDocuments.actions.withdraw')}
            </Button>
          ) : null}

          {orgSlug ? (
            <a
              href={orgDocumentPath(orgSlug, kind)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              data-testid={`${idPrefix}-open-public`}
            >
              {t('siteDocuments.actions.openPublic')}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          ) : null}
        </div>

        {confirmingWithdraw ? (
          <div
            role="alert"
            className="space-y-3 rounded-md border border-amber-500/50 bg-amber-50 p-4 text-sm text-amber-950"
            data-testid={`${idPrefix}-withdraw-confirm`}
          >
            <p>{t('siteDocuments.actions.withdrawConfirm')}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={withdraw.isPending}
                onClick={() => withdraw.mutate()}
                data-testid={`${idPrefix}-withdraw-yes`}
              >
                {withdraw.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                {t('siteDocuments.actions.withdrawYes')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingWithdraw(false)}>
                {t('siteDocuments.actions.withdrawCancel')}
              </Button>
            </div>
          </div>
        ) : null}

        {state.history.length > 0 ? (
          <div className="space-y-2" data-testid={`${idPrefix}-history`}>
            <h3 className="text-sm font-medium">{t('siteDocuments.history.title')}</h3>
            <ul className="divide-y rounded-md border text-sm">
              {state.history.map((version, index) => {
                const isCurrent = index === 0;
                return (
                  <li key={version.version} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {t('siteDocuments.history.item', {
                        version: version.version,
                        date: formatLegalDate(version.publishedAt, i18n.language),
                      })}
                      {' · '}
                      {t(`siteDocuments.history.source.${version.source}`)}
                      {' · '}
                      <span className="text-muted-foreground">
                        {t(
                          isCurrent
                            ? version.withdrawnAt
                              ? 'siteDocuments.history.withdrawn'
                              : 'siteDocuments.history.inUse'
                            : 'siteDocuments.history.replaced',
                        )}
                      </span>
                    </span>
                    {isCurrent ? null : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={loadVersion.isPending}
                        onClick={() => handleUseAsBase(version)}
                        data-testid={`${idPrefix}-use-version-${version.version}`}
                      >
                        {t('siteDocuments.history.useAsBase')}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
