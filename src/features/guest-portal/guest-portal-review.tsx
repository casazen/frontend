import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { ApiClient } from '@/api/client';
import { getHttpStatus } from '@/lib/api-errors';

interface Labels {
  rating: string;
  ratingValue: string;
  comment: string;
  showName: string;
  send: string;
  loading: string;
  failed: string;
  unavailable: string;
  submitted: string;
}

const STARS = [1, 2, 3, 4, 5] as const;

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
          <span id="stay-review-rating">{labels.rating}</span>
          <div role="radiogroup" aria-labelledby="stay-review-rating" className="stay-stars" data-testid="guest-review-rating">
            {STARS.map((value) => (
              <label key={value} className="stay-star" data-on={value <= Number(rating) || undefined}>
                <input
                  type="radio"
                  name="stay-review-rating"
                  value={value}
                  checked={rating === String(value)}
                  required
                  aria-label={labels.ratingValue.replace('{value}', String(value))}
                  onChange={(event) => setRating(event.target.value)}
                />
                <Star aria-hidden="true" />
              </label>
            ))}
          </div>
          <label htmlFor="stay-review-text">{labels.comment}</label>
          <textarea id="stay-review-text" value={text} maxLength={1500} onChange={(event) => setText(event.target.value)} />
          <label className="stay-checkbox">
            <input type="checkbox" checked={showName} onChange={(event) => setShowName(event.target.checked)} /> {labels.showName}
          </label>
          <button className="stay-action-primary" disabled={!rating || send.isPending} type="submit">{labels.send}</button>
        </form>
      )}
    </section>
  );
}
