import type { LeaseContractType } from '@/types';
import type { LeaseTab } from '../lib/lease-sheet';
import type { LeaseAction } from '../lifecycle/lifecycle-actions';
import type { LeaseOperationId } from '../operations/operation-ids';
import type { GuideFacts, GuidePhase } from './guide-facts';

/**
 * The catalogue of the advice of the guide of a lease (LR-GUIDE-1): everything CasaZen knows about what a landlord should do, check or
 * ask the accountant, one entry for each thing, written as data. Whoever updates a rule touches this file and the texts of the entry
 * (`leaseGuide.advice.<id>` in `it.json` and `en.json`) and nothing else; how an entry is chosen and shown is `select-advice.ts` and
 * `lease-guide.tsx`. `docs/technical/lease-guide.md` says how to add one.
 *
 * What goes in an entry:
 * - `types`, `phases` and `when`: for which contracts (libero 4+4, concordato 3+2, transitorio), at which moment of their life
 *   (`GuidePhase`) and with which data (`GuideFacts`) the advice is given. `when` reads only the facts, never the network.
 * - `priority`: the lower, the earlier. A number, or a function of the facts when a deadline makes the advice more urgent. The late
 *   registration (4) and an over-limit deposit (9) come before everything; the know-how of the phase is between 40 and 60.
 * - `coveredBy`: the codes of the step of «Cosa devi fare ora» that already say it; then the guide keeps quiet.
 * - `needsRules`: the text has a figure that comes from the rules of the server (`{{registrationDays}}`…); no figure of law is written in
 *   the interface (LR-D29), so the advice waits until the rules arrive.
 * - `action`: the one gesture: a tab of the sheet, a window of the sheet (`?azione=`), the window of an operation that prepares a letter
 *   (`?operazione=`, LR-OPS-1), a tool, an official page, or the receipt of the registration to download. Only the follow-up of a registered canone concordato (`render: 'benefits'`) has its own buttons inside.
 * - `sources`: where the rule is read, shown under «Perché?». Only pages and laws the project already cites.
 *
 * The texts are `leaseGuide.advice.<id>.{title, body, why, action}`, in both languages, with only the placeholders of `guideValues`.
 */

export type GuideTool = 'regime' | 'rent' | 'attestation' | 'imu';

export type AdviceAction =
  | { kind: 'tab'; tab: LeaseTab }
  | { kind: 'lifecycle'; action: LeaseAction }
  | { kind: 'operation'; operation: LeaseOperationId }
  | { kind: 'tool'; tool: GuideTool }
  | { kind: 'official'; source: SourceId }
  | { kind: 'receipt' };

export type SourceId =
  | 'adeCedolare'
  | 'adeCedolareScheda'
  | 'adeQuantoSiPaga'
  | 'adeAtti'
  | 'adeAnnualita'
  | 'poliziaExtraUe'
  | 'dm2017'
  | 'law431'
  | 'law392';

/** A source: the label (`leaseGuide.source.<id>`) and, when the project cites an official page for it, its address. */
export interface AdviceSource {
  id: SourceId;
  url?: string;
}

/** Official pages and laws the rules of the area are read from (`.claude/context/regulations`, backend). A law has no address: it is named. */
export const SOURCES: Readonly<Record<SourceId, AdviceSource>> = {
  adeCedolare: { id: 'adeCedolare', url: 'https://www.agenziaentrate.gov.it/portale/aree-tematiche/casa/affitto/cedolare-secca' },
  adeCedolareScheda: {
    id: 'adeCedolareScheda',
    url: 'https://www.agenziaentrate.gov.it/portale/schede/fabbricatiterreni/cedolare-secca/scheda-informativa-cedolare-secca',
  },
  adeQuantoSiPaga: {
    id: 'adeQuantoSiPaga',
    url: 'https://www.agenziaentrate.gov.it/portale/schede/fabbricatiterreni/registrazione-di-un-nuovo-contratto/quanto-si-paga-regime-ordinario',
  },
  adeAtti: { id: 'adeAtti', url: 'https://www.agenziaentrate.gov.it/portale/atti-e-contratti-di-locazione' },
  adeAnnualita: {
    id: 'adeAnnualita',
    url: 'https://www.agenziaentrate.gov.it/portale/schede/fabbricatiterreni/adempimenti-successivi/versamento-annualita-successiva',
  },
  poliziaExtraUe: { id: 'poliziaExtraUe', url: 'https://www.poliziadistato.it/articolo/125a93e344e6c73863395263' },
  dm2017: { id: 'dm2017', url: 'https://www.gazzettaufficiale.it/eli/id/2017/03/15/17A01858/sg' },
  law431: { id: 'law431' },
  law392: { id: 'law392' },
};

export interface AdviceEntry {
  /** Stable forever (a link, a test or an analysis may point at it); also the name of its block of texts. */
  id: string;
  types: readonly LeaseContractType[];
  phases: readonly GuidePhase[];
  when?: (facts: GuideFacts) => boolean;
  priority: number | ((facts: GuideFacts) => number);
  coveredBy?: readonly string[];
  needsRules?: boolean;
  action?: AdviceAction;
  sources: readonly SourceId[];
  render?: 'benefits';
}

const ALL: readonly LeaseContractType[] = ['Libero', 'Concordato', 'Transitorio'];
const LIBERO_CONCORDATO: readonly LeaseContractType[] = ['Libero', 'Concordato'];

const BEFORE_REGISTRATION: readonly GuidePhase[] = ['draft', 'signing', 'toRegister'];
const PREPARING: readonly GuidePhase[] = ['draft', 'signing'];
const IN_FORCE: readonly GuidePhase[] = ['active', 'expiring'];
const ENDING: readonly GuidePhase[] = ['expiring', 'concluded'];
const OPEN: readonly GuidePhase[] = ['draft', 'signing', 'toRegister', 'active', 'expiring'];

/** A registration this recent is still to be told to the tenant; an older one is not worth saying again. */
const RECENT_REGISTRATION_DAYS = 90;

/** The lease is over or is going to be: by a notice, by an early end, because the transitory one ends by itself, or because it is over. */
const isEnding = (facts: GuideFacts) => facts.type === 'Transitorio' || facts.noticeRecorded || facts.terminated || facts.phase === 'concluded';

/** A priority that depends on the phase: `byPhase({ expiring: 20 }, 70)` is 20 when the lease is running out and 70 otherwise. */
const byPhase = (priorities: Partial<Record<GuidePhase, number>>, otherwise: number) => (facts: GuideFacts) => priorities[facts.phase] ?? otherwise;

const tab = (name: LeaseTab): AdviceAction => ({ kind: 'tab', tab: name });
const tool = (name: GuideTool): AdviceAction => ({ kind: 'tool', tool: name });
const lifecycle = (action: LeaseAction): AdviceAction => ({ kind: 'lifecycle', action });
const operation = (id: LeaseOperationId): AdviceAction => ({ kind: 'operation', operation: id });
const official = (source: SourceId): AdviceAction => ({ kind: 'official', source });

export const ADVICE_CATALOGUE: readonly AdviceEntry[] = [
  // ---- the moment the follow-up of a registered canone concordato is to be claimed -------------------------------------------------------
  {
    // The block of «Contratto registrato: ora fai valere le agevolazioni» (CF-END), the one place that says it: it has its own texts.
    id: 'concordatoBenefits',
    types: ['Concordato'],
    phases: IN_FORCE,
    when: (f) => f.registered,
    priority: 2,
    sources: [],
    render: 'benefits',
  },

  // ---- registration: the deadline and what it costs ---------------------------------------------------------------------------------------
  {
    id: 'lateRegistration',
    types: ALL,
    phases: ['toRegister'],
    when: (f) => !f.viaService && f.daysToRegistration !== null && f.daysToRegistration < 0,
    priority: 4,
    action: tab('scadenze'),
    sources: ['adeAtti', 'adeQuantoSiPaga'],
  },
  {
    id: 'startPassed',
    types: ALL,
    phases: PREPARING,
    when: (f) => f.startPassed && !f.partnerDraft,
    priority: 12,
    needsRules: true,
    action: tab('scadenze'),
    sources: ['adeAtti'],
  },
  {
    id: 'registerPrepare',
    types: ALL,
    phases: PREPARING,
    when: (f) => !f.startPassed && !f.shortTransitory && !f.partnerDraft,
    priority: 46,
    needsRules: true,
    action: tab('scadenze'),
    sources: ['adeAtti'],
  },
  {
    id: 'registrationCosts',
    types: LIBERO_CONCORDATO,
    phases: BEFORE_REGISTRATION,
    when: (f) => f.taxRegime === 'Ordinario' && !f.partnerDraft,
    priority: 34,
    action: tool('regime'),
    sources: ['adeQuantoSiPaga'],
  },
  {
    id: 'transitorioCosts',
    types: ['Transitorio'],
    phases: BEFORE_REGISTRATION,
    when: (f) => f.taxRegime === 'Ordinario' && !f.partnerDraft,
    priority: 34,
    action: tool('regime'),
    sources: ['dm2017', 'adeQuantoSiPaga'],
  },
  {
    id: 'registrationComm',
    types: ALL,
    phases: ['active'],
    when: (f) => f.registered && (f.daysSinceRegistration === null || f.daysSinceRegistration <= RECENT_REGISTRATION_DAYS),
    priority: 48,
    action: tab('scadenze'),
    sources: [],
  },
  {
    id: 'registrationReceipt',
    types: ['Libero', 'Transitorio'],
    phases: [...IN_FORCE, 'concluded'],
    when: (f) => f.registered && f.hasReceipt,
    priority: 68,
    action: { kind: 'receipt' },
    sources: [],
  },

  // ---- the tax regime: cedolare secca or ordinary --------------------------------------------------------------------------------------
  {
    id: 'regimeChoose',
    types: ALL,
    phases: BEFORE_REGISTRATION,
    when: (f) => f.taxRegime === null && !f.partnerDraft,
    priority: 26,
    action: tool('regime'),
    sources: ['adeCedolare', 'adeQuantoSiPaga'],
  },
  {
    id: 'regimeCheckCedolare',
    types: ALL,
    phases: BEFORE_REGISTRATION,
    when: (f) => f.taxRegime === 'CedolareSecca' && !f.partnerDraft,
    priority: 30,
    action: tool('regime'),
    sources: ['adeCedolare', 'adeQuantoSiPaga'],
  },
  {
    id: 'regimeCheckOrdinary',
    types: ALL,
    phases: BEFORE_REGISTRATION,
    when: (f) => f.taxRegime === 'Ordinario' && !f.partnerDraft,
    priority: 30,
    action: tool('regime'),
    sources: ['adeCedolare', 'adeQuantoSiPaga'],
  },
  {
    id: 'regimeYearly',
    types: ALL,
    phases: IN_FORCE,
    when: (f) => f.taxRegime !== null,
    priority: 60,
    action: tool('regime'),
    sources: ['adeCedolare'],
  },
  {
    id: 'cedolareNoIstat',
    types: LIBERO_CONCORDATO,
    phases: ['signing', 'toRegister', 'active', 'expiring'],
    when: (f) => f.taxRegime === 'CedolareSecca',
    priority: 47,
    action: official('adeCedolareScheda'),
    sources: ['adeCedolareScheda'],
  },
  {
    id: 'istatLibero',
    types: ['Libero'],
    phases: IN_FORCE,
    when: (f) => f.taxRegime === 'Ordinario',
    priority: 44,
    action: tab('pagamenti'),
    sources: ['law431'],
  },
  {
    id: 'istatConcordato',
    types: ['Concordato'],
    phases: IN_FORCE,
    when: (f) => f.taxRegime === 'Ordinario',
    priority: 44,
    action: tab('pagamenti'),
    sources: ['dm2017'],
  },
  {
    id: 'ordinaryAnnualRegistro',
    types: ALL,
    phases: IN_FORCE,
    when: (f) => f.taxRegime === 'Ordinario' && (f.type !== 'Transitorio' || (f.termDays ?? 0) > 365),
    priority: 42,
    action: official('adeAnnualita'),
    sources: ['adeAnnualita'],
  },

  // ---- canone concordato: the range of the agreement, the comune, the attestation, the IMU ----------------------------------------------
  {
    id: 'concordatoRentOutOfRange',
    types: ['Concordato'],
    phases: OPEN,
    when: (f) => f.rentOutOfRange,
    priority: 10,
    action: tool('rent'),
    sources: ['dm2017'],
  },
  {
    id: 'concordatoRentCheck',
    types: ['Concordato'],
    phases: BEFORE_REGISTRATION,
    when: (f) => !f.partnerDraft && !f.rentOutOfRange,
    priority: 32,
    action: tool('rent'),
    sources: ['dm2017'],
  },
  {
    id: 'concordatoAta',
    types: ['Concordato'],
    phases: [...BEFORE_REGISTRATION, 'active'],
    when: (f) => !f.partnerDraft && f.ata !== undefined && f.ata !== 'Verified',
    priority: 38,
    action: tool('regime'),
    sources: ['adeCedolareScheda'],
  },
  {
    id: 'concordatoAttestation',
    types: ['Concordato'],
    phases: ['signing', 'toRegister', 'active'],
    when: (f) => !f.viaService && !f.partnerDraft && f.hasAttestation === false,
    priority: byPhase({ active: 16 }, 20),
    action: tool('attestation'),
    sources: ['dm2017'],
  },
  {
    id: 'concordatoAttestationService',
    types: ['Concordato'],
    phases: ['draft', 'signing', 'toRegister', 'active'],
    when: (f) => (f.viaService || f.partnerDraft) && f.hasAttestation === false,
    priority: 36,
    action: tab('documenti'),
    sources: ['dm2017'],
  },
  {
    id: 'concordatoImu',
    types: ['Concordato'],
    phases: IN_FORCE,
    when: (f) => f.registered && f.imuApplicable === true,
    priority: 22,
    action: tool('imu'),
    sources: [],
  },
  {
    id: 'concordatoCommission',
    types: ['Concordato'],
    phases: IN_FORCE,
    priority: 84,
    action: tool('attestation'),
    sources: ['dm2017'],
  },

  // ---- the first months: deposit, delivery, people who are not from the EU ------------------------------------------------------------
  {
    id: 'depositOverMax',
    types: ALL,
    phases: OPEN,
    when: (f) => f.depositOverMax,
    priority: 9,
    needsRules: true,
    action: tab('dati'),
    sources: ['law392'],
  },
  {
    id: 'depositMax',
    types: ALL,
    phases: PREPARING,
    when: (f) => !f.depositOverMax && !f.partnerDraft,
    priority: 52,
    needsRules: true,
    action: tab('dati'),
    sources: ['law392'],
  },
  {
    id: 'extraEu',
    types: ALL,
    phases: OPEN,
    when: (f) => f.extraEu && !f.questuraDeclared,
    priority: (f) => (f.phase === 'draft' || f.phase === 'signing' ? 40 : 14),
    coveredBy: ['QuesturaCommunication', 'RecordKeyHandover'],
    action: tab('scadenze'),
    sources: ['poliziaExtraUe'],
  },
  {
    id: 'handover',
    types: ALL,
    phases: ['signing', 'toRegister'],
    priority: 58,
    action: tab('documenti'),
    sources: [],
  },
  {
    id: 'documentsToKeep',
    types: ALL,
    phases: [...IN_FORCE, 'concluded'],
    priority: 72,
    action: tab('documenti'),
    sources: [],
  },

  // ---- how long it lasts and what happens at the end ------------------------------------------------------------------------------------
  {
    id: 'liberoDuration',
    types: ['Libero'],
    phases: PREPARING,
    priority: 56,
    needsRules: true,
    action: tab('dati'),
    sources: ['law431'],
  },
  {
    id: 'concordatoDuration',
    types: ['Concordato'],
    phases: PREPARING,
    priority: 56,
    needsRules: true,
    action: tab('dati'),
    sources: ['law431', 'dm2017'],
  },
  {
    id: 'transitorioDuration',
    types: ['Transitorio'],
    phases: PREPARING,
    priority: 54,
    needsRules: true,
    action: tab('dati'),
    sources: ['dm2017', 'law431'],
  },
  {
    id: 'transitorioNeed',
    types: ['Transitorio'],
    phases: BEFORE_REGISTRATION,
    when: (f) => f.termDays !== null && !!f.rules && !f.shortTransitory,
    priority: 24,
    needsRules: true,
    action: tab('documenti'),
    sources: ['dm2017'],
  },
  {
    id: 'liberoFirstExpiry',
    types: ['Libero'],
    phases: IN_FORCE,
    when: (f) => !f.noticeRecorded && !f.terminated && !f.termRenewed,
    priority: byPhase({ expiring: 28 }, 62),
    needsRules: true,
    action: operation('disdetta'),
    sources: ['law431'],
  },
  {
    id: 'concordatoFirstExpiry',
    types: ['Concordato'],
    phases: IN_FORCE,
    when: (f) => !f.noticeRecorded && !f.terminated && !f.termRenewed,
    priority: byPhase({ expiring: 28 }, 62),
    needsRules: true,
    action: operation('disdetta'),
    sources: ['law431', 'dm2017'],
  },
  {
    id: 'secondExpiry',
    types: LIBERO_CONCORDATO,
    phases: IN_FORCE,
    when: (f) => f.termRenewed && !f.noticeRecorded && !f.terminated,
    priority: byPhase({ expiring: 26 }, 64),
    needsRules: true,
    action: operation('disdetta'),
    sources: ['law431'],
  },
  {
    id: 'noticeFromTenant',
    types: LIBERO_CONCORDATO,
    phases: IN_FORCE,
    when: (f) => !f.noticeRecorded && !f.terminated,
    priority: 66,
    needsRules: true,
    action: lifecycle('disdetta'),
    sources: ['law431'],
  },
  {
    id: 'transitorioConfirmNeed',
    types: ['Transitorio'],
    phases: IN_FORCE,
    priority: byPhase({ expiring: 20 }, 70),
    action: tab('dati'),
    sources: ['dm2017'],
  },
  {
    id: 'endOrganize',
    types: ALL,
    phases: ENDING,
    when: isEnding,
    priority: 33,
    action: tab('documenti'),
    sources: [],
  },
  {
    id: 'depositReturn',
    types: ALL,
    phases: ENDING,
    when: (f) => f.hasDeposit && isEnding(f),
    priority: 35,
    action: tab('documenti'),
    sources: ['law392'],
  },
  {
    id: 'endCommunicate',
    types: ALL,
    phases: ENDING,
    when: isEnding,
    priority: 41,
    action: official('adeAtti'),
    sources: ['adeAtti'],
  },
];
