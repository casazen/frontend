/**
 * The pages of the embeddable widgets live under `/embed` (NF-144): on the agency's own domain (`/embed/booking`) and on the
 * CasaZen domain (`/embed/<orgSlug>/booking`). Another website frames them, so they never use the storage, the cookies or the
 * sign-in of the app. This is its own module with no import, so that what runs at start-up (the language, the sign-in gate, the
 * landing touch) can ask it without loading the widgets.
 *
 * The comparison ignores the case: the router matches a path without looking at it, and a page it renders as a widget must be one
 * that reads and writes nothing.
 */
export function isEmbedPath(pathname: string): boolean {
  const path = (pathname.split(/[?#]/, 1)[0] ?? '').toLowerCase();
  return path === '/embed' || path.startsWith('/embed/');
}
