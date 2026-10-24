import type { TFunction } from 'i18next';
import type { CalmTone } from '@/components/shared/calm';
import { formatStayDate, nightsBetween, parseStayDate } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { LeaseNextStep, LeaseNextStepActor, LeaseNextStepCode } from '@/types';
import { REVIEW_STEP, SIGN_STEP, leaseEditPath } from '../wizard/wizard-model';
import type { LeaseTab } from './lease-sheet';
import { monthOfDate, rentRegisterPath } from './rent-register';

/**
 * What a lease is waiting for, in words and with the button that does it (LR-05). The server decides which step it is (`nextStep`
 * of `GET /leases` and `now` of `GET /long-rent/overview`, LR-01b) and sends a stable code; the sentence, the button and the page
 * where it is done are the interface's, here, once. Nothing about the step is worked out from the other fields of the lease.
 *
 * The overview uses it for its block «Adesso»; the sheet of a lease («Cosa devi fare ora») and the list of leases read the same
 * table. A code this version of the app does not know (a newer backend) gets a neutral sentence and the sheet of the lease.
 */

/** The sheet of a lease, on one of its tabs when the step is done there (the names of the tabs never change). */
export function leaseSheetPath(leaseId: string, tab?: LeaseTab): string {
  const base = `/app/long-rent/leases/${encodeURIComponent(leaseId)}`;
  return tab ? `${base}?tab=${tab}` : base;
}

/**
 * Where a step is done: a tab of the sheet of the lease (or the sheet as it opens), the wizard that goes on with a draft («Continua il
 * contratto», LR-06a) at a step of the server's numbering (`fromParams`: the step the server names in `params.step`; none: where the
 * draft opens), or the rent register for the rents that are late.
 */
type StepTarget =
  | { kind: 'sheet'; tab?: LeaseTab }
  | { kind: 'wizard'; step?: number; fromParams?: true }
  | { kind: 'rents' };

interface StepDefinition {
  titleKey: string;
  actionKey: string;
  /** A line more, when the step has something to add. */
  detailKey?: string;
  target: StepTarget;
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
    target: { kind: 'sheet', tab: 'dati' },
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

/** What a code the app does not know says: the lease has something to do, and its sheet says what. */
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

/** When the step is due, in the words of the person: «Scaduto da 3 giorni», «Entro domani», «Entro il 5 nov · tra 12 giorni»; `null` without a day. */
function dueText(dueOn: string | null | undefined, today: string, language: string, t: TFunction): string | null {
  const day = parseStayDate(dueOn);
  if (!day) return null;
  if (day < today) return t('leaseFlow.due.overdue', { count: nightsBetween(day, today) });
  const ahead = nightsBetween(today, day);
  if (ahead === 0) return t('leaseFlow.due.today');
  if (ahead === 1) return t('leaseFlow.due.tomorrow');
  return t('leaseFlow.due.byIn', { count: ahead, date: formatStayDate(day, language, SHORT_DAY) });
}

/** Only what is late is red, what is soon or being chased is amber; the rest is the accent of the area. The priorities are the server's. */
function toneOf(priority: number): CalmTone {
  if (priority <= 0) return 'danger';
  if (priority <= 3) return 'warning';
  return 'neutral';
}

export interface LeaseStepContext {
  t: TFunction;
  language: string;
  /** Today in Europe/Rome (`YYYY-MM-DD`): `todayInRome()`. */
  today: string;
}

/** A step as a screen shows it. */
export interface LeaseStepView {
  /** What to do, as a short sentence. */
  title: string;
  /** A line more, when the step has one. */
  detail: string | null;
  /** Whose turn it is («Tocca a te», «Se ne occupa CasaZen»). */
  who: string;
  /** When it is due; `null` when it has no day. */
  when: string | null;
  tone: CalmTone;
  /** The label of the button that does it. */
  action: string;
  /** Where the button goes: the tab of the sheet or the step of the wizard where it is done, or the rent register. */
  to: string;
  /** The sheet of the lease, for a screen that has a button for the step and one for the lease (the rent register is not the sheet). */
  leaseTo: string;
  /** The step is done on the rent register, away from the lease: a screen that has a button for it can offer the lease beside it. */
  leavesTheSheet: boolean;
}

const ACTORS: readonly LeaseNextStepActor[] = ['Landlord', 'Tenant', 'System'];

/** Whose turn it is: «Tocca a te» for the landlord, «Se ne occupa CasaZen» for the system; nothing for an actor this version does not know. */
function actorText(actor: LeaseNextStepActor, t: TFunction): string {
  return ACTORS.includes(actor) ? t(`leaseFlow.actor.${actor}`) : '';
}

/** The sentence, the button and the destination of the step `step` of the lease `leaseId`. */
export function describeLeaseStep(leaseId: string, step: LeaseNextStep, { t, language, today }: LeaseStepContext): LeaseStepView {
  const definition = definitionOf(step.code);
  const values = sentenceValues(step.code, step.params);
  const leaseTo = leaseSheetPath(leaseId);

  return {
    title: t(definition.titleKey, values.title),
    detail: definition.detailKey && values.detail ? t(definition.detailKey, values.detail) : null,
    who: actorText(step.actor, t),
    when: dueText(step.dueOn, today, language, t),
    tone: toneOf(step.priority),
    action: t(definition.actionKey),
    to: targetPath(leaseId, definition.target, step, today),
    leaseTo,
    leavesTheSheet: definition.target.kind === 'rents',
  };
}

/** The address where the step is done. */
function targetPath(leaseId: string, target: StepTarget, step: LeaseNextStep, today: string): string {
  switch (target.kind) {
    case 'rents': {
      // The oldest installment that is late is in its own month: that is the register to open, with the late ones first.
      const dueDay = parseStayDate(step.dueOn);
      const currentMonth = monthOfDate(today);
      return rentRegisterPath(dueDay ? monthOfDate(dueDay) : currentMonth, currentMonth, 'overdue');
    }
    case 'wizard':
      // A step the wizard has no screen for opens the draft where it opens by itself.
      return leaseEditPath(leaseId, target.fromParams ? (numberParam(step.params, 'step') ?? undefined) : target.step);
    case 'sheet':
      return leaseSheetPath(leaseId, target.tab);
  }
}
