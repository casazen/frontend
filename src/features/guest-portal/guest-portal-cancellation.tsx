import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { getHttpStatus } from '@/lib/api-errors';

interface Preview {
  cancellable: boolean;
  currency: string;
  refundAmount: number;
  outcome: { refundAmount: number; refundStatus: string } | null;
}

export function GuestPortalCancellation({ path, language, onCancelled, labels }: {
  path: string;
  language: string;
  onCancelled: () => void;
  labels: Record<'loading' | 'failed' | 'unavailable' | 'cancelled' | 'refund' | 'changed' | 'confirm', string>;
}) {
  const endpoint = `${path}/cancellation`;
  const [changed, setChanged] = useState(false);
  const query = useQuery({
    queryKey: ['guest-portal-cancellation', endpoint],
    queryFn: ({ signal }) => ApiClient.get<Preview>(endpoint, undefined, { public: true, signal }),
    gcTime: 0,
    retry: false,
  });
  const cancel = useMutation({
    mutationFn: (amount: number) => ApiClient.post(endpoint, { confirm: true, expectedRefundAmount: amount },
      { public: true, headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onSuccess: () => {
      setChanged(false);
      onCancelled();
      void query.refetch();
    },
    onError: (error) => {
      if (getHttpStatus(error) === 409) {
        setChanged(true);
        void query.refetch();
      }
    },
  });
  const preview = query.data;
  const amount = preview && new Intl.NumberFormat(language, { style: 'currency', currency: preview.currency })
    .format(preview.outcome?.refundAmount ?? preview.refundAmount);
  return (
    <section className="stay-card stay-content">
      {query.isPending && <p role="status">{labels.loading}</p>}
      {(query.isError || (cancel.isError && !changed)) && <p role="alert">{labels.failed}</p>}
      {changed && <p role="alert">{labels.changed}</p>}
      {(cancel.isSuccess || preview?.outcome) && <p role="status">{labels.cancelled}</p>}
      {preview && !preview.cancellable && !preview.outcome && !cancel.isSuccess && <p>{labels.unavailable}</p>}
      {preview && (preview.cancellable || preview.outcome) && <p>{labels.refund} <strong>{amount}</strong></p>}
      {preview?.cancellable && !cancel.isSuccess && (
        <button type="button" disabled={query.isFetching || cancel.isPending}
          onClick={() => { setChanged(false); cancel.mutate(preview.refundAmount); }}>
          {labels.confirm}
        </button>
      )}
    </section>
  );
}
