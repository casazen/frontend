import type {
  RoutineAction,
  RoutineActionCatalogItem,
  RoutineActionConfig,
  RoutineActionOutcome,
  RoutineActionType,
  RoutineCondition,
  RoutineConditionField,
  RoutineConditionOperator,
  RoutineConditionRule,
  RoutineEventConfig,
  RoutineEventType,
  RoutineExecutionActionResult,
  RoutineExecutionResult,
} from '@/types';

// What the editor of a routine, the library and the page know of the contract of the routines API (`RoutinesController`, `RoutineActionRules`, `RoutineConditions`): the
// events and actions it offers, the limits the server holds them to, the condition of ADR-014 as the API reads it and the log of an execution. Pure: nothing here asks the server.

// ─── Events ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The events the editor offers. Not `WeeklyRecurrence`: the API saves no routine on it (422 `routine_event_not_available`) because no job writes it yet, so offering it would be
 * offering a routine that can never be saved.
 */
export const EDITOR_EVENT_TYPES: readonly RoutineEventType[] = [
  'BookingNew',
  'BookingConfirmed',
  'BookingCanceled',
  'BeforeCheckin',
  'AfterCheckin',
  'BeforeCheckout',
  'AfterCheckout',
  'CheckinOccurred',
  'CheckoutOccurred',
  'IdVerificationCompleted',
  'GuestMessageReceived',
];

/** The events that are a time before or after a day of the stay: they take `{ days, hours }`, the others an empty configuration. */
export const TIME_EVENT_TYPES: readonly RoutineEventType[] = ['BeforeCheckin', 'AfterCheckin', 'BeforeCheckout', 'AfterCheckout'];

/** The most days (and hours) of a time event the server takes (`RoutineLimits.MaxEventConfigMember`). */
export const MAX_EVENT_OFFSET = 365;

/** The options of the event picker: the ones of the editor, and the event the routine already has when it is one more (a routine saved some other way). Never `WeeklyRecurrence`. */
export function eventOptionsFor(current?: RoutineEventType): RoutineEventType[] {
  const offered = [...EDITOR_EVENT_TYPES];
  return current && current !== 'WeeklyRecurrence' && !offered.includes(current) ? [...offered, current] : offered;
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** The key of the name of an event in the locale files (`routines.events.<name>`; they have one for every type of the API). */
export function eventLabelKey(type: RoutineEventType): string {
  return `routines.events.${lowerFirst(type)}`;
}

export function parseEventConfig(eventConfig: string | undefined): { days: number; hours: number } {
  try {
    const config = JSON.parse(eventConfig || '{}') as RoutineEventConfig | null;
    return { days: Number(config?.days) || 0, hours: Number(config?.hours) || 0 };
  } catch {
    return { days: 0, hours: 0 };
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────────────────────────────────

/** Every action of the API, in the order the editor lists them: all of them are listed, the ones that cannot run yet are disabled (`isActionUnavailable`). */
export const ACTION_TYPES: ReadonlyArray<{ type: RoutineActionType; labelKey: string }> = [
  { type: 'Wait', labelKey: 'routines.actionTypes.wait' },
  { type: 'MessageToGuest', labelKey: 'routines.actionTypes.messageToGuest' },
  { type: 'NotifyOwner', labelKey: 'routines.actionTypes.notifyOwner' },
  { type: 'NotifyStaff', labelKey: 'routines.actionTypes.notifyStaff' },
  { type: 'NotifyTeam', labelKey: 'routines.actionTypes.notifyTeam' },
  { type: 'CreateActivity', labelKey: 'routines.actionTypes.createActivity' },
  { type: 'CreateCleaningRequest', labelKey: 'routines.actionTypes.createCleaningRequest' },
  { type: 'SendAccessCode', labelKey: 'routines.actionTypes.sendAccessCode' },
  { type: 'RequestReview', labelKey: 'routines.actionTypes.requestReview' },
  { type: 'AddTag', labelKey: 'routines.actionTypes.addTag' },
];

/** The key of the name of an action, or `undefined` for a type this version does not know (shown as it comes). */
export function actionLabelKey(type: string): string | undefined {
  return ACTION_TYPES.find((action) => action.type === type)?.labelKey;
}

/** The most actions a routine has (`RoutineLimits.MaxActions`). */
export const MAX_ACTIONS = 10;

/** The longest text of a `CreateActivity` (`RoutineActionRules.MaxActivityTextLength`) and the furthest deadline (`MaxActivityDueInDays`). */
export const MAX_ACTIVITY_TEXT_LENGTH = 140;
export const MAX_ACTIVITY_DUE_IN_DAYS = 60;

/** The longest a `Wait` lasts, in days (`RoutineActionRules.MaxWaitDays`): days and hours together. */
export const MAX_WAIT_DAYS = 365;

/** What the catalog (`GET api/routines/actions`) says of each action: whether it can run today. Absent until the catalog is read. */
export type ActionAvailability = ReadonlyMap<RoutineActionType, boolean>;

export function toAvailability(catalog: readonly RoutineActionCatalogItem[] | undefined): ActionAvailability | undefined {
  return catalog ? new Map(catalog.map((item) => [item.type, item.available])) : undefined;
}

/**
 * Whether the catalog says the action cannot run. Only what it says: with no catalog (not read yet, or it could not be read) nothing is marked, and the server decides when the
 * routine is switched on (422 `routine_action_not_available`), so the page never claims more than it knows.
 */
export function isActionUnavailable(availability: ActionAvailability | undefined, type: RoutineActionType): boolean {
  return availability?.get(type) === false;
}

/** The actions of a list that the catalog says cannot run, each once, in the order of the list. */
export function unavailableActionTypes(availability: ActionAvailability | undefined, actions: ReadonlyArray<Pick<RoutineAction, 'type'>>): RoutineActionType[] {
  const found: RoutineActionType[] = [];
  for (const { type } of actions) {
    if (isActionUnavailable(availability, type) && !found.includes(type)) found.push(type);
  }
  return found;
}

export function parseActions(actionsJson: string | undefined): RoutineAction[] {
  try {
    const parsed: unknown = JSON.parse(actionsJson || '[]');
    return Array.isArray(parsed) ? (parsed as RoutineAction[]) : [];
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The key of a new line of a list of the editor: one more than the largest there is, so that it never equals the key of a line that is still there. */
export function nextKeyOf(items: ReadonlyArray<{ key: number }>): number {
  return items.reduce((largest, item) => Math.max(largest, item.key), 0) + 1;
}

/** A whole number written with digits only; `null` for anything else (a sign, a decimal, a letter, nothing). */
export function parseWhole(text: string): number | null {
  const trimmed = text.trim();
  return /^\d{1,9}$/.test(trimmed) ? Number(trimmed) : null;
}

/** An action in the editor: what the person typed for each member the editor knows, and the rest of the stored configuration, which it keeps as it is. */
export interface ActionDraft {
  /** The identity of the line in the list (the position changes when one is removed). */
  key: number;
  type: RoutineActionType | '';
  /** `Wait`: how long, as typed. */
  days: string;
  hours: string;
  /** `CreateActivity`: the words of the To do and its deadline in days (empty: none), as typed. */
  text: string;
  dueInDays: string;
  /** `MessageToGuest`: the template, as typed. */
  templateId: string;
  tag: string;
  aiCondition: string;
  /** The members of the stored configuration that the editor has no field for. */
  rest: RoutineActionConfig;
}

const EDITED_MEMBERS: Partial<Record<RoutineActionType, readonly string[]>> = {
  CreateCleaningRequest: ['aiCondition'],
  RequestReview: ['aiCondition'],
  Wait: ['days', 'hours'],
  CreateActivity: ['text', 'dueInDays'],
  MessageToGuest: ['templateId'],
  AddTag: ['tag'],
};

/** A new line of the list for `type`: a wait of one day, otherwise everything empty. */
export function newActionDraft(key: number, type: RoutineActionType | ''): ActionDraft {
  return { key, type, days: type === 'Wait' ? '1' : '0', hours: '0', text: '', dueInDays: '', templateId: '', tag: '', aiCondition: '', rest: {} };
}

const asText = (value: unknown) => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

/** The line of the list that shows a stored action. */
export function actionToDraft(key: number, action: RoutineAction): ActionDraft {
  const config = isRecord(action.config) ? action.config : {};
  const edited = EDITED_MEMBERS[action.type] ?? [];
  const rest = Object.fromEntries(Object.entries(config).filter(([name]) => !edited.includes(name)));
  return {
    key,
    type: action.type,
    days: asText(config.days) || '0',
    hours: asText(config.hours) || '0',
    text: asText(config.text),
    dueInDays: asText(config.dueInDays),
    templateId: asText(config.templateId),
    tag: asText(config.tag),
    aiCondition: asText(config.aiCondition),
    rest,
  };
}

/**
 * What is wrong with the configuration of a line, as the server would say it (`RoutineActionRules`), as the key of a text; `null` when it is valid. A wait lasts from an
 * hour to 365 days; the To do has words (1 to 140 characters) and a deadline of 0 to 60 days, or none.
 */
export function actionProblemKey(draft: ActionDraft): string | null {
  if (!draft.type) return 'routines.chooseAction';
  if (draft.type === 'Wait') {
    const days = parseWhole(draft.days || '0');
    const hours = parseWhole(draft.hours || '0');
    if (days === null || hours === null) return 'routines.problem.wait';
    const total = days * 24 + hours;
    return total >= 1 && total <= MAX_WAIT_DAYS * 24 ? null : 'routines.problem.wait';
  }
  if (draft.type === 'CreateActivity') {
    const text = draft.text.trim();
    if (text.length < 1 || text.length > MAX_ACTIVITY_TEXT_LENGTH) return 'routines.problem.activityText';
    if (draft.dueInDays.trim() !== '') {
      const due = parseWhole(draft.dueInDays);
      if (due === null || due > MAX_ACTIVITY_DUE_IN_DAYS) return 'routines.problem.activityDue';
    }
  }
  return null;
}

/** The action a valid line stands for, with the numbers as numbers (the server refuses a number written as a text). */
export function draftToAction(draft: ActionDraft): RoutineAction {
  switch (draft.type) {
    case '': throw new Error('Select a routine action before saving');
    case 'Wait':
      return { type: 'Wait', config: { ...draft.rest, days: parseWhole(draft.days || '0') ?? 0, hours: parseWhole(draft.hours || '0') ?? 0 } };
    case 'CreateActivity': {
      const due = draft.dueInDays.trim() === '' ? null : parseWhole(draft.dueInDays);
      return { type: 'CreateActivity', config: { ...draft.rest, text: draft.text.trim(), ...(due === null ? {} : { dueInDays: due }) } };
    }
    case 'CreateCleaningRequest':
    case 'RequestReview':
      return { type: draft.type, config: { ...draft.rest, ...(draft.aiCondition.trim() ? { aiCondition: draft.aiCondition.trim() } : {}) } };
    case 'AddTag':
      return { type: draft.type, config: { ...draft.rest, tag: draft.tag.trim() } };
    case 'MessageToGuest': {
      const templateId = draft.templateId.trim();
      return { type: 'MessageToGuest', config: { ...draft.rest, ...(templateId ? { templateId } : {}) } };
    }
    default:
      return { type: draft.type, config: { ...draft.rest } };
  }
}

// ─── The condition of a routine (ADR-014): the five fields a routine reads ───────────────────────────────────

/** The condition version the API reads (`Condition.Version`, a text). */
export const CONDITION_VERSION = '1.0';

export type ConditionFieldKind = 'properties' | 'channel' | 'count';

/**
 * The fields a routine condition can read: the facts of the booking an event is about (`RoutineConditions.SupportedFields`) with the operators each takes (`FieldCatalog`).
 * Any other field of the catalog (the payment, the check-in, the identity, the language…) has no value in a routine and is refused by the server, so the editor does not offer it.
 */
export const CONDITION_FIELDS: ReadonlyArray<{
  fieldId: RoutineConditionField;
  kind: ConditionFieldKind;
  labelKey: string;
  operators: readonly RoutineConditionOperator[];
}> = [
  { fieldId: 'channel', kind: 'channel', labelKey: 'routines.condition.fields.channel', operators: ['equals', 'notEquals', 'in', 'notIn'] },
  { fieldId: 'propertyId', kind: 'properties', labelKey: 'routines.condition.fields.propertyId', operators: ['in', 'notIn'] },
  { fieldId: 'stayDuration', kind: 'count', labelKey: 'routines.condition.fields.stayDuration', operators: ['equals', 'greaterThan', 'lessThan', 'between'] },
  { fieldId: 'guestCount', kind: 'count', labelKey: 'routines.condition.fields.guestCount', operators: ['equals', 'greaterThan', 'lessThan', 'between'] },
  { fieldId: 'bookingLeadTime', kind: 'count', labelKey: 'routines.condition.fields.bookingLeadTime', operators: ['equals', 'greaterThan', 'lessThan', 'between'] },
];

export const CONDITION_OPERATOR_KEYS: Record<RoutineConditionOperator, string> = {
  equals: 'routines.condition.operators.equals',
  notEquals: 'routines.condition.operators.notEquals',
  in: 'routines.condition.operators.in',
  notIn: 'routines.condition.operators.notIn',
  greaterThan: 'routines.condition.operators.greaterThan',
  lessThan: 'routines.condition.operators.lessThan',
  between: 'routines.condition.operators.between',
};

/** The channels of a booking (`BookingSource`, by the name the API uses), with the words the app already has for them. */
export const CONDITION_CHANNELS: ReadonlyArray<{ name: string; labelKey: string }> = [
  { name: 'Direct', labelKey: 'crm.channels.Direct' },
  { name: 'Manual', labelKey: 'crm.channels.Manual' },
  { name: 'Airbnb', labelKey: 'crm.channels.Airbnb' },
  { name: 'BookingCom', labelKey: 'crm.channels.BookingCom' },
  { name: 'Expedia', labelKey: 'crm.channels.Expedia' },
  { name: 'Vrbo', labelKey: 'crm.channels.Vrbo' },
  { name: 'TripAdvisor', labelKey: 'crm.channels.TripAdvisor' },
  { name: 'Agoda', labelKey: 'crm.channels.Agoda' },
  { name: 'OtherChannel', labelKey: 'crm.channels.OtherChannel' },
  { name: 'Local', labelKey: 'crm.channels.Local' },
];

const isChannelName = (name: unknown): name is string => typeof name === 'string' && CONDITION_CHANNELS.some((channel) => channel.name === name);

export function conditionFieldOf(fieldId: RoutineConditionField) {
  return CONDITION_FIELDS.find((field) => field.fieldId === fieldId) ?? CONDITION_FIELDS[0];
}

/** One rule in the editor: the field, the operator and what the person chose or typed for the value, whichever shape the operator takes. */
export interface RuleDraft {
  key: number;
  fieldId: RoutineConditionField;
  operator: RoutineConditionOperator;
  /** `in` and `notIn` (the ids of properties, the names of channels): the choices. */
  list: string[];
  /** `equals` and `notEquals` of a channel, the number of `equals`, `greaterThan` and `lessThan`, as typed. */
  single: string;
  /** `between`: the two numbers as typed. */
  low: string;
  high: string;
}

/** A new rule: the channel is one of a list. */
export function newRuleDraft(key: number): RuleDraft {
  return { key, fieldId: 'channel', operator: 'in', list: [], single: '', low: '', high: '' };
}

/** The rule on another field: its first operator and nothing chosen (what was chosen for another field means nothing here). */
export function withField(rule: RuleDraft, fieldId: RoutineConditionField): RuleDraft {
  const field = conditionFieldOf(fieldId);
  return { ...rule, fieldId: field.fieldId, operator: field.operators[0], list: [], single: '', low: '', high: '' };
}

/** Whether a rule takes a list of choices (`in`, `notIn`), two numbers (`between`) or one value. */
export function ruleShape(rule: Pick<RuleDraft, 'operator'>): 'list' | 'range' | 'single' {
  if (rule.operator === 'in' || rule.operator === 'notIn') return 'list';
  return rule.operator === 'between' ? 'range' : 'single';
}

/**
 * The rule as the API takes it, or `null` while the value is not the kind its operator accepts (`RoutineConditions.ValueErrors`): a non-empty list of properties; the name of a
 * channel or a non-empty list of them; a whole number for `equals` on a count, a number for `greaterThan` and `lessThan`, two numbers with the lower first for `between`.
 * What the server would refuse is never sent.
 */
export function ruleToCondition(rule: RuleDraft): RoutineConditionRule | null {
  const field = conditionFieldOf(rule.fieldId);
  if (!field.operators.includes(rule.operator)) return null;
  const shape = ruleShape(rule);

  if (field.kind === 'properties') {
    return rule.list.length > 0 && rule.list.every((id) => id.trim() !== '') ? { fieldId: field.fieldId, operator: rule.operator, value: [...rule.list] } : null;
  }

  if (field.kind === 'channel') {
    if (shape === 'list') {
      return rule.list.length > 0 && rule.list.every(isChannelName) ? { fieldId: field.fieldId, operator: rule.operator, value: [...rule.list] } : null;
    }
    return isChannelName(rule.single) ? { fieldId: field.fieldId, operator: rule.operator, value: rule.single } : null;
  }

  if (shape === 'range') {
    const low = parseWhole(rule.low);
    const high = parseWhole(rule.high);
    return low !== null && high !== null && low <= high ? { fieldId: field.fieldId, operator: 'between', value: [low, high] } : null;
  }
  const number = parseWhole(rule.single);
  return number === null ? null : { fieldId: field.fieldId, operator: rule.operator, value: number };
}

/** The condition of a group of rules, or `null` for none (the API reads an empty object as "no condition"). A rule that is not complete makes it `undefined`: the form is not valid. */
export function conditionFromRules(operator: 'AND' | 'OR', rules: readonly RuleDraft[]): RoutineCondition | null | undefined {
  if (rules.length === 0) return null;
  const built = rules.map(ruleToCondition);
  if (built.some((rule) => rule === null)) return undefined;
  return { version: CONDITION_VERSION, groups: [{ operator, rules: built as RoutineConditionRule[] }] };
}

/** The rule a stored one is, or `null` when it is not one the editor can show whole (another field, an operator the field does not take, a value of another kind). */
function ruleFromCondition(key: number, stored: unknown): RuleDraft | null {
  if (!isRecord(stored)) return null;
  const field = CONDITION_FIELDS.find((candidate) => candidate.fieldId === stored.fieldId);
  const operator = field?.operators.find((candidate) => candidate === stored.operator);
  if (!field || !operator) return null;
  const draft: RuleDraft = { ...newRuleDraft(key), fieldId: field.fieldId, operator };
  const value = stored.value;

  if (field.kind === 'properties') {
    return Array.isArray(value) && value.length > 0 && value.every((id) => typeof id === 'string' && id !== '') ? { ...draft, list: value as string[] } : null;
  }
  if (field.kind === 'channel') {
    if (ruleShape(draft) === 'list') {
      return Array.isArray(value) && value.length > 0 && value.every(isChannelName) ? { ...draft, list: value as string[] } : null;
    }
    return isChannelName(value) ? { ...draft, single: value } : null;
  }
  const whole = (item: unknown) => (typeof item === 'number' && Number.isInteger(item) && item >= 0 ? String(item) : null);
  if (ruleShape(draft) === 'range') {
    const low = Array.isArray(value) && value.length === 2 ? whole(value[0]) : null;
    const high = Array.isArray(value) && value.length === 2 ? whole(value[1]) : null;
    return low !== null && high !== null ? { ...draft, low, high } : null;
  }
  const single = whole(value);
  return single === null ? null : { ...draft, single };
}

/** What the editor makes of the condition a routine has. */
export type ConditionRead =
  | { kind: 'rules'; operator: 'AND' | 'OR'; rules: RuleDraft[] }
  /** A condition the editor cannot show whole (several groups, a field a routine does not read, a value of another kind): it is left as it is, never rewritten. */
  | { kind: 'unsupported' };

/** Reads the `conditionJson` of a routine: blank, `{}` and a condition with no group are "always"; one group of rules on the five fields is shown; anything else is kept as it is. */
export function readCondition(conditionJson: string | undefined): ConditionRead {
  const none: ConditionRead = { kind: 'rules', operator: 'AND', rules: [] };
  if (!conditionJson || conditionJson.trim() === '') return none;

  let parsed: unknown;
  try {
    parsed = JSON.parse(conditionJson);
  } catch {
    return { kind: 'unsupported' };
  }
  if (parsed === null) return none;
  if (!isRecord(parsed)) return { kind: 'unsupported' };
  const members = Object.keys(parsed);
  if (members.length === 0) return none;
  if (members.some((name) => name !== 'version' && name !== 'groups') || !Array.isArray(parsed.groups)) return { kind: 'unsupported' };
  if (parsed.groups.length === 0) return none;
  if (parsed.groups.length > 1) return { kind: 'unsupported' };

  const group: unknown = parsed.groups[0];
  if (!isRecord(group) || (group.operator !== 'AND' && group.operator !== 'OR') || !Array.isArray(group.rules)) return { kind: 'unsupported' };
  if (Object.keys(group).some((name) => name !== 'operator' && name !== 'rules')) return { kind: 'unsupported' };
  const rules = group.rules.map((rule, index) => ruleFromCondition(index + 1, rule));
  if (rules.some((rule) => rule === null)) return { kind: 'unsupported' };
  return { kind: 'rules', operator: group.operator, rules: rules as RuleDraft[] };
}

// ─── The log of a routine ───────────────────────────────────────────────────────────────────────────────

const ACTION_OUTCOMES: readonly RoutineActionOutcome[] = ['done', 'simulated', 'blocked', 'skipped', 'failed', 'waiting'];

/** The words of how an action of an execution ended. `simulated` is told as what it is: nothing ran, and `skipped` as an action that had nothing to do (the reason follows). */
export const ACTION_OUTCOME_KEYS: Record<RoutineActionOutcome, string> = {
  done: 'routines.log.action.done',
  simulated: 'routines.log.action.simulated',
  blocked: 'routines.log.action.blocked',
  skipped: 'routines.log.action.skipped',
  failed: 'routines.log.action.failed',
  waiting: 'routines.log.action.waiting',
};

export type ExecutionTone = 'success' | 'neutral' | 'danger';

/** The words of how an execution ended (`RoutineExecutionOutcomes`) and the look of its badge: only `Failed` is red, what is not finished is not a failure. */
export const EXECUTION_OUTCOMES: ReadonlyArray<{ outcome: string; labelKey: string; tone: ExecutionTone }> = [
  { outcome: 'Success', labelKey: 'routines.log.outcome.success', tone: 'success' },
  { outcome: 'Failed', labelKey: 'routines.log.outcome.failed', tone: 'danger' },
  { outcome: 'Waiting', labelKey: 'routines.log.outcome.waiting', tone: 'neutral' },
  { outcome: 'Running', labelKey: 'routines.log.outcome.running', tone: 'neutral' },
  { outcome: 'Pending', labelKey: 'routines.log.outcome.pending', tone: 'neutral' },
];

/**
 * The headline of an execution in the log: how it ended and the look of its badge. The server calls an execution `Success` when every action ended done, simulated or blocked, so the
 * word alone says too much: «Completata», in green, is for a run in which at least one action was really done. A run whose actions were only simulated (a routine in test mode), only
 * blocked (a guardrail, a stay that did not happen) or only skipped (an action that had nothing to do for the stay: a booking of a portal, a guest with no address…) did nothing for real, and says
 * so in neutral: «Simulata» (a simulation that has a blocked action in it is still a simulation), «Bloccata» or «Nulla da fare». Every other outcome keeps its own words and tone, and one this
 * version does not know is said as unknown.
 */
export function executionHeadline(outcome: string, actions: ReadonlyArray<Pick<RoutineExecutionActionResult, 'outcome'>>): { labelKey: string; tone: ExecutionTone } {
  const known = EXECUTION_OUTCOMES.find((candidate) => candidate.outcome === outcome);
  if (!known) return { labelKey: 'routines.log.outcome.unknown', tone: 'neutral' };
  if (outcome === 'Success' && !actions.some((action) => action.outcome === 'done')) {
    const nothingForReal = actions.some((action) => action.outcome === 'simulated')
      ? 'routines.log.outcome.simulated'
      : actions.some((action) => action.outcome === 'blocked')
        ? 'routines.log.outcome.blocked'
        : actions.some((action) => action.outcome === 'skipped')
          ? 'routines.log.outcome.skipped'
          : known.labelKey;
    return { labelKey: nothingForReal, tone: 'neutral' };
  }
  return { labelKey: known.labelKey, tone: known.tone };
}

/** The stable codes an execution or one of its actions carries (`RoutineCodes`) and the sentence that tells each. A code that is not here is not shown: never a raw code. */
const EXECUTION_CODES: ReadonlyArray<{ code: string; labelKey: string }> = [
  { code: 'routine_condition_invalid', labelKey: 'routines.log.code.conditionInvalid' },
  { code: 'routine_action_not_available', labelKey: 'routines.log.code.actionNotAvailable' },
  { code: 'routine_actions_invalid', labelKey: 'routines.log.code.actionsInvalid' },
  { code: 'routine_inactive', labelKey: 'routines.log.code.inactive' },
  { code: 'routine_ai_condition_unknown', labelKey: 'routines.aiUnknown' },
  { code: 'routine_access_code_unavailable', labelKey: 'routines.log.code.accessCodeUnavailable' },
  { code: 'routine_crm_profile_missing', labelKey: 'routines.log.code.crmProfileMissing' },
  { code: 'routine_message_unconfirmed', labelKey: 'routines.log.code.messageUnconfirmed' },
  { code: 'routine_email_queue_failed', labelKey: 'routines.log.code.emailQueueFailed' },
  { code: 'message_template_not_found', labelKey: 'routines.log.code.messageTemplateMissing' },
  { code: 'no_conversation', labelKey: 'routines.log.code.noConversation' },
  { code: 'contact_info_unavailable', labelKey: 'routines.log.code.routineContactMissing' },
  { code: 'routine_ai_condition_false', labelKey: 'routines.aiFalse' },
  { code: 'routine_ai_unavailable', labelKey: 'routines.aiUnavailable' },
  { code: 'routine_action_error', labelKey: 'routines.log.code.actionError' },
  { code: 'routine_wait_not_scheduled', labelKey: 'routines.log.code.waitNotScheduled' },
  { code: 'routine_activity_needs_booking', labelKey: 'routines.log.code.activityNeedsBooking' },
  { code: 'routine_cleaning_needs_booking', labelKey: 'routines.log.code.cleaningNeedsBooking' },
  { code: 'routine_cleaning_not_configured', labelKey: 'routines.log.code.cleaningNotConfigured' },
  { code: 'cleaning_staff_unavailable', labelKey: 'routines.log.code.cleaningStaffUnavailable' },
  { code: 'cleaning_setup_invalid', labelKey: 'routines.log.code.cleaningSetupInvalid' },
  { code: 'cleaning_supplier_currency_unsupported', labelKey: 'routines.log.code.cleaningSupplierCurrency' },
  { code: 'routine_review_needs_booking', labelKey: 'routines.log.code.reviewNeedsBooking' },
  { code: 'review_invite_not_sent', labelKey: 'routines.log.code.reviewInviteNotSent' },
  // Why an action skipped a booking (`ReviewInviteSkipReasons`, E26/F01/US01/T01): nothing was asked of the guest.
  { code: 'not_direct', labelKey: 'routines.log.code.notDirect' },
  { code: 'not_confirmed', labelKey: 'routines.log.code.notConfirmed' },
  { code: 'no_show', labelKey: 'routines.log.code.noShow' },
  { code: 'too_early', labelKey: 'routines.log.code.tooEarly' },
  { code: 'too_late', labelKey: 'routines.log.code.tooLate' },
  { code: 'no_email', labelKey: 'routines.log.code.noEmail' },
  { code: 'already_reviewed', labelKey: 'routines.log.code.alreadyReviewed' },
  { code: 'already_invited', labelKey: 'routines.log.code.alreadyInvited' },
  { code: 'routine_booking_not_active', labelKey: 'routines.log.code.bookingNotActive' },
  { code: 'access_code_needs_id_verification', labelKey: 'routines.log.code.accessCodeNeedsIdVerification' },
  { code: 'airbnb_not_confirmed', labelKey: 'routines.log.code.airbnbNotConfirmed' },
  { code: 'campaign_needs_consent', labelKey: 'routines.log.code.campaignNeedsConsent' },
];

export function executionCodeKey(code: string | undefined): string | undefined {
  return EXECUTION_CODES.find((known) => known.code === code)?.labelKey;
}

/**
 * The sentence that tells why an action of an execution ended as it did: the one of its code when this version knows the code. A cleaning that could not be made for a reason that is not listed
 * (the rules of a request to a supplier: a supplier that is suspended, one that does not cover the comune…) says what always happens then: nothing was created, and the stay is left with the item «Pulizia
 * da richiedere» in the list of what is to do. Never a raw code.
 */
export function actionReasonKey(action: Pick<RoutineExecutionActionResult, 'type' | 'outcome' | 'code'>): string | undefined {
  const known = executionCodeKey(action.code);
  if (known) return known;
  return action.type === 'CreateCleaningRequest' && action.outcome === 'failed' ? 'routines.log.code.cleaningFailed' : undefined;
}

const TIME_ZONE_DESIGNATOR = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

/** The instants of the API are UTC: a time written without a zone is UTC too, and never the clock of the browser. */
export function utcInstant(value: string): string {
  return value.includes('T') && !TIME_ZONE_DESIGNATOR.test(value) ? `${value}Z` : value;
}

/** Reads the `resultJson` of an execution: what each action did and the code of the whole. Never throws: what is not a result is an empty one. */
export function parseExecutionResult(resultJson: string | undefined): RoutineExecutionResult {
  const empty: RoutineExecutionResult = { actions: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(resultJson || '{}');
  } catch {
    return empty;
  }
  if (!isRecord(parsed)) return empty;

  const actions: RoutineExecutionActionResult[] = [];
  for (const item of Array.isArray(parsed.actions) ? (parsed.actions as unknown[]) : []) {
    if (!isRecord(item) || typeof item.index !== 'number' || typeof item.type !== 'string') continue;
    const outcome = ACTION_OUTCOMES.find((known) => known === item.outcome);
    if (!outcome) continue;
    actions.push({
      index: item.index,
      type: item.type as RoutineActionType,
      outcome,
      ...(typeof item.code === 'string' ? { code: item.code } : {}),
    });
  }
  return { actions, ...(typeof parsed.code === 'string' ? { code: parsed.code } : {}) };
}
