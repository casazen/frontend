import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { guestCancellationApi } from '@/api/guest-cancellation.api';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import { GUEST_BOOKING_QUERY } from '@/queries/use-guest-session';
import type { GuestCancelResult, GuestCancellationPreview, GuestLinkCancelResult, GuestSession } from '@/types';

const GUEST_CANCELLATION_QUERY = 'guest-cancellation';

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

export function refundChangedPreview(error: unknown): GuestCancellationPreview | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null;
  const data: unknown = error.response.data;
  if (getProblemCode(data) !== REFUND_CHANGED_CODE) return null;
  const preview = (data as { preview?: unknown }).preview;
  return isPreview(preview) ? preview : null;
}

const PREVIEW_STALE_MS = 30_000;

const REFUSED_STATUSES: readonly number[] = [409, 422];

function areaKey(session: GuestSession) {
  return [GUEST_CANCELLATION_QUERY, 'area', session.bookingCode, session.expiresAt] as const;
}

function linkKey(bookingId: string) {
  return [GUEST_CANCELLATION_QUERY, 'link', bookingId] as const;
}

function retryOnlyTransient(failures: number, error: unknown): boolean {
  return ![401, 404, 422, 429].includes(getHttpStatus(error) ?? 0) && failures < 2;
}

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
  expectedRefundAmount: number;
  idempotencyKey: string;
}

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
      else if (REFUSED_STATUSES.includes(getHttpStatus(error) ?? 0)) {
        void queryClient.invalidateQueries({ queryKey: [GUEST_CANCELLATION_QUERY] });
      }
    },
  });
}

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
