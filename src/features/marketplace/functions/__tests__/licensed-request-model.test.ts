import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import type { MarketplaceFunction, MarketplaceFunctionList } from '@/types';
import {
  costTextOf,
  functionOf,
  guidanceOf,
  licenseSummary,
  licensedProblemCode,
  licensedProblemOf,
  licensedWizardId,
  requestPhase,
} from '../licensed-request-model';

function refusal(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

function entry(overrides: Partial<MarketplaceFunction> = {}): MarketplaceFunction {
  return {
    code: 'chat',
    name: 'Chat con gli ospiti',
    status: 'NotActive',
    activationId: null,
    isDeclared: false,
    requestedAt: null,
    verifiedAt: null,
    lastSyncedAt: null,
    lastErrorCode: null,
    changeRequestedAt: null,
    requestGuidance: null,
    ...overrides,
  };
}

function list(overrides: Partial<MarketplaceFunctionList> = {}): MarketplaceFunctionList {
  return { propertyId: 'prop-1', tier: null, roomsLimit: null, noRoomLicense: false, licenseReadAt: null, functions: [entry()], ...overrides };
}

describe('the wizard of a function of the license', () => {
  it('licensedWizardId_TwoModules_KeepTheirDraftsApart', () => {
    expect(licensedWizardId('chat')).not.toBe(licensedWizardId('rms'));
  });

  it('functionOf_ModuleOfTheList_IsFoundAndAnotherOneIsNot', () => {
    expect(functionOf(list(), 'chat')?.name).toBe('Chat con gli ospiti');
    expect(functionOf(list(), 'rms')).toBeUndefined();
    expect(functionOf(undefined, 'chat')).toBeUndefined();
  });

  it.each([
    ['NotActive', 'notRequested'],
    ['Requested', 'requested'],
    ['Active', 'active'],
    ['ToFix', 'toFix'],
  ] as const)('requestPhase_StatusOfTheServer_%s_Is_%s', (status, phase) => {
    expect(requestPhase(entry({ status }))).toBe(phase);
  });

  it('requestPhase_NoFunction_IsNotRequested', () => {
    expect(requestPhase(undefined)).toBe('notRequested');
  });
});

describe('what is known of the license', () => {
  it('licenseSummary_NoReadYet_SaysTheyAreNotKnownInsteadOfInventingThem', () => {
    expect(licenseSummary(list())).toEqual({ tier: null, roomsLimit: null, known: false, noRoomLicense: false, readAt: null });
    expect(licenseSummary(undefined)).toBeNull();
  });

  it('licenseSummary_LiveRead_CarriesThePlanAndTheLimit', () => {
    expect(licenseSummary(list({ tier: 'Standard', roomsLimit: 12, licenseReadAt: '2026-11-10T08:00:00Z' }))).toEqual({
      tier: 'Standard',
      roomsLimit: 12,
      known: true,
      noRoomLicense: false,
      readAt: '2026-11-10T08:00:00Z',
    });
  });

  it('licenseSummary_LimitOfZeroRooms_IsTheLicenseWithoutRooms', () => {
    expect(licenseSummary(list({ roomsLimit: 0, noRoomLicense: true, licenseReadAt: '2026-11-10T08:00:00Z' }))?.noRoomLicense).toBe(true);
  });
});

describe('the text of the request and the cost', () => {
  it('guidanceOf_TextOfTheServer_IsTheOneToCopyAndNothingIsWrittenHere', () => {
    expect(guidanceOf(entry({ requestGuidance: '  Buongiorno, vorrei attivare la funzione «Chat» sulla struttura «Casa Rosa».  ' }))).toBe(
      'Buongiorno, vorrei attivare la funzione «Chat» sulla struttura «Casa Rosa».',
    );
    expect(guidanceOf(entry({ requestGuidance: null }))).toBeNull();
    expect(guidanceOf(entry({ requestGuidance: '   ' }))).toBeNull();
    expect(guidanceOf(undefined)).toBeNull();
  });

  it('costTextOf_NoCostSent_IsNotSpecifiedAndAPriceIsNeverMadeUp', () => {
    expect(costTextOf({ text: null })).toBeNull();
    expect(costTextOf({ text: '  ' })).toBeNull();
    expect(costTextOf(undefined)).toBeNull();
    expect(costTextOf({ text: '9 euro al mese' })).toBe('9 euro al mese');
  });
});

describe('what stops a read or a request', () => {
  it.each([
    ['marketplace_property_not_linked', 'notLinked'],
    ['marketplace_octorate_not_connected', 'notConnected'],
    ['marketplace_function_already_active', 'alreadyActive'],
    ['marketplace_function_unknown', 'unknownFunction'],
    ['marketplace_property_not_found', 'propertyNotFound'],
    ['octorate_unavailable', 'other'],
  ] as const)('licensedProblemOf_Code_%s_Is_%s', (code, problem) => {
    expect(licensedProblemOf(refusal(409, { code }))).toBe(problem);
    expect(licensedProblemCode(refusal(409, { code }))).toBe(code);
  });

  it('licensedProblemOf_NoError_IsNoProblem_AndAnErrorWithNoCodeIsOther', () => {
    expect(licensedProblemOf(null)).toBeNull();
    expect(licensedProblemOf(new Error('no answer'))).toBe('other');
    expect(licensedProblemCode(new Error('no answer'))).toBeNull();
  });
});
