const EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export function resolveSupportEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export const supportConfig = {
  email: resolveSupportEmail(import.meta.env.VITE_SUPPORT_EMAIL),
} as const;
