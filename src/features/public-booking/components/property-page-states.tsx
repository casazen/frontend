import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A placeholder block, in the tone of the site's own border color (not the console's gray) and still when motion is reduced. */
function Bone({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-[var(--cz-public-border)] motion-reduce:animate-none', className)} />;
}

/** The page while it loads: the same blocks in the same places, so nothing jumps when the content arrives. */
export function PropertyPageSkeleton() {
  const { t } = useTranslation();

  return (
    <div role="status" aria-busy="true" className="space-y-6 md:space-y-8" data-testid="property-skeleton">
      <span className="sr-only">{t('publicProperty.loading')}</span>
      <div aria-hidden className="space-y-6 md:space-y-8">
        <Bone className="h-4 w-48" />
        <Bone className="-mx-3 aspect-[4/3] rounded-none md:mx-0 md:aspect-auto md:h-[24rem] md:rounded-[var(--cz-public-radius)] lg:h-[28rem]" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <div className="space-y-8">
            <div className="space-y-3">
              <Bone className="h-9 w-3/4 max-w-md" />
              <Bone className="h-4 w-40" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Bone className="h-24" />
              <Bone className="h-24" />
              <Bone className="h-24" />
            </div>
            <div className="space-y-3">
              <Bone className="h-4 w-full" />
              <Bone className="h-4 w-11/12" />
              <Bone className="h-4 w-4/5" />
              <Bone className="h-4 w-2/3" />
            </div>
          </div>
          <Bone className="hidden h-[26rem] rounded-[var(--cz-public-radius)] lg:block" />
        </div>
      </div>
    </div>
  );
}

/** The list of amenities while its code arrives: a few lines where the list will be. */
export function AmenitySkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2" data-testid="amenities-skeleton">
      {Array.from({ length: 6 }, (_, index) => (
        <Bone key={index} className="h-5 w-2/3" />
      ))}
    </div>
  );
}

/** One column in the middle with an icon, a title, a sentence and the ways out: the shape of the two states below. */
function StateBlock({ icon, title, text, alert, children }: { icon: ReactNode; title: string; text: string; alert?: boolean; children: ReactNode }) {
  return (
    <div
      role={alert ? 'alert' : undefined}
      className="mx-auto flex min-h-[55vh] max-w-md flex-col items-center justify-center gap-3 px-4 py-12 text-center"
    >
      <span aria-hidden className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-[var(--cz-public-primary-text)]">
        {icon}
      </span>
      <h1 className="public-display text-balance text-2xl font-semibold">{title}</h1>
      <p className="text-[var(--cz-public-muted)]">{text}</p>
      <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">{children}</div>
    </div>
  );
}

interface PropertyNotFoundProps {
  /** `/book/:orgSlug`: where the other homes are. */
  basePath: string;
  /** The e-mail the host chose to publish, when there is one. */
  contactEmail?: string | null;
}

/** The property does not exist or is not bookable online (the API answers 404 for both): say so and point to the other homes. */
export function PropertyNotFound({ basePath, contactEmail }: PropertyNotFoundProps) {
  const { t } = useTranslation();

  return (
    <div data-testid="property-not-found">
      <StateBlock
        icon={<SearchX className="h-7 w-7" />}
        title={t('publicProperty.notFound.title')}
        text={t('publicProperty.notFound.text')}
      >
        <Button asChild className="public-site-cta border-0">
          <Link to={basePath}>{t('publicProperty.notFound.action')}</Link>
        </Button>
        {contactEmail ? (
          <Button asChild variant="outline">
            <a href={`mailto:${contactEmail}`}>{t('publicProperty.notFound.contact')}</a>
          </Button>
        ) : null}
      </StateBlock>
    </div>
  );
}

interface PropertyLoadErrorProps {
  orgName: string;
  basePath: string;
  onRetry: () => void;
}

/** The property could not be loaded for another reason (network, server): it is not "not found", and it can be tried again. */
export function PropertyLoadError({ orgName, basePath, onRetry }: PropertyLoadErrorProps) {
  const { t } = useTranslation();

  return (
    <div data-testid="property-load-error">
      <StateBlock
        alert
        icon={<CircleAlert className="h-7 w-7" />}
        title={t('publicProperty.loadError.title')}
        text={t('publicProperty.loadError.text')}
      >
        <Button type="button" className="public-site-cta border-0" onClick={onRetry}>
          {t('shared.errorFallback.tryAgain')}
        </Button>
        <Button asChild variant="outline">
          <Link to={basePath}>{t('publicBooking.backToOrg', { orgName })}</Link>
        </Button>
      </StateBlock>
    </div>
  );
}
