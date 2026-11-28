export type EmailVerificationOutcome = 'verified' | 'failed' | 'unknown';

export function emailVerificationOutcome(params: URLSearchParams): EmailVerificationOutcome {
  const success = params.get('success');
  if (success === 'false') return 'failed';
  if (success === 'true' || params.get('code') === 'success') return 'verified';
  return 'unknown';
}
