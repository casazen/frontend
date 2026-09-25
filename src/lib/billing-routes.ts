/**
 * Plan and billing pages of the org (PL-16, A1-36). They exist in the shell of each rental context, so a long-term
 * landlord manages its plan without the short-rent context. The same paths are the allow-list of the Stripe return pages
 * on the backend (`PublicSiteLinks.BillingReturnPagePaths`, `returnPath` of the checkout and of the portal): keep the
 * two lists aligned.
 */
export const BILLING_CONTEXTS = ['short-rent', 'long-rent'] as const;

export type BillingContextKey = (typeof BILLING_CONTEXTS)[number];

export function isBillingContext(value: string | null | undefined): value is BillingContextKey {
  return BILLING_CONTEXTS.some((context) => context === value);
}

/** Plans and Stripe checkout of the org in the shell of `context`. */
export function planPagePath(context: BillingContextKey): string {
  return `/app/${context}/settings/plan`;
}

/** Subscription, billing portal and billing profile of the org in the shell of `context`. */
export function billingPagePath(context: BillingContextKey): string {
  return `/app/${context}/settings/billing`;
}

const BILLING_RETURN_PATHS: ReadonlySet<string> = new Set(
  BILLING_CONTEXTS.flatMap((context) => [planPagePath(context), billingPagePath(context)]),
);

/**
 * `returnPath` for the checkout and the portal from the current page: the page itself when it is a plan or billing
 * page (the backend accepts nothing else), otherwise `undefined` and the backend default applies.
 */
export function toBillingReturnPath(pathname: string): string | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return BILLING_RETURN_PATHS.has(path) ? path : undefined;
}

/** Context segment of an app path (`/app/<context>/...`), `undefined` outside the app. */
function contextOfPath(pathname: string): string | undefined {
  const [, app, context] = pathname.split('/');
  return app === 'app' ? context : undefined;
}

/**
 * Rental context whose plan page a link on `pathname` should open: the context of the current shell when it has the
 * plan pages, otherwise the first rental context of the user (short-rent first), e.g. from the admin or supplier shell.
 * `null` when the user works in no rental context.
 */
export function resolveBillingContext(
  pathname: string,
  userContexts: readonly string[],
): BillingContextKey | null {
  const current = contextOfPath(pathname);
  if (isBillingContext(current)) return current;
  return BILLING_CONTEXTS.find((context) => userContexts.includes(context)) ?? null;
}
