import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import { ReportAccessDeniedError } from '@/api/report-files';
import { StaleReadNotice } from '@/components/finance/stale-read-notice';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';

interface YearEndReadProps<T> {
  query: UseQueryResult<T>;
  id: string;
  children: (data: T) => ReactNode;
}

/**
 * What a section of the figures of the year says about its read, whatever the read did: a wait, a refusal told in words under the section (a `ReportAccessDeniedError`: the permission on payments or the whole organization is
 * not there; it is an answer, and the app is not sent to the page of no access), a failure with a retry, or the figures. A failed read is never drawn as an empty section, a 404 is «not found» whatever the cache still holds
 * (the query keeps the last answer on an error), and a read that failed after one that worked says the figures may be out of date.
 */
export function YearEndRead<T>({ query, id, children }: YearEndReadProps<T>) {
  const { t } = useTranslation();
  const { data } = query;
  const refused = query.isError && query.error instanceof ReportAccessDeniedError;
  const notFound = query.isError && getHttpStatus(query.error) === 404;

  if (query.isPending) {
    return <SkeletonLine lines={3} label={t('reports.touristTax.yearEnd.details.loading')} />;
  }
  if (refused) {
    return (
      <Alert variant="info" data-testid={`${id}-refused`}>
        {t('reports.touristTax.yearEnd.details.noAccess')}
      </Alert>
    );
  }
  if (data === undefined || notFound) {
    return (
      <ErrorState
        title={notFound ? t('reports.touristTax.yearEnd.details.notFound') : t('reports.touristTax.yearEnd.details.error')}
        error={notFound ? undefined : query.error}
        onRetry={() => void query.refetch()}
        testId={`${id}-error`}
      />
    );
  }
  return (
    <>
      {query.isError ? <StaleReadNotice onRetry={() => void query.refetch()} /> : null}
      {children(data)}
    </>
  );
}
