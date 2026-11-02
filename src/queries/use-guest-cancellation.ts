import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { guestCancellationApi } from '@/api/guest-cancellation.api';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import { GUEST_BOOKING_QUERY } from '@/queries/use-guest-session';
import type { GuestCancelResult, GuestCancellationPreview, GuestLinkCancelResult, GuestSession } from '@/types';

const GUEST_CANCELLATION_QUERY = 'guest-cancellation';

/** 409 of the cancellation: the refund is not the one the guest was shown (a threshold of the policy was crossed, a payment changed). */
const REFUND_CHANGED_CODE = 'refund_changed';

/** An `Idempotency-Key` for one confirmation of the guest: the same key again never cancels or refunds twice. */
export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `c-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function isPreview(value: unknown): value is GuestCancellationPreview {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<GuestCancellationPreview>;
  return typeof candidate.refundAmount === 'number' && typeof candidate.kind === 'string' && typeof candidate.cancellable === 'boolean';
}

/**
 * The preview a 409 `refund_changed` carries: nothing was cancelled, and this is what cancelling does now. `null` for any other error
 * (or an answer without a usable preview), so the screen falls back to a plain error.
 */
export function refundChangedPreview(error: unknown): GuestCancellationPreview | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null;
  const data: unknown = error.response.data;
  if (getProblemCode(data) !== REFUND_CHANGED_CODE) return null;
  const preview = (data as { preview?: unknown }).preview;
  return isPreview(preview) ? preview : null;
}

/** The previews are read again when the page opens and when the guest comes back to the tab: the share the policy grants moves with the days. */
const PREVIEW_STALE_MS = 30_000;

/** The answers that refuse a cancellation for what is true now (409 a payment in progress, 422 the stay began…): read the preview again. */
const REFUSED_STATUSES: readonly number[] = [409, 422];

function areaKey(session: GuestSession) {
  return [GUEST_CANCELLATION_QUERY, 'area', session.bookingCode, session.expiresAt] as const;
}

function linkKey(bookingId: string) {
  return [GUEST_CANCELLATION_QUERY, 'link', bookingId] as const;
}

/** No point in asking again after an answer that will not change on its own. */
function retryOnlyTransient(failures: number, error: unknown): boolean {
  return ![401, 404, 422, 429].includes(getHttpStatus(error) ?? 0) && failures < 2;
}

/**
 * What cancelling the booking of the guest session would do now (DB-08a): the refund, what stays with the host, the days the windows of the
 * policy end on. A 401 means the session ended: the booking is read again, which finds it out and sends the guest back to the form.
 */
export function useGuestCancellationPreview(session: GuestSession) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: areaKey(session),
    queryFn: async () => {
      try {
        return await guestCancellationApi.getPreview(session.accessToken, session.bookingCode);
      } catch (error) {
        if (getHttpStatus(error) === 401) void queryClient.invalidateQueries({ queryKey: [GUEST_BOOKING_QUERY] });
        throw error;
      }
    },
    staleTime: PREVIEW_STALE_MS,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: retryOnlyTransient,
  });
}

interface CancelInput {
  /** The `refundAmount` of the preview the guest saw. */
  expectedRefundAmount: number;
  idempotencyKey: string;
}

/**
 * The guest cancels from the guest area for the refund they were shown. On success the booking and the preview are read again, so the
 * area shows a cancelled booking and its refund; on a 409 `refund_changed` the new preview replaces the one on screen (nothing was cancelled).
 */
export function useCancelFromGuestArea(session: GuestSession) {
  const queryClient = useQueryClient();
  return useMutation<GuestCancelResult, unknown, CancelInput>({
    mutationFn: ({ expectedRefundAmount, idempotencyKey }) =>
      guestCancellationApi.cancel(session.accessToken, session.bookingCode, expectedRefundAmount, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [GUEST_CANCELLATION_QUERY] });
      void queryClient.invalidateQueries({ queryKey: [GUEST_BOOKING_QUERY] });
    },
    onError: (error) => {
      const next = refundChangedPreview(error);
      if (next) queryClient.setQueryData(areaKey(session), next);
      else if (getHttpStatus(error) === 401) void queryClient.invalidateQueries({ queryKey: [GUEST_BOOKING_QUERY] });
      // A refusal (the stay began, a payment is settling, the booking is not cancellable): the preview says what is true now.
      else if (REFUSED_STATUSES.includes(getHttpStatus(error) ?? 0)) {
        void queryClient.invalidateQueries({ queryKey: [GUEST_CANCELLATION_QUERY] });
      }
    },
  });
}

/**
 * The same preview for the page of the link the host sent. The token is read once by the page and passed in: it is not part of the key,
 * so taking it out of the address bar changes nothing here. 422 `guest_cancel_token_invalid` / `_expired` say the link does not work.
 */
export function useLinkCancellationPreview(bookingId: string, token: string) {
  return useQuery({
    queryKey: linkKey(bookingId),
    queryFn: () => guestCancellationApi.getLinkPreview(bookingId, token),
    enabled: bookingId !== '' && token !== '',
    staleTime: PREVIEW_STALE_MS,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: retryOnlyTransient,
  });
}

/** Cancels with the host's link for the refund the page showed; a 409 `refund_changed` replaces the preview and leaves the link usable. */
export function useCancelWithLink(bookingId: string, token: string) {
  const queryClient = useQueryClient();
  return useMutation<GuestLinkCancelResult, unknown, { expectedRefundAmount: number }>({
    mutationFn: ({ expectedRefundAmount }) => guestCancellationApi.cancelWithLink(bookingId, token, expectedRefundAmount),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: linkKey(bookingId) }),
    onError: (error) => {
      const next = refundChangedPreview(error);
      if (next) queryClient.setQueryData(linkKey(bookingId), next);
      else if (REFUSED_STATUSES.includes(getHttpStatus(error) ?? 0)) void queryClient.invalidateQueries({ queryKey: linkKey(bookingId) });
    },
  });
}
