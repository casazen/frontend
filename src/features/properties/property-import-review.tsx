import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { propertyActivationApi } from '@/api/property-activation.api';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/error-state';
import { getProblemMessage } from '@/lib/api-errors';
import { propertyEditPath, propertyTabPath } from './properties-paths';

const fieldLinks: Record<string, (id: string) => string> = {
  descriptionIt: (id) => `${propertyEditPath(id)}#description`,
  descriptionEn: (id) => propertyTabPath(id, 'site'),
  beds: (id) => `${propertyEditPath(id)}#beds`,
  maxGuests: (id) => `${propertyEditPath(id)}#maxGuests`,
  cin: (id) => `${propertyEditPath(id)}#cinCode`,
  photos: (id) => propertyTabPath(id, 'photos'),
  nightlyRate: (id) => `${propertyEditPath(id)}#nightlyRate`,
};

export function PropertyImportReview({ propertyId, canEdit }: { propertyId: string; canEdit: boolean }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['property-import-review', propertyId];
  const review = useQuery({ queryKey, queryFn: async () => await propertyActivationApi.review(propertyId) || null });
  const recheck = useMutation({
    mutationFn: (field?: string) => propertyActivationApi.recheck(propertyId, field),
    onSuccess: (value) => queryClient.setQueryData(queryKey, value),
  });

  if (review.isError) {
    return <ErrorState title={t('activationJourney.import.loadError')} error={review.error} onRetry={() => void review.refetch()} />;
  }
  if (!review.data) return null;
  const { openFindings, snapshot } = review.data;

  return (
    <div className="space-y-3">
      <a className="inline-flex min-h-11 items-center underline" href={snapshot.sourceUrl} target="_blank" rel="noreferrer">
        {t('activationJourney.import.source', { provider: snapshot.provider })}
      </a>
      {openFindings.length === 0 ? <p>{t('activationJourney.import.complete')}</p> : (
        <ul className="divide-y rounded-lg border">
          {openFindings.map((finding, index) => {
            const href = fieldLinks[finding.field]?.(propertyId);
            return (
              <li key={`${finding.field}-${index}`} className="space-y-1 p-3">
                <p className="font-medium">{t(`activationJourney.import.fields.${finding.field}`)}</p>
                <p className="text-sm text-muted-foreground">
                  {t(`activationJourney.import.states.${finding.status}`)}
                  {finding.reason !== 'missing' && ` · ${finding.reason}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {canEdit && href && <Button asChild variant="outline" className="min-h-11"><Link to={href}>{t('activationJourney.import.edit')}</Link></Button>}
                  {canEdit && finding.status === 'confirm' && (
                    <Button variant="outline" className="min-h-11" disabled={recheck.isPending}
                      onClick={() => recheck.mutate(finding.field)}>{t('activationJourney.import.confirm')}</Button>
                  )}
                  {finding.source && finding.source !== snapshot.sourceUrl && (
                    <a className="inline-flex min-h-11 items-center underline" href={finding.source} target="_blank" rel="noreferrer">
                      {t('activationJourney.import.findingSource')}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && <Button variant="outline" className="min-h-11" disabled={recheck.isPending} onClick={() => recheck.mutate(undefined)}>
        {t('activationJourney.import.recheck')}
      </Button>}
      {recheck.isError && <p role="alert" className="text-sm text-destructive">{getProblemMessage(recheck.error, t) ?? t('activationJourney.import.loadError')}</p>}
      {snapshot.ratePlans.length > 0 && (
        <details className="rounded-lg border p-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">{t('activationJourney.import.fields.ratePlans')}</summary>
          <ul className="space-y-3">
            {snapshot.ratePlans.map((plan) => (
              <li key={plan.id} className="border-t pt-2">
                <p className="font-medium">{plan.name}</p>
                <p className="text-sm text-muted-foreground">
                  {t(`activationJourney.import.priceKinds.${plan.priceKind}`)}
                  {plan.amount != null && ` · ${new Intl.NumberFormat(i18n.language, { style: 'currency', currency: plan.currency }).format(plan.amount)} / ${plan.unit}`}
                  {plan.from && plan.to && ` · ${plan.from} – ${plan.to}`}
                </p>
                {[plan.conditions, plan.payment, plan.restrictions, plan.supplements].filter(Boolean).map((text, index) => (
                  <p key={index} className="text-sm">{text}</p>
                ))}
              </li>
            ))}
          </ul>
        </details>
      )}
      {snapshot.unmappedFields && Object.keys(snapshot.unmappedFields).length > 0 && (
        <details className="rounded-lg border p-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">{t('activationJourney.import.states.mapping')}</summary>
          <dl>{Object.entries(snapshot.unmappedFields).map(([key, value]) => (
            <div key={key} className="break-words border-t py-2"><dt className="font-medium">{key}</dt><dd className="text-sm">{value}</dd></div>
          ))}</dl>
        </details>
      )}
    </div>
  );
}
