import type { TFunction } from 'i18next';
import type { CalmTone } from '@/components/shared/calm';
import { formatStayDate, nightsBetween, parseStayDate } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { LeaseNextStep, LeaseNextStepActor, LeaseNextStepCode } from '@/types';
import { LEASE_OPERATION_PARAM, type LeaseOperationId } from '../operations/operation-ids';
import { REVIEW_STEP, SIGN_STEP, leaseEditPath } from '../wizard/wizard-model';
import type { LeaseTab } from './lease-sheet';
import { monthOfDate, rentRegisterPath } from './rent-register';

export function leaseSheetPath(leaseId: string, tab?: LeaseTab): string {
  const base = `/app/long-rent/leases/${encodeURIComponent(leaseId)}`;
  return tab ? `${base}?tab=${tab}` : base;
}

export function operationPath(leaseId: string, operation: LeaseOperationId): string {
  return `${leaseSheetPath(leaseId)}?${LEASE_OPERATION_PARAM}=${operation}`;
}

type StepTarget =
  | { kind: 'sheet'; tab?: LeaseTab }
  | { kind: 'operation'; operation: LeaseOperationId }
  | { kind: 'wizard'; step?: number; fromParams?: true }
  | { kind: 'rents' };

interface StepDefinition {
  titleKey: string;
  actionKey: string;
  detailKey?: string;
  target: StepTarget;
  imported?: { titleKey: string; actionKey: string; detailKey?: string };
}

// The keys are written out, one by one, so that the i18n test finds a missing translation (`*Key:` properties are scanned).
const STEPS: Record<LeaseNextStepCode, StepDefinition> = {
  ChooseProperty: {
    titleKey: 'leaseFlow.nextStep.ChooseProperty.title',
    actionKey: 'leaseFlow.nextStep.ChooseProperty.action',
    detailKey: 'leaseFlow.nextStep.ChooseProperty.detail',
    target: { kind: 'wizard', step: 1 },
  },
  CompleteStep: {
    titleKey: 'leaseFlow.nextStep.CompleteStep.title',
    actionKey: 'leaseFlow.nextStep.CompleteStep.action',
    detailKey: 'leaseFlow.nextStep.CompleteStep.detail',
    target: { kind: 'wizard', fromParams: true },
  },
  ImportSignedContract: {
    titleKey: 'leaseFlow.nextStep.ImportSignedContract.title',
    actionKey: 'leaseFlow.nextStep.ImportSignedContract.action',
    detailKey: 'leaseFlow.nextStep.ImportSignedContract.detail',
    target: { kind: 'wizard', step: SIGN_STEP },
  },
  AwaitPartnerContract: {
    titleKey: 'leaseFlow.nextStep.AwaitPartnerContract.title',
    actionKey: 'leaseFlow.nextStep.AwaitPartnerContract.action',
    detailKey: 'leaseFlow.nextStep.AwaitPartnerContract.detail',
    target: { kind: 'sheet' },
  },
  ConfirmReview: {
    titleKey: 'leaseFlow.nextStep.ConfirmReview.title',
    actionKey: 'leaseFlow.nextStep.ConfirmReview.action',
    detailKey: 'leaseFlow.nextStep.ConfirmReview.detail',
    target: { kind: 'wizard', step: REVIEW_STEP },
  },
  DownloadForSignature: {
    titleKey: 'leaseFlow.nextStep.DownloadForSignature.title',
    actionKey: 'leaseFlow.nextStep.DownloadForSignature.action',
    detailKey: 'leaseFlow.nextStep.DownloadForSignature.detail',
    target: { kind: 'wizard', step: SIGN_STEP },
  },
  UploadSignedCopy: {
    titleKey: 'leaseFlow.nextStep.UploadSignedCopy.title',
    actionKey: 'leaseFlow.nextStep.UploadSignedCopy.action',
    detailKey: 'leaseFlow.nextStep.UploadSignedCopy.detail',
    target: { kind: 'wizard', step: SIGN_STEP },
  },
  RegisterLease: {
    titleKey: 'leaseFlow.nextStep.RegisterLease.title',
    actionKey: 'leaseFlow.nextStep.RegisterLease.action',
    target: { kind: 'sheet', tab: 'scadenze' },
    imported: {
      titleKey: 'leaseRound.nextStep.RegisterImported.title',
      actionKey: 'leaseRound.nextStep.RegisterImported.action',
      detailKey: 'leaseRound.nextStep.RegisterImported.detail',
    },
  },
  RecordKeyHandover: {
    titleKey: 'leaseFlow.nextStep.RecordKeyHandover.title',
    actionKey: 'leaseFlow.nextStep.RecordKeyHandover.action',
    detailKey: 'leaseFlow.nextStep.RecordKeyHandover.detail',
    target: { kind: 'sheet', tab: 'scadenze' },
  },
  QuesturaCommunication: {
    titleKey: 'leaseFlow.nextStep.QuesturaCommunication.title',
    actionKey: 'leaseFlow.nextStep.QuesturaCommunication.action',
    detailKey: 'leaseFlow.nextStep.QuesturaCommunication.detail',
    target: { kind: 'sheet', tab: 'scadenze' },
  },
  SendRentReminder: {
    titleKey: 'leaseFlow.nextStep.SendRentReminder.title',
    actionKey: 'leaseFlow.nextStep.SendRentReminder.action',
    detailKey: 'leaseFlow.nextStep.SendRentReminder.detail',
    target: { kind: 'rents' },
  },
  ActivateRentPlan: {
    titleKey: 'leaseFlow.nextStep.ActivateRentPlan.title',
    actionKey: 'leaseFlow.nextStep.ActivateRentPlan.action',
    detailKey: 'leaseFlow.nextStep.ActivateRentPlan.detail',
    target: { kind: 'sheet', tab: 'pagamenti' },
  },
  DecideNotice: {
    titleKey: 'leaseFlow.nextStep.DecideNotice.title',
    actionKey: 'leaseFlow.nextStep.DecideNotice.action',
    detailKey: 'leaseFlow.nextStep.DecideNotice.detail',
    target: { kind: 'operation', operation: 'disdetta' },
  },
  OrganizeEnd: {
    titleKey: 'leaseFlow.nextStep.OrganizeEnd.title',
    actionKey: 'leaseFlow.nextStep.OrganizeEnd.action',
    detailKey: 'leaseFlow.nextStep.OrganizeEnd.detail',
    target: { kind: 'sheet', tab: 'dati' },
  },
  AllGood: {
    titleKey: 'leaseFlow.nextStep.AllGood.title',
    actionKey: 'leaseFlow.nextStep.AllGood.action',
    target: { kind: 'sheet' },
  },
  Archive: {
    titleKey: 'leaseFlow.nextStep.Archive.title',
    actionKey: 'leaseFlow.nextStep.Archive.action',
    target: { kind: 'sheet' },
  },
};

const UNKNOWN_STEP: StepDefinition = {
  titleKey: 'leaseFlow.nextStep.unknown.title',
  actionKey: 'leaseFlow.nextStep.unknown.action',
  target: { kind: 'sheet' },
};

function definitionOf(code: string): StepDefinition {
  return Object.hasOwn(STEPS, code) ? STEPS[code as LeaseNextStepCode] : UNKNOWN_STEP;
}

function numberParam(params: LeaseNextStep['params'], name: string): number | null {
  const value = params?.[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * The numbers the sentences of a step take from its `params` (counts, amounts and days; never a name). `detail` is `null` when the
 * server did not send what the line under the title needs: no line, rather than a wrong one.
 */
function sentenceValues(
  code: string,
  params: LeaseNextStep['params'],
): { title: Record<string, unknown>; detail: Record<string, unknown> | null } {
  switch (code) {
    case 'CompleteStep': {
      const step = numberParam(params, 'step');
      return { title: {}, detail: step === null ? null : { step } };
    }
    case 'SendRentReminder': {
      // The line under the title counts the days since the oldest installment was due, so its plural follows the days.
      const days = numberParam(params, 'days');
      return {
        title: { count: numberParam(params, 'count') ?? 1 },
        detail: days === null ? null : { count: days, amount: formatCurrency(numberParam(params, 'amount') ?? 0) },
      };
    }
    default:
      return { title: {}, detail: {} };
  }
}

const SHORT_DAY = { day: 'numeric', month: 'short' } as const;

function dueText(dueOn: string | null | undefined, today: string, language: string, t: TFunction): string | null {
  const day = parseStayDate(dueOn);
  if (!day) return null;
  if (day < today) return t('leaseFlow.due.overdue', { count: nightsBetween(day, today) });
  const ahead = nightsBetween(today, day);
  if (ahead === 0) return t('leaseFlow.due.today');
  if (ahead === 1) return t('leaseFlow.due.tomorrow');
  return t('leaseFlow.due.byIn', { count: ahead, date: formatStayDate(day, language, SHORT_DAY) });
}

function toneOf(priority: number): CalmTone {
  if (priority <= 0) return 'danger';
  if (priority <= 3) return 'warning';
  return 'neutral';
}

export interface LeaseStepContext {
  t: TFunction;
  language: string;
  today: string;
}

export interface LeaseStepView {
  title: string;
  detail: string | null;
  who: string;
  when: string | null;
  tone: CalmTone;
  action: string;
  to: string;
  leaseTo: string;
  leavesTheSheet: boolean;
}

const ACTORS: readonly LeaseNextStepActor[] = ['Landlord', 'Tenant', 'System'];

function actorText(actor: LeaseNextStepActor, t: TFunction): string {
  return ACTORS.includes(actor) ? t(`leaseFlow.actor.${actor}`) : '';
}

export function describeLeaseStep(leaseId: string, step: LeaseNextStep, { t, language, today }: LeaseStepContext): LeaseStepView {
  const definition = definitionOf(step.code);
  const words = step.params?.imported === true && definition.imported ? definition.imported : definition;
  const values = sentenceValues(step.code, step.params);
  const leaseTo = leaseSheetPath(leaseId);

  return {
    title: t(words.titleKey, values.title),
    detail: words.detailKey && values.detail ? t(words.detailKey, values.detail) : null,
    who: actorText(step.actor, t),
    when: dueText(step.dueOn, today, language, t),
    tone: toneOf(step.priority),
    action: t(words.actionKey),
    to: targetPath(leaseId, definition.target, step, today),
    leaseTo,
    leavesTheSheet: definition.target.kind === 'rents',
  };
}

function targetPath(leaseId: string, target: StepTarget, step: LeaseNextStep, today: string): string {
  switch (target.kind) {
    case 'rents': {
      const dueDay = parseStayDate(step.dueOn);
      const currentMonth = monthOfDate(today);
      return rentRegisterPath(dueDay ? monthOfDate(dueDay) : currentMonth, currentMonth, 'overdue');
    }
    case 'wizard':
      return leaseEditPath(leaseId, target.fromParams ? (numberParam(step.params, 'step') ?? undefined) : target.step);
    case 'sheet':
      return leaseSheetPath(leaseId, target.tab);
    case 'operation':
      return operationPath(leaseId, target.operation);
  }
}
