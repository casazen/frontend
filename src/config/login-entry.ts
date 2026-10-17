/**
 * Whether the public pages (the public site, the search, the guides and the other pages of CasaZen that anyone can open)
 * offer a way in to the app: the "Accedi" link.
 *
 * Not on the production site: CasaZen is on private invitation, so its public pages do not invite a visitor to log in; the
 * people who have an account reach the app by typing its address (`/login`, which goes straight to Auth0). Anywhere else (the
 * test deployment, previews, local) the link stays, so that the team can log in from the page.
 *
 * "The production site" is a build that has the public domain configured (`VITE_PUBLIC_SITE_URL`): only a Vercel Production
 * build has it (`.env.example`), and it is the same signal that lets `robots.txt` allow indexing (`vite.config.ts`). The
 * value is in the bundle, so the static pages rendered at build time and the browser agree (no hydration mismatch).
 */
export function showLoginEntryPoints(publicSiteUrl: unknown): boolean {
  return !(typeof publicSiteUrl === 'string' && publicSiteUrl.trim() !== '');
}
