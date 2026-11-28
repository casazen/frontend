import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, isTransientRequestError } from '@/lib/api-errors';

export const VIDEO_CALL_URL_MAX_LENGTH = 500;

export const VIDEO_CALL_URL_PLACEHOLDER = 'https://';

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

export function videoCallProblemKey(problem: VideoCallProblem): string {
  return `verification.videoCall.errors.${problem}`;
}
