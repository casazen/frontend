import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';

interface Review {
  id: string;
  hostName: string;
  email: string;
  supplied: { vatNumber: string | null; fiscalCode: string | null; phone: string | null };
  candidates: { supplierOrgId: string; name: string; email: string; matchedBy: string[] }[];
}

const identifierLabels = { vatNumber: 'vat', fiscalCode: 'fiscal', phone: 'phone' } as const;
const identifierKeys = ['vatNumber', 'fiscalCode', 'phone'] as const;
const path = '/admin/suppliers/identity-reviews';
const reviewKey = ['admin', 'supplier-identity-reviews'] as const;

function ReviewForm({ review }: { review: Review }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [choice, setChoice] = useState('');
  const decision = useMutation({
    mutationFn: () => ApiClient.post<void>(path + '/' + review.id + '/decision',
      choice === 'distinct' || choice === 'reject' ? { action: choice } : { action: 'existing', supplierOrgId: choice }),
    onSettled: () => cache.invalidateQueries({ queryKey: reviewKey }),
  });
  return (
    <form className="space-y-3 rounded-lg border p-4" onSubmit={event => { event.preventDefault(); if (choice) decision.mutate(); }}>
      <h3 className="font-medium">{review.hostName}</h3>
      <p className="break-words text-sm">{t('supplier.identity.submitted', { email: review.email })}</p>
      <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {identifierKeys.filter(key => review.supplied[key]).map(key =>
          <div key={key}><dt className="text-muted-foreground">{t('supplier.identity.' + identifierLabels[key])}</dt><dd>{review.supplied[key]}</dd></div>)}
      </dl>
      <fieldset className="space-y-2" disabled={decision.isPending}>
        <legend className="mb-1 text-sm font-medium">{t('supplier.identity.decide')}</legend>
        {review.candidates.map(candidate => (
          <label key={candidate.supplierOrgId} className="flex items-start gap-2 rounded-md border p-3">
            <input type="radio" name="decision" required value={candidate.supplierOrgId}
              checked={choice === candidate.supplierOrgId} onChange={() => setChoice(candidate.supplierOrgId)} />
            <span className="min-w-0 break-words text-sm"><strong>{candidate.name}</strong> · {candidate.email}
              <span className="block text-muted-foreground">{t('supplier.identity.matched', {
                fields: candidate.matchedBy.map(key => t('supplier.identity.' + key)).join(', '),
              })}</span>
            </span>
          </label>
        ))}
        {!review.candidates.some(c => c.matchedBy.includes('email')) &&
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="decision" required
            checked={choice === 'distinct'} onChange={() => setChoice('distinct')} />{t('supplier.identity.distinct', { email: review.email })}</label>}
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="decision" required
          checked={choice === 'reject'} onChange={() => setChoice('reject')} />{t('supplier.identity.reject')}</label>
      </fieldset>
      <Button type="submit" disabled={!choice || decision.isPending}>{t('supplier.identity.confirm')}</Button>
      {decision.isError && <p role="alert" className="text-sm text-destructive">{t('supplier.identity.resolveError')}</p>}
    </form>
  );
}

export function SupplierIdentityReviews() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [...reviewKey, page],
    queryFn: ({ signal }) => ApiClient.get<Review[]>(path, { page }, { signal }),
  });
  return (
    <section className="space-y-3" aria-label={t('supplier.identity.queue')}>
      <h2 className="text-lg font-semibold">{t('supplier.identity.queue')}</h2>
      {query.isPending && <p role="status">{t('common.loading')}</p>}
      {query.isError && <div role="alert" className="flex items-center gap-2">
        {t('supplier.identity.loadError')} <Button variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button>
      </div>}
      {query.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('supplier.identity.empty')}</p>}
      {query.data?.map(review => <ReviewForm key={review.id} review={review} />)}
      {(page > 1 || query.data?.length === 25) && <div className="flex gap-2">
        <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>{t('common.previous')}</Button>
        <Button variant="outline" disabled={query.data?.length !== 25} onClick={() => setPage(page + 1)}>{t('common.next')}</Button>
      </div>}
    </section>
  );
}
