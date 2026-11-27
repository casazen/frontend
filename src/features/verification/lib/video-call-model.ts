import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, isTransientRequestError } from '@/lib/api-errors';

/** The longest address of a meeting the API takes (backend `VerificationQueueService`): the server checks again and answers 422 `video_call_url_invalid`. */
export const VIDEO_CALL_URL_MAX_LENGTH = 500;

/** What the box of the address starts with before anything is typed: the scheme the API requires, which is no word of any language. */
export const VIDEO_CALL_URL_PLACEHOLDER = 'https://';

/**
 * The address of a meeting as the API accepts it (E22/F02/US01/T02): absolute `https`, at most 500 characters, no space or line break and no user name or password in it. It is never opened by
 * CasaZen, so the shape is all there is to check; the server decides again.
 */
export function isMeetingUrl(value: string): boolean {
  const text = value.trim();
  if (text === '' || text.length > VIDEO_CALL_URL_MAX_LENGTH || /\s/.test(text)) return false;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && url.hostname !== '' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/** Why a video call was not proposed, in the terms the dialog has words for (`verification.videoCall.errors.*`). */
export const VIDEO_CALL_PROBLEMS = [
  'invalid_url',
  'not_pending',
  'unreachable',
  'not_sent',
  'outcome_unknown',
  'too_many_requests',
  'forbidden',
  'failed',
] as const;
export type VideoCallProblem = (typeof VIDEO_CALL_PROBLEMS)[number];

/**
 * A failure of the call reduced to what the operator is told. Only the status and the code of the answer are read (the request holds the address of the meeting). An answer that never came,
 * or a server that failed, is an outcome nobody knows: the e-mail may have been queued before it, so the dialog says it could not confirm the sending and never that nothing was sent.
 */
export function classifyVideoCallError(error: unknown): VideoCallProblem {
  const status = getHttpStatus(error);
  if (status === undefined) return isTransientRequestError(error) ? 'outcome_unknown' : 'failed';

  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  if (status === 422 && code === 'video_call_url_invalid') return 'invalid_url';
  if (status === 404) return 'not_pending';
  if (status === 409 && code === 'guest_unreachable') return 'unreachable';
  if (status === 409 && code === 'video_call_not_sent') return 'not_sent';
  if (status === 429) return 'too_many_requests';
  if (status === 403) return 'forbidden';
  if (status >= 500) return 'outcome_unknown';
  return 'failed';
}

/** The key of the sentence that tells the operator why the video call was not proposed. */
export function videoCallProblemKey(problem: VideoCallProblem): string {
  return `verification.videoCall.errors.${problem}`;
}
