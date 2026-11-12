import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onboardingApi } from '../onboarding.api';
import { ApiClient } from '../client';
import type { BulkApplyRequest, BulkSelection, StartPanelStepRequest } from '@/types/onboarding.types';

vi.mock('../client');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ApiClient.get).mockResolvedValue({});
  vi.mocked(ApiClient.post).mockResolvedValue({});
  vi.mocked(ApiClient.put).mockResolvedValue({});
});

/** The paths of the endpoints of E10 (backend `Casazen.Web/Controllers/Onboarding*`), relative to the API base URL that already ends in `/api`. */
describe('onboardingApi: one method for each endpoint of E10', () => {
  describe('reads', () => {
    it('GetStatusPlanPathIntegration_ReadTheirOwnEndpointWithNoQuery', async () => {
      await onboardingApi.getStatus();
      await onboardingApi.getPlan();
      await onboardingApi.getPath();
      await onboardingApi.getIntegration();
      await onboardingApi.bulkProgress();
      await onboardingApi.getPilot();
      await onboardingApi.listPanelSteps();
      await onboardingApi.listAssistRequests();

      expect(vi.mocked(ApiClient.get).mock.calls).toEqual([
        ['/onboarding/status'],
        ['/onboarding/plan'],
        ['/onboarding/path'],
        ['/onboarding/integration'],
        ['/onboarding/bulk/progress'],
        ['/onboarding/bulk/pilot'],
        ['/onboarding/panel-steps'],
        ['/onboarding/assist-requests'],
      ]);
    });

    it('GetFlowProperties_NamesTheFlowInThePathAndSendsTheFilterInTheQuery', async () => {
      await onboardingApi.getFlowProperties('CheckInCompliance', { state: 'toComplete', search: 'Mare', page: 2, pageSize: 25 });

      expect(ApiClient.get).toHaveBeenCalledWith('/onboarding/flows/CheckInCompliance/properties', {
        state: 'toComplete',
        search: 'Mare',
        page: 2,
        pageSize: 25,
      });
    });

    it('GetPanelStepStatus_AsksTheStatusOfThatStep', async () => {
      await onboardingApi.getPanelStepStatus('step 1/2');

      // The id travels in the path: it is encoded.
      expect(ApiClient.get).toHaveBeenCalledWith('/onboarding/panel-steps/step%201%2F2/status');
    });

    it('ListAssistQueue_IsTheStaffEndpointWithAStatusAndAPage', async () => {
      await onboardingApi.listAssistQueue({ status: 'Requested', page: 3 });

      expect(ApiClient.get).toHaveBeenCalledWith('/admin/onboarding/assist-requests', { status: 'Requested', page: 3 });
    });
  });

  describe('the parts of the plan', () => {
    it('DeferPart_SendsTheMomentOfTheReminderInTheBody', async () => {
      await onboardingApi.deferPart('identification', '2026-11-13T08:00:00.000Z');

      expect(ApiClient.post).toHaveBeenCalledWith('/onboarding/parts/identification/defer', { remindAt: '2026-11-13T08:00:00.000Z' });
    });

    it('DeferPart_WithoutAMoment_SendsAnEmptyBodySoTheServerPicksTomorrowAtNine', async () => {
      await onboardingApi.deferPart('compliance');

      expect(ApiClient.post).toHaveBeenCalledWith('/onboarding/parts/compliance/defer', {});
    });

    it('ExitResumeReopen_PostToTheirOwnEndpointOfThePart', async () => {
      await onboardingApi.exitPart('properties');
      await onboardingApi.resumePart('properties');
      await onboardingApi.reopenPart('compliance');

      expect(vi.mocked(ApiClient.post).mock.calls).toEqual([
        ['/onboarding/parts/properties/exit'],
        ['/onboarding/parts/properties/resume'],
        ['/onboarding/parts/compliance/reopen'],
      ]);
    });
  });

  describe('the flows', () => {
    it('ActivateAndDeactivate_SendTheListOfPropertiesAndNothingElse', async () => {
      await onboardingApi.activateFlow('Listings', ['p-1', 'p-2']);
      await onboardingApi.deactivateFlow('Reports', ['p-3']);

      expect(vi.mocked(ApiClient.post).mock.calls).toEqual([
        ['/onboarding/flows/Listings/activate', { propertyIds: ['p-1', 'p-2'] }],
        ['/onboarding/flows/Reports/deactivate', { propertyIds: ['p-3'] }],
      ]);
    });

    it('RunTest_SendsThePropertyAndOnlyTheBookingThatWasChosen', async () => {
      await onboardingApi.runTest('p-1');
      await onboardingApi.runTest('p-1', 'b-9');

      expect(vi.mocked(ApiClient.post).mock.calls).toEqual([
        ['/onboarding/test-run', { propertyId: 'p-1' }],
        ['/onboarding/test-run', { propertyId: 'p-1', bookingId: 'b-9' }],
      ]);
    });
  });

  describe('the guided steps of the panel and the requests for help', () => {
    it('StartPanelStep_SendsTheStepAndThePointOfTheWizardToComeBackTo', async () => {
      const request: StartPanelStepRequest = { kind: 'channelAccess', propertyId: 'p-1', channelCode: 'booking_xml', resumeWizardType: 'OnboardingActivation' };

      await onboardingApi.startPanelStep(request);

      expect(ApiClient.post).toHaveBeenCalledWith('/onboarding/panel-steps', request);
    });

    it('VerifyAndConfirmPanelStep_PostToTheStepWithNoBody', async () => {
      await onboardingApi.verifyPanelStep('s-1');
      await onboardingApi.confirmPanelStep('s-1');

      expect(vi.mocked(ApiClient.post).mock.calls).toEqual([['/onboarding/panel-steps/s-1/verify'], ['/onboarding/panel-steps/s-1/confirm']]);
    });

    it('CompletePanelStepCallback_CarriesTheStateInTheBodyAndNeverInTheAddress', async () => {
      await onboardingApi.completePanelStepCallback('s-1', 'single-use-state');

      expect(ApiClient.post).toHaveBeenCalledWith('/onboarding/panel-steps/s-1/callback', { state: 'single-use-state' });
      expect(vi.mocked(ApiClient.post).mock.calls[0][0]).not.toContain('single-use-state');
    });

    it('RequestAssistAndUpdate_PostTheRequestAndPutTheStaffAnswer', async () => {
      await onboardingApi.requestAssist({ part: 'compliance', context: 'panelPolice', propertyId: 'p-1' });
      await onboardingApi.updateAssistRequest('a-1', { status: 'done', note: 'Fatto' });

      expect(ApiClient.post).toHaveBeenCalledWith('/onboarding/assist-requests', { part: 'compliance', context: 'panelPolice', propertyId: 'p-1' });
      expect(ApiClient.put).toHaveBeenCalledWith('/admin/onboarding/assist-requests/a-1', { status: 'done', note: 'Fatto' });
    });
  });

  describe('the bulk configuration', () => {
    it('BulkPreview_SendsTheSelectionAsTheBody', async () => {
      const selection: BulkSelection = { kind: 'filter', filter: { regionCodes: ['LOM'], missingFlow: 'CheckInCompliance' } };

      await onboardingApi.bulkPreview(selection);

      expect(ApiClient.post).toHaveBeenCalledWith('/onboarding/bulk/preview', selection);
    });

    it('BulkApply_PassesTheDryRunAndTheConfirmationAsTheyAre_NeverSettingThem', async () => {
      const request: BulkApplyRequest = { selection: { kind: 'ids', propertyIds: ['p-1'] }, choice: { complianceSender: 'CasaZen' }, dryRun: true };

      await onboardingApi.bulkApply(request);

      // The server writes only with `dryRun` false AND `confirmed` true: the client adds neither.
      expect(ApiClient.post).toHaveBeenCalledWith('/onboarding/bulk/apply', request);
      expect(vi.mocked(ApiClient.post).mock.calls[0][1]).not.toHaveProperty('confirmed');
    });

    it('SetPilotAndBulkActivate_PutTheGroupAndPostTheCohortWithItsFlows', async () => {
      await onboardingApi.setPilot(['p-1', 'p-2']);
      await onboardingApi.bulkActivate({ cohort: 'pilot', flows: ['Listings', 'Bookings'] });

      expect(ApiClient.put).toHaveBeenCalledWith('/onboarding/bulk/pilot', { propertyIds: ['p-1', 'p-2'] });
      expect(ApiClient.post).toHaveBeenCalledWith('/onboarding/bulk/activate', { cohort: 'pilot', flows: ['Listings', 'Bookings'] });
    });
  });

  describe('the import of the data of the properties', () => {
    const file = new File(['propertyId,cinCode\n'], 'immobili.csv', { type: 'text/csv' });

    it('ImportPropertyData_Check_SendsTheFileAsMultipartInTheFieldFileWithDryRunInTheQuery', async () => {
      await onboardingApi.importPropertyData(file, true);

      const [url, body, options] = vi.mocked(ApiClient.post).mock.calls[0];
      expect(url).toBe('/onboarding/bulk/import?dryRun=true');
      expect(body).toBeInstanceOf(FormData);
      expect((body as FormData).get('file')).toBe(file);
      expect(options).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    });

    it('ImportPropertyData_Import_SaysDryRunFalseInTheQuery', async () => {
      await onboardingApi.importPropertyData(file, false);

      expect(vi.mocked(ApiClient.post).mock.calls[0][0]).toBe('/onboarding/bulk/import?dryRun=false');
    });
  });
});
