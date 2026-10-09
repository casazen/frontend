/**
 * The areas that have an accent color (`html[data-area=...]` in `src/styles/tokens.css`): the keys of the app contexts
 * (`AppContextKey`) plus `account`, the customer's administration of decision D1, which will use the same accent as `admin`.
 */
const UI_AREAS = ['short-rent', 'long-rent', 'supplier', 'admin', 'account'] as const;

export type UiArea = (typeof UI_AREAS)[number];

/** The area of a pathname `/app/<area>/...`, or null where there is none (login, area picker, public pages). */
export function uiAreaFromPath(pathname: string): UiArea | null {
  const [, root, segment] = pathname.split('/');
  if (root !== 'app') return null;
  return UI_AREAS.find((area) => area === segment) ?? null;
}
