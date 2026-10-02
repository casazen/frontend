import { isAxiosError } from 'axios';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { publicSupplierApi, type SupplierShowcaseDto } from '@/api/public-supplier.api';
import { SupplierShowcaseView } from '@/features/supplier/components/supplier-showcase-view';
import { supplierShowcasePath } from '@/features/supplier/lib/showcase-paths';
import { useSeoMeta } from '@/lib/seo-meta';

/**
 * Public showcase of a supplier, `/fornitori/:slug` (SU-13, A4-16), in the public shell of CasaZen. `noindex` in v0 and
 * in `robots.txt`, whatever the state: nothing of it is indexed until the product owner decides so. Only a 404 means
 * "this showcase does not exist"; any other failure is an error with a retry.
 */
export function SupplierShowcasePage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, isError, error, refetch } = useQuery<SupplierShowcaseDto>({
    queryKey: ['supplier-showcase', slug],
    queryFn: () => publicSupplierApi.getShowcase(slug!),
    enabled: !!slug,
  });

  const notFound = isError && isAxiosError(error) && error.response?.status === 404;
  useSeoMeta({
    title: data ? t('supplierShowcase.pageTitle', { name: data.legalName }) : t('supplierShowcase.title'),
    description: data ? t('supplierShowcase.pageDescription', { name: data.legalName }) : undefined,
    noindex: true,
  });

  if (isLoading || !slug) {
    return (
      <div className="mx-auto max-w-2xl space-y-4" role="status" data-testid="supplier-showcase-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
        <span className="sr-only">{t('supplierShowcase.loading')}</span>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card data-testid="supplier-showcase-not-found">
          <CardContent className="pt-6 text-center">
            <h1 className="text-lg font-medium">{t('supplierShowcase.notFound')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('supplierShowcase.notFoundDescription')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState
          testId="supplier-showcase-error"
          title={t('supplierShowcase.loadError')}
          error={error}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return <SupplierShowcaseView showcase={data} />;
}

/** The old address `/s/:slug` (it never worked: see A4-16) leads to the showcase. */
export function LegacySupplierShowcaseRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={supplierShowcasePath(slug ?? '')} replace />;
}
