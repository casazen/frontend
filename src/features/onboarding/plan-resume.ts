import { isOnboardingPartKey, ONBOARDING_PLAN_PATH } from '@/lib/onboarding-parts';
import type { OnboardingPartKey } from '@/types/onboarding.types';

export type PlanResumeStep = 'mittente' | OnboardingPartKey;
type ScopeId = string | null | undefined;
const ONE_DAY = 24 * 60 * 60 * 1000;

interface PlanResumeRecord {
  step: PlanResumeStep;
  expiresAt: number;
}

function scopeKey(userId: ScopeId, orgId: ScopeId) {
  return userId && orgId ? `casazen:onboarding-plan:${encodeURIComponent(userId)}:${encodeURIComponent(orgId)}` : null;
}

export function savePlanResume(userId: ScopeId, orgId: ScopeId, step: PlanResumeStep): void {
  const key = scopeKey(userId, orgId);
  if (!key || (step !== 'mittente' && !isOnboardingPartKey(step))) return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ step, expiresAt: Date.now() + ONE_DAY }));
  } catch { /* The plan is also accessible from the guide with browser storage disabled. */ }
}

export function clearPlanResume(userId: ScopeId, orgId: ScopeId): void {
  const key = scopeKey(userId, orgId);
  if (!key) return;
  try { window.localStorage.removeItem(key); } catch { /* Storage is optional. */ }
}

export function getPlanResumeRecord(userId: ScopeId, orgId: ScopeId): PlanResumeRecord | null {
  const key = scopeKey(userId, orgId);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if ((record?.step === 'mittente' || isOnboardingPartKey(record?.step)) && Number.isFinite(record.expiresAt) && record.expiresAt > Date.now()) {
      return { step: record.step, expiresAt: record.expiresAt };
    }
  } catch { /* Ignore malformed or old records. */ }
  clearPlanResume(userId, orgId);
  return null;
}

export function readPlanResume(userId: ScopeId, orgId: ScopeId): PlanResumeStep | null {
  return getPlanResumeRecord(userId, orgId)?.step ?? null;
}

export function planResumeHref(step: PlanResumeStep): string {
  return `${ONBOARDING_PLAN_PATH}#${step === 'mittente' ? step : `passo-${step}`}`;
}
