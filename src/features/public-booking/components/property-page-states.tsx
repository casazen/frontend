import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SearchX, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicSiteState } from '@/features/public-site/components/public-site-state';
import { cn } from '@/lib/utils';

function Bone({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-[var(--cz-public-border)] motion-reduce:animate-none', className)} />;
}

export function PropertyPageSkeleton() {
  const { t } = useTranslation();

  return (
    <div role="status" aria-busy="true" className="space-y-6 md:space-y-8" data-testid="property-skeleton">
      <span className="sr-only">{t('publicProperty.loading')}</span>
      <div aria-hidden className="space-y-6 md:space-y-8">
        <Bone className="h-4 w-48" />
        <Bone className="-mx-3 aspect-[4/3] rounded-none md:mx-0 md:aspect-auto md:h-[24rem] md:rounded-[var(--cz-public-radius)] lg:h-[28rem]" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
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

export function AmenitySkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2" data-testid="amenities-skeleton">
      {Array.from({ length: 6 }, (_, index) => (
        <Bone key={index} className="h-5 w-2/3" />
      ))}
    </div>
  );
}

interface PropertyNotFoundProps {
  basePath: string;
  contactEmail?: string | null;
}

export function PropertyNotFound({ basePath, contactEmail }: PropertyNotFoundProps) {
  const { t } = useTranslation();

  return (
    <PublicSiteState
      icon={SearchX}
      testId="property-not-found"
      title={t('publicProperty.notFound.title')}
      description={t('publicProperty.notFound.text')}
    >
      <Button asChild>
        <Link to={basePath}>{t('publicProperty.notFound.action')}</Link>
      </Button>
      {contactEmail ? (
        <Button asChild variant="outline">
          <a href={`mailto:${contactEmail}`}>{t('publicProperty.notFound.contact')}</a>
        </Button>
      ) : null}
    </PublicSiteState>
  );
}

interface PropertyLoadErrorProps {
  orgName: string;
  basePath: string;
  onRetry: () => void;
}

export function PropertyLoadError({ orgName, basePath, onRetry }: PropertyLoadErrorProps) {
  const { t } = useTranslation();

  return (
    <PublicSiteState
      icon={TriangleAlert}
      role="alert"
      testId="property-load-error"
      title={t('publicProperty.loadError.title')}
      description={t('publicProperty.loadError.text')}
    >
      <Button type="button" onClick={onRetry}>
        {t('shared.errorFallback.tryAgain')}
      </Button>
      <Button asChild variant="outline">
        <Link to={basePath}>{t('publicBooking.backToOrg', { orgName })}</Link>
      </Button>
    </PublicSiteState>
  );
}
