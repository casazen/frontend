/**
 * Links of the calls to action of the public site (SEO-VETRINA). CasaZen is on **private invitation** (product owner,
 * 2026-10-13): prices and the onboarding of new customers are not defined yet, so the site never links the signup. A visitor
 * who wants in asks for an invitation by e-mail, at the address of `VITE_SUPPORT_EMAIL`; without it the site only says that
 * the access is by invitation and shows no link.
 */

export function inviteHref(email: string | null, subject: string): string | null {
  return email ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : null;
}

export function referralHref(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
