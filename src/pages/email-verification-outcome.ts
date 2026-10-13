export type EmailVerificationOutcome = 'verified' | 'failed' | 'unknown';

/**
 * Auth0 appends `success` and `code` to the Redirect To URL of the verification email.
 * `code=success` is not an OAuth code: this page is not the login redirect (`window.location.origin`).
 */
export function emailVerificationOutcome(params: URLSearchParams): EmailVerificationOutcome {
  const success = params.get('success');
  if (success === 'false') return 'failed';
  if (success === 'true' || params.get('code') === 'success') return 'verified';
  return 'unknown';
}
