import { isEntryFeatureEnabled } from '@/config/route-manifest';
import { useEffect, useReducer } from 'react';
import { useCommercialProfile } from '@/hooks/use-commercial-profile';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { resolveLaunchTarget } from '@/lib/onboarding-part-launch';
import { knownParts, partsWaitedFor } from '@/lib/onboarding-parts';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { useOnboardingPlan } from '@/queries/use-onboarding-plan';
import { useOrgComplianceSender } from '@/queries/use-org-compliance-sender';
import { commercialPartAllowed, commercialRouteAllowed } from './commercial-access';
import { clearPlanResume, getPlanResumeRecord } from './plan-resume';

/** A pause records intent; the server still decides whether that task needs attention. */
export function usePlanResume(userId: string | null | undefined, orgId: string | null | undefined, enabled = true) {
  const commercial = useCommercialProfile();
  const { flags } = useFeatureFlags();
  const { contexts, hasPermission } = useWorkspace();
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const saved = enabled ? getPlanResumeRecord(userId, orgId) : null;
  const step = saved?.step ?? null;
  const expiresAt = saved?.expiresAt;
  const allowed = !!step && flags.octorateOnboarding && hasPermission('short-rent', 'property.read')
    && (step === 'mittente' ? isOrgBillingAdmin(contexts) : commercialPartAllowed(commercial, step));
  const plan = useOnboardingPlan({ enabled: allowed && step !== 'mittente' });
  const sender = useOrgComplianceSender(allowed && step === 'mittente');
  const query = step === 'mittente' ? sender : plan;
  const pending = allowed && (query.isPending || (query.isFetching && !query.isFetchedAfterMount));
  const verified = allowed && !pending && query.isSuccess;
  const parts = knownParts(plan.data);
  const part = parts.find(item => item.code === step);
  const launch = part && resolveLaunchTarget(part.launchTarget, null, null, hasPermission, part.reason, flags);
  const stillOpen = step === 'mittente' ? sender.data?.sender === null
    : !plan.data?.activated && !!launch && isEntryFeatureEnabled(launch.entry, flags) && commercialRouteAllowed(commercial, launch.to)
      && (part?.state === 'open' || (part?.state === 'deferred' && partsWaitedFor(part, parts).length === 0));

  useEffect(() => {
    if (verified && !stillOpen) clearPlanResume(userId, orgId);
  }, [userId, orgId, verified, stillOpen]);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(refresh, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (!enabled || !userId || !orgId) return;
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [enabled, userId, orgId]);

  return { step: verified && stillOpen ? step : null, pending };
}
