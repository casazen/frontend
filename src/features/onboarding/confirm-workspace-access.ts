import type { QueryClient } from '@tanstack/react-query';
import { UsersApi } from '@/api/users.api';
import { contextsApi } from '@/api/contexts';

/** Confirm persisted access, never manufacture roles from the submitted onboarding answers or a stale ID token. */
export async function confirmWorkspaceAccess(client: QueryClient, target: string): Promise<void> {
  await client.cancelQueries({ queryKey: ['me'] });
  const me = await UsersApi.getMe();
  if (!me.isActive || !me.orgId || !me.onboardingCompletedAt || me.onboardingRequired === true || me.consentsAccepted === false) {
    throw new Error('onboarding_access_not_ready');
  }
  if (me.commercialSetupRequired === true) {
    // The mutation's background profile refetch was cancelled above. Publish the verified payment gate so the
    // parent can switch to billing, but never interpret that transition as permission to enter a host workspace.
    client.setQueryData(['me'], me);
    throw new Error('onboarding_payment_required');
  }
  const expectedContext = target.match(/^\/app\/(short-rent|long-rent|account)(?:\/|$)/)?.[1];
  const bootstrap = await contextsApi.getContexts();
  if (bootstrap.userId !== me.id || !expectedContext || !bootstrap.contexts.some(context => context.contextKey === expectedContext)) {
    throw new Error('onboarding_access_not_ready');
  }
  client.setQueryData(['me'], me);
}
