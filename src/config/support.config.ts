const EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/**
 * Support e-mail from the build configuration (`VITE_SUPPORT_EMAIL`), or `null` when it is missing or is not an
 * e-mail address. Pages that point the user to support show a generic text in that case: no address is ever invented.
 */
export function resolveSupportEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim();
  return EMAIL_PATTERN.test(email) ? email : null;
}

/** Support contact shown to users who cannot use the app, e.g. a deactivated account (PL-03). */
export const supportConfig = {
  email: resolveSupportEmail(import.meta.env.VITE_SUPPORT_EMAIL),
} as const;
