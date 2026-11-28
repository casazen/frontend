import { ApiClient } from './client';
import type {
  AdminAssistRequest,
  AssistQueueQuery,
  AssistRequest,
  BulkActivateRequest,
  BulkActivateResult,
  BulkApplyRequest,
  BulkApplyResult,
  BulkPreview,
  BulkProgress,
  BulkSelection,
  CreateAssistRequest,
  DeferPartRequest,
  FlowActivationResult,
  FlowPropertiesQuery,
  ImportResult,
  IntegrationOverview,
  OnboardingFlowKey,
  OnboardingPartChange,
  OnboardingPartKey,
  OnboardingPath,
  OnboardingPlan,
  OnboardingReopen,
  OnboardingStatus,
  PagedAssistRequests,
  PagedFlowProperties,
  PanelStep,
  PilotGroup,
  StartedPanelStep,
  StartPanelStepRequest,
  TestRunRequest,
  TestRunResult,
  UpdateAssistRequest,
} from '@/types/onboarding.types';

const flowUrl = (flow: OnboardingFlowKey) => `/onboarding/flows/${encodeURIComponent(flow)}`;
const partUrl = (key: OnboardingPartKey) => `/onboarding/parts/${encodeURIComponent(key)}`;
const panelStepUrl = (id: string) => `/onboarding/panel-steps/${encodeURIComponent(id)}`;

/**
 * Everything the web app says to the activation of CasaZen with Octorate (epic E10): the plan and the path, the six flows, the guided
 * steps of the panel and the «Do it for me» requests, the integration settings and the bulk configuration of an agency. The screens never
 * call axios: they compose the hooks of `src/queries`, which call these methods.
 *
 * Every endpoint but `getStatus` answers 404 while the backend flag `Features:OctorateOnboarding` is off (the web flag is
 * `octorateOnboarding`). The reads need `property.read`; what changes anything is an org-level decision of the organization
 * administrator (`OrgBillingAdmin`) and answers 403 to anyone else. The server never sends a sentence in these answers, only codes.
 */
export const onboardingApi = {
  getStatus: () => ApiClient.get<OnboardingStatus>('/onboarding/status'),

  getFlowProperties: (flow: OnboardingFlowKey, query: FlowPropertiesQuery = {}) =>
    ApiClient.get<PagedFlowProperties>(`${flowUrl(flow)}/properties`, query),

  getPlan: () => ApiClient.get<OnboardingPlan>('/onboarding/plan'),

  getPath: () => ApiClient.get<OnboardingPath>('/onboarding/path'),

  deferPart: (key: OnboardingPartKey, remindAt?: string) => {
    const body: DeferPartRequest = remindAt ? { remindAt } : {};
    return ApiClient.post<OnboardingPartChange>(`${partUrl(key)}/defer`, body);
  },

  exitPart: (key: OnboardingPartKey) => ApiClient.post<OnboardingPartChange>(`${partUrl(key)}/exit`),

  resumePart: (key: OnboardingPartKey) => ApiClient.post<OnboardingPartChange>(`${partUrl(key)}/resume`),

  reopenPart: (key: OnboardingPartKey) => ApiClient.post<OnboardingReopen>(`${partUrl(key)}/reopen`),

  activateFlow: (flow: OnboardingFlowKey, propertyIds: string[]) =>
    ApiClient.post<FlowActivationResult>(`${flowUrl(flow)}/activate`, { propertyIds }),

  deactivateFlow: (flow: OnboardingFlowKey, propertyIds: string[]) =>
    ApiClient.post<FlowActivationResult>(`${flowUrl(flow)}/deactivate`, { propertyIds }),

  runTest: (propertyId: string, bookingId?: string) => {
    const body: TestRunRequest = bookingId ? { propertyId, bookingId } : { propertyId };
    return ApiClient.post<TestRunResult>('/onboarding/test-run', body);
  },

  getIntegration: () => ApiClient.get<IntegrationOverview>('/onboarding/integration'),

  /**
   * Starts a guided step of the Octorate panel (or starts it again; idempotent): the answer holds the stored state, the address of the panel
   * and, for `redirectCallback`, the page of CasaZen the panel sends the person back to. 409 `octorate_panel_url_missing`; 422
   * `panel_step_kind_invalid`, `panel_step_channel_invalid`, `panel_step_resume_invalid`.
   */
  startPanelStep: (request: StartPanelStepRequest) => ApiClient.post<StartedPanelStep>('/onboarding/panel-steps', request),

  /** The stored state of one step with the time of the next check; when a check is due it runs now, so a page that polls never burns the quota of Octorate. 404 `panel_step_not_found`. */
  getPanelStepStatus: (id: string) => ApiClient.get<PanelStep>(`${panelStepUrl(id)}/status`),

  verifyPanelStep: (id: string) => ApiClient.post<PanelStep>(`${panelStepUrl(id)}/verify`),

  confirmPanelStep: (id: string) => ApiClient.post<PanelStep>(`${panelStepUrl(id)}/confirm`),

  completePanelStepCallback: (id: string, state: string) => ApiClient.post<PanelStep>(`${panelStepUrl(id)}/callback`, { state }),

  listPanelSteps: () => ApiClient.get<PanelStep[]>('/onboarding/panel-steps'),

  requestAssist: (request: CreateAssistRequest) => ApiClient.post<AssistRequest>('/onboarding/assist-requests', request),

  listAssistRequests: () => ApiClient.get<AssistRequest[]>('/onboarding/assist-requests'),

  listAssistQueue: (query: AssistQueueQuery = {}) => ApiClient.get<PagedAssistRequests>('/admin/onboarding/assist-requests', query),

  updateAssistRequest: (id: string, request: UpdateAssistRequest) =>
    ApiClient.put<AdminAssistRequest>(`/admin/onboarding/assist-requests/${encodeURIComponent(id)}`, request),

  bulkPreview: (selection: BulkSelection) => ApiClient.post<BulkPreview>('/onboarding/bulk/preview', selection),

  /**
   * Applies one choice to a selection. Nothing is written unless `dryRun` is false AND `confirmed` is true: without them the answer says what
   * each property would do. 422 `onboarding_selection_invalid`, `onboarding_selection_too_large`, `onboarding_choice_invalid`.
   */
  bulkApply: (request: BulkApplyRequest) => ApiClient.post<BulkApplyResult>('/onboarding/bulk/apply', request),

  bulkProgress: () => ApiClient.get<BulkProgress>('/onboarding/bulk/progress'),

  getPilot: () => ApiClient.get<PilotGroup>('/onboarding/bulk/pilot'),

  setPilot: (propertyIds: string[]) => ApiClient.put<PilotGroup>('/onboarding/bulk/pilot', { propertyIds }),

  bulkActivate: (request: BulkActivateRequest) => ApiClient.post<BulkActivateResult>('/onboarding/bulk/activate', request),

  /**
   * Checks (`dryRun` true, nothing written) or imports (`dryRun` false: only the valid rows are written) a CSV or Excel file of the data that
   * changes from one property to the next (comune and region, Alloggiati room numbers, lock code). The file is sent as multipart in the
   * field `file` and `dryRun` travels in the query. 2 MB and 1,000 rows at most; 400 `import_file_missing`, 413 `import_file_too_large`,
   * 415 `import_file_type_unsupported`, 422 `import_too_many_rows` and the other `import_*` codes.
   */
  importPropertyData: (file: File, dryRun: boolean) => {
    const body = new FormData();
    body.append('file', file);
    return ApiClient.post<ImportResult>(`/onboarding/bulk/import?dryRun=${dryRun ? 'true' : 'false'}`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
