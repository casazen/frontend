import type { QueryClient } from '@tanstack/react-query';
import { UsersApi } from '@/api/users.api';
import { contextsApi } from '@/api/contexts';
import type { UserDetail } from '@/types';

export const PAYMENT_REQUIRED = 'onboarding_payment_required';
export async function confirmWorkspaceAccess(client: QueryClient, destination: string | ((me: UserDetail) => string)): Promise<string> {
  await client.cancelQueries({ queryKey: ['me'] });
  const me = await UsersApi.getMe();
  if (!me.isActive || !me.orgId || !me.onboardingCompletedAt || me.onboardingRequired === true || me.consentsAccepted === false) {
    throw new Error('onboarding_access_not_ready');
  }
  if (me.commercialSetupRequired === true) {
    client.setQueryData(['me'], me);
    throw new Error(PAYMENT_REQUIRED);
  }
  const target = typeof destination === 'string' ? destination : destination(me);
  const expectedContext = target.match(/^\/app\/(short-rent|long-rent|account)(?:\/|$)/)?.[1];
  const bootstrap = await contextsApi.getContexts();
  if (bootstrap.userId !== me.id || !expectedContext || !bootstrap.contexts.some(context => context.contextKey === expectedContext)) {
    throw new Error('onboarding_access_not_ready');
  }
  client.setQueryData(['me'], me);
  return target;
}
