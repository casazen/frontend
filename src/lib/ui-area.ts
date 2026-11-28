const UI_AREAS = ['short-rent', 'long-rent', 'supplier', 'admin', 'account'] as const;

export type UiArea = (typeof UI_AREAS)[number];

export function uiAreaFromPath(pathname: string): UiArea | null {
  const [, root, segment] = pathname.split('/');
  if (root !== 'app') return null;
  return UI_AREAS.find((area) => area === segment) ?? null;
}
