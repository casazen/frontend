import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, SearchX, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The states of a page of the embeddable widgets (NF-144): loading, not available, site not found and could not be loaded. They sit
 * inside the frame of the shell, in the theme of the org, and they never lean on the height of the window: the frame is as tall as its
 * content, a rule in `vh` would make it grow without end. No link takes the guest out of the frame from here.
 */

interface EmbedStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** `alert` when something went wrong and the guest has to act (retry); otherwise the state is plain content. */
  role?: 'alert';
  testId: string;
  children?: ReactNode;
}

function EmbedState({ icon: Icon, title, description, role, testId, children }: EmbedStateProps) {
  return (
    <section role={role} data-testid={testId} className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-10 text-center">
      <span aria-hidden className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-[var(--cz-public-primary-text,var(--color-primary))]">
        <Icon className="h-6 w-6" />
      </span>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
      {children ? <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </section>
  );
}

export function EmbedSkeleton() {
  const { t } = useTranslation();
  const block = 'animate-pulse rounded bg-black/10 motion-reduce:animate-none';

  return (
    <div role="status" aria-busy="true" data-testid="embed-loading" className="space-y-4 px-3 py-6">
      <span className="sr-only">{t('embed.loading')}</span>
      <div aria-hidden className="space-y-4">
        <div className={`${block} h-6 w-1/2`} />
        <div className={`${block} h-24 w-full`} />
        <div className={`${block} h-4 w-2/3`} />
      </div>
    </div>
  );
}

export function EmbedUnavailable() {
  const { t } = useTranslation();

  return <EmbedState icon={Ban} testId="embed-unavailable" title={t('embed.unavailable.title')} description={t('embed.unavailable.description')} />;
}

export function EmbedNotFound() {
  const { t } = useTranslation();

  return <EmbedState icon={SearchX} testId="embed-not-found" title={t('embed.notFound.title')} description={t('embed.notFound.description')} />;
}

/** The org (or the flags) could not be read for a reason other than «it does not exist»: an error with a retry, never the not-found state. */
export function EmbedError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <EmbedState icon={TriangleAlert} role="alert" testId="embed-error" title={t('embed.error.title')} description={t('embed.error.description')}>
      <Button type="button" onClick={onRetry}>
        {t('shared.errorFallback.tryAgain')}
      </Button>
    </EmbedState>
  );
}

export function EmbedPropertyNotFound() {
  const { t } = useTranslation();

  return (
    <EmbedState
      icon={SearchX}
      testId="embed-property-not-found"
      title={t('publicProperty.notFound.title')}
      description={t('embed.property.notFound.description')}
    />
  );
}

/** The home could not be read for a reason other than «it does not exist»: an error with a retry, never the not-found state. */
export function EmbedPropertyError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <EmbedState icon={TriangleAlert} role="alert" testId="embed-property-error" title={t('publicProperty.loadError.title')} description={t('publicProperty.loadError.text')}>
      <Button type="button" onClick={onRetry}>
        {t('shared.errorFallback.tryAgain')}
      </Button>
    </EmbedState>
  );
}
