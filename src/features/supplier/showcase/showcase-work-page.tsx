import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { useShowcaseContent } from '@/queries/supplier/use-showcase';
import { useSupplierProfile } from '@/queries/supplier/use-profile';
import type { ShowcaseContent } from '@/types/supplier-showcase';
import { PublishPanel } from './panels/publish-panel';
import { ServicesPanel } from './panels/services-panel';
import { StylePanel } from './panels/style-panel';
import { TextsPanel } from './panels/texts-panel';
import { EDITOR_STEPS, OVERVIEW_PATH, stepPath, type EditorStep } from './showcase-model';
import { ShowcasePreview } from './showcase-preview';
import { useShowcaseDraft, type SaveStatus } from './use-showcase-draft';
import { useShowcasePublish } from './use-showcase-publish';

/** What the line under the steps says of the draft: saved at a time, being saved, kept for later, or refused. */
function SaveLine({ status, savedAt, onRetry }: { status: SaveStatus; savedAt: string | null; onRetry: () => void }) {
  const { t, i18n } = useTranslation();
  const time = savedAt ? formatRomeDateTime(savedAt, i18n.language, { hour: '2-digit', minute: '2-digit' }) : null;
  const text: Record<SaveStatus, string> = {
    saved: time ? t('supplier.showcase.editor.save.saved', { time }) : t('supplier.showcase.editor.save.nothing'),
    dirty: t('supplier.showcase.editor.save.dirty'),
    saving: t('supplier.showcase.editor.save.saving'),
    invalid: t('supplier.showcase.editor.save.invalid'),
    offline: t('supplier.showcase.editor.save.offline'),
    conflict: t('supplier.showcase.editor.save.conflict'),
    error: t('supplier.showcase.editor.save.error'),
  };
  const problem = status === 'invalid' || status === 'offline' || status === 'conflict' || status === 'error';
  return (
    <p className={cn('flex flex-wrap items-center gap-2 text-sm', problem ? 'font-medium text-warning-foreground' : 'text-foreground/70')} role="status" data-testid="supplier-showcase-save" data-status={status}>
      <span>{text[status]}</span>
      {status === 'error' || status === 'offline' ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {t('supplier.showcase.editor.save.retry')}
        </Button>
      ) : null}
    </p>
  );
}

interface ShowcaseWorkPageProps {
  /** The content as the overview read it: the editor starts from its draft and its version. */
  content: ShowcaseContent;
  step: EditorStep;
}

/**
 * The work view of the editor (SP-13d, `?step=style|texts|publish`): the panel of the step on the left and the live preview on the right
 * (on a phone the preview opens in a sheet), the steps above, and the draft saving itself. Leaving the view sends what is left; before
 * a publication what waits is sent and the publication refuses to go on while the server has not got the draft as it is on screen.
 */
export function ShowcaseWorkPage({ content, step }: ShowcaseWorkPageProps) {
  const { t } = useTranslation();
  const draft = useShowcaseDraft(content);
  // Every save puts the document the server sent in the cache: the checks and the state follow the draft.
  const live = useShowcaseContent().data ?? content;
  const profile = useSupplierProfile();
  // A publication (and its undo) changes the row on the server: the draft takes the new version, or its next save would be a "stale" one.
  const publish = useShowcasePublish(draft.adopt);
  const phone = useMediaQuery(PHONE_QUERY);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reloading, setReloading] = useState(false);
  // After a reload the panels start again from what the server has (a field with its own typed text would keep the old one).
  const [generation, setGeneration] = useState(0);

  const stepLabel = t(`supplier.showcase.editor.steps.${step}`);
  const categories = profile.data?.categories ?? [];

  const publishNow = async () => {
    // What is written goes first; if the server does not have it as it is on screen, nothing is published.
    if (await draft.flush()) publish.run(draft.getVersion());
  };

  const preview = live.publicPath ? <ShowcasePreview publicPath={live.publicPath} doc={draft.doc} hasServices /> : <p className="text-sm text-foreground/70">{t('supplier.showcase.editor.noAddress')}</p>;

  let panel: ReactNode;
  if (step === 'style') panel = <StylePanel doc={draft.doc} change={draft.change} invalid={draft.invalid} categories={categories} />;
  else if (step === 'texts') panel = <TextsPanel doc={draft.doc} change={draft.change} invalid={draft.invalid} />;
  else if (step === 'services') panel = <ServicesPanel doc={draft.doc} change={draft.change} invalid={draft.invalid} />;
  else panel = <PublishPanel content={live} doc={draft.doc} onPublish={() => void publishNow()} busy={publish.isPending} />;

  return (
    <div className="space-y-4" data-testid="supplier-showcase-work">
      <PageHeader
        title={t('supplier.showcase.title')}
        description={t('supplier.showcase.editor.description')}
        crumbs={[{ label: t('supplier.showcase.title'), to: OVERVIEW_PATH }, { label: stepLabel }]}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <nav aria-label={t('supplier.showcase.editor.stepsLabel')}>
          <ol className="flex flex-wrap gap-2">
            {EDITOR_STEPS.map((candidate, index) => (
              <li key={candidate}>
                <Link
                  to={stepPath(candidate)}
                  aria-current={candidate === step ? 'step' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium ring-1 ring-inset ring-border transition-colors',
                    candidate === step ? 'bg-foreground text-background ring-foreground' : 'hover:bg-muted',
                  )}
                  data-testid={`supplier-showcase-step-${candidate}`}
                >
                  {index + 1}. {t(`supplier.showcase.editor.steps.${candidate}`)}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
        <SaveLine status={draft.status} savedAt={draft.savedAt} onRetry={() => void draft.flush()} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:items-start">
        <section key={generation} className="min-w-0 rounded-xl border p-4 sm:p-6" aria-label={stepLabel}>
          {/* While a publication is on its way nothing can be written: a save in that moment would carry the version it is replacing. */}
          <fieldset disabled={publish.isPending} className="m-0 min-w-0 border-0 p-0">
            {panel}
          </fieldset>
        </section>
        {phone ? (
          live.publicPath ? (
            <div>
              <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)} data-testid="supplier-showcase-preview-open">
                <Eye className="mr-1 h-4 w-4" aria-hidden="true" />
                {t('supplier.showcase.editor.preview')}
              </Button>
            </div>
          ) : null
        ) : (
          <aside className="min-w-0 xl:sticky xl:top-20" aria-label={t('supplier.showcase.editor.preview')}>
            {preview}
          </aside>
        )}
      </div>

      {phone ? (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('supplier.showcase.editor.preview')}</DialogTitle>
              <DialogDescription>{t('supplier.showcase.preview.note')}</DialogDescription>
            </DialogHeader>
            {preview}
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={draft.status === 'conflict'} onOpenChange={() => undefined}>
        <DialogContent data-testid="supplier-showcase-conflict" onEscapeKeyDown={(event) => event.preventDefault()} onInteractOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t('supplier.showcase.editor.conflict.title')}</DialogTitle>
            <DialogDescription>{t('supplier.showcase.editor.conflict.description')}</DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            loading={reloading}
            onClick={() => {
              setReloading(true);
              draft
                .reload()
                .then(() => setGeneration((value) => value + 1))
                .catch(() => toast.error(t('supplier.showcase.loadError')))
                .finally(() => setReloading(false));
            }}
          >
            {t('supplier.showcase.editor.conflict.reload')}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
