import { knownBlockers } from '@/features/compliance/activation-wizard-model';
import type { Property } from '@/types';
import type { ComplianceActivationResult } from '@/types/compliance.types';
import { baseDataStepFor, type WizardStepId } from '../property-wizard-model';

/**
 * Where the wizard stands at its last step, **as the server says it** (`compliance/activation`): nothing is worked out from the
 * form. `loading`: not read yet · `blocked`: a blocking step is open, so nothing can be activated and the host finishes later ·
 * `ready`: nothing blocks, only the terms and the click are missing · `active`: the property is already active.
 */
export type FinishStage = 'loading' | 'blocked' | 'ready' | 'active';

export function finishStage(activation: ComplianceActivationResult | undefined): FinishStage {
  if (!activation) return 'loading';
  if (knownBlockers(activation.steps).length > 0) return 'blocked';
  return activation.complianceStatus === 'Active' ? 'active' : 'ready';
}

export type FinishAction = 'visibility' | 'activate';

/**
 * What the last button does, in order. The switch «Mostra la casa sul sito» is written first (a «no» must be in place when the
 * property goes live) and only when it changed; the activation is asked only when nothing blocks and the property is not active
 * already. **With a blocker open nothing at all is sent**: the switch cannot make a property that is not ready appear, and
 * «Finisci dopo» never activates.
 */
export function finishActions(stage: FinishStage, showOnSite: boolean, storedShowOnSite: boolean): FinishAction[] {
  if (stage === 'loading' || stage === 'blocked') return [];
  const actions: FinishAction[] = [];
  if (showOnSite !== storedShowOnSite) actions.push('visibility');
  if (stage === 'ready') actions.push('activate');
  return actions;
}

/** The parts of the last step that a missing item can send the host to. */
export type FinishSection = 'calendars' | 'cin' | 'documents';

/** Where a «Correggi» goes: another step of the wizard, or a part of the last step. */
export type FixTarget = { kind: 'step'; step: WizardStepId } | { kind: 'section'; section: FinishSection };

/**
 * The place where a step of the activation is fixed (`base-data`: the first step or the prices, whichever has the hole; `safety`:
 * the amenities step, which holds the safety sheet; the CIN, the documents and the calendars: here). A step the host cannot act on
 * — the tourist tax — has no place.
 */
export function fixTargetFor(activationStepId: string, property: Pick<Property, 'name' | 'address' | 'city' | 'maxGuests'>): FixTarget | null {
  switch (activationStepId) {
    case 'base-data':
      return { kind: 'step', step: baseDataStepFor(property) };
    case 'safety':
      return { kind: 'step', step: 'amenities' };
    case 'cin':
      return { kind: 'section', section: 'cin' };
    case 'documents':
      return { kind: 'section', section: 'documents' };
    case 'ical':
      return { kind: 'section', section: 'calendars' };
    default:
      return null;
  }
}
