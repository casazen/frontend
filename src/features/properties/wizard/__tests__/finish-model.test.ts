import { describe, expect, it } from 'vitest';
import type { ComplianceActivationResult, ComplianceWizardStep } from '@/types/compliance.types';
import { finishActions, finishStage, fixTargetFor } from '../finish/finish-model';

const step = (id: string, open: boolean, blocker = true): ComplianceWizardStep => ({ id, label: id, status: open ? 'pending' : 'complete', blocker });
const activation = (status: ComplianceActivationResult['complianceStatus'], open: string[]): ComplianceActivationResult => ({
  complianceStatus: status,
  steps: [...['base-data', 'cin', 'documents', 'safety'].map((id) => step(id, open.includes(id))), step('ical', true, false)],
});

describe('the last step of the wizard', () => {
  it('finishActions_BlockerOpen_SendsNothingWhateverTheSwitchSays', () => {
    // «Mostra la casa sul sito» never gets around the blockers, and «Finisci dopo» never activates.
    const blocked = finishStage(activation('Pending', ['cin']));
    expect(blocked).toBe('blocked');
    expect(finishActions(blocked, true, false)).toEqual([]);
    expect(finishActions(blocked, false, true)).toEqual([]);
    expect(finishActions(finishStage(undefined), true, false)).toEqual([]);
  });

  it('finishActions_NothingBlocks_WritesTheSwitchFirstAndThenActivates', () => {
    const ready = finishStage(activation('Pending', []));
    expect(ready).toBe('ready');
    // A «no» is in place before the property goes live; a switch left as it was is not written; an active property is not activated again.
    expect(finishActions(ready, false, true)).toEqual(['visibility', 'activate']);
    expect(finishActions(ready, true, true)).toEqual(['activate']);
    const active = finishStage(activation('Active', []));
    expect(finishActions(active, false, true)).toEqual(['visibility']);
    expect(finishActions(active, true, true)).toEqual([]);
    // A suspended property whose blockers are gone is activated again.
    expect(finishStage(activation('Suspended', []))).toBe('ready');
  });

  it('fixTargetFor_EachStepOfTheActivation_SendsToWhereItIsFixed', () => {
    const complete = { name: 'Casa', address: 'Via Roma 1', city: 'Como', maxGuests: 4 };

    expect(fixTargetFor('base-data', complete)).toEqual({ kind: 'step', step: 'prices' });
    expect(fixTargetFor('base-data', { ...complete, address: '' })).toEqual({ kind: 'step', step: 'base' });
    expect(fixTargetFor('safety', complete)).toEqual({ kind: 'step', step: 'amenities' });
    expect(fixTargetFor('cin', complete)).toEqual({ kind: 'section', section: 'cin' });
    expect(fixTargetFor('documents', complete)).toEqual({ kind: 'section', section: 'documents' });
    expect(fixTargetFor('ical', complete)).toEqual({ kind: 'section', section: 'calendars' });
    expect(fixTargetFor('tourist-tax', complete)).toBeNull();
  });
});
