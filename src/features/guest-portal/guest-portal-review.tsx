import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { getHttpStatus } from '@/lib/api-errors';

interface Labels {
  rating: string;
  comment: string;
  showName: string;
  send: string;
  loading: string;
  failed: string;
  unavailable: string;
  submitted: string;
}

export function GuestPortalReview({ path, labels, onSubmitted }: { path: string; labels: Labels; onSubmitted: () => void }) {
  const [rating, setRating] = useState('');
  const [text, setText] = useState('');
  const [showName, setShowName] = useState(false);
  const endpoint = `${path}/review`;
  const review = useQuery({
    queryKey: ['guest-portal-review', endpoint],
    queryFn: ({ signal }) => ApiClient.get<{ submitted: boolean }>(endpoint, undefined, { public: true, signal }),
    gcTime: 0,
    retry: false,
  });
  const send = useMutation({
    mutationFn: () => ApiClient.post(endpoint, { rating: Number(rating), text, showName }, { public: true }),
    onSuccess: onSubmitted,
    onSettled: () => { void review.refetch(); },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating && !send.isPending) send.mutate();
  }
  const submitted = review.data?.submitted || send.isSuccess;
  const failure = review.error ?? send.error;
  return (
    <section className="stay-card stay-content">
      {review.isPending && <p role="status">{labels.loading}</p>}
      {submitted && <p role="status">{labels.submitted}</p>}
      {!submitted && failure && (
        <p role="alert">{getHttpStatus(failure) === 409 ? labels.unavailable : labels.failed}</p>
      )}
      {review.isSuccess && !submitted && (
        <form onSubmit={submit} className="stay-chat-form">
          <label htmlFor="stay-review-rating">{labels.rating}</label>
          <select id="stay-review-rating" value={rating} required onChange={(event) => setRating(event.target.value)}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <label htmlFor="stay-review-text">{labels.comment}</label>
          <textarea id="stay-review-text" value={text} maxLength={1500} onChange={(event) => setText(event.target.value)} />
          <label className="stay-checkbox">
            <input type="checkbox" checked={showName} onChange={(event) => setShowName(event.target.checked)} /> {labels.showName}
          </label>
          <button disabled={!rating || send.isPending} type="submit">{labels.send}</button>
        </form>
      )}
    </section>
  );
}
