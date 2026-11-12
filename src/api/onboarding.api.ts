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
  /** Activation checklist of the caller's org (PL-15): every step is derived from stored state on the server. */
  getStatus: () => ApiClient.get<OnboardingStatus>('/onboarding/status'),

  /**
   * The properties the caller reaches with their status for one flow, a page at a time, by name (NF-106). 400 `onboarding_flow_unknown`
   * or `onboarding_flow_state_unknown` for a name or a state the server does not know.
   */
  getFlowProperties: (flow: OnboardingFlowKey, query: FlowPropertiesQuery = {}) =>
    ApiClient.get<PagedFlowProperties>(`${flowUrl(flow)}/properties`, query),

  /** The plan of the activation: the eleven parts, «What you need», the path and whether the org is activated (NF-104). */
  getPlan: () => ApiClient.get<OnboardingPlan>('/onboarding/plan'),

  /** The connected path «Inizia con CasaZen»: its six steps mapped to the parts, which are visible, and the next one (UX-10). */
  getPath: () => ApiClient.get<OnboardingPath>('/onboarding/path'),

  /**
   * «Lo faccio dopo»: the part is deferred and a «Da fare» reminds the host at `remindAt` (UTC) or, without one, tomorrow at 09:00 in Rome.
   * 422 `onboarding_part_prerequisite` when another part requires this one, `onboarding_remind_at_invalid`, `onboarding_part_not_open`
   * (the part is done or not available); 404 `onboarding_part_unknown`. Organization administrator only.
   */
  deferPart: (key: OnboardingPartKey, remindAt?: string) => {
    const body: DeferPartRequest = remindAt ? { remindAt } : {};
    return ApiClient.post<OnboardingPartChange>(`${partUrl(key)}/defer`, body);
  },

  /** «Salva ed esci»: the part stays open and a «Da fare» keeps what remains from disappearing silently. 422 `onboarding_part_not_open` when nothing remains. Organization administrator only. */
  exitPart: (key: OnboardingPartKey) => ApiClient.post<OnboardingPartChange>(`${partUrl(key)}/exit`),

  /** The host takes the part up again: the deferral is cleared and its «Da fare» closed. Organization administrator only. */
  resumePart: (key: OnboardingPartKey) => ApiClient.post<OnboardingPartChange>(`${partUrl(key)}/resume`),

  /** Where a reopen of a done part continues (the wizard and, for compliance, the choice of the sender); changes no data. 422 `onboarding_part_not_reopenable`. Organization administrator only. */
  reopenPart: (key: OnboardingPartKey) => ApiClient.post<OnboardingReopen>(`${partUrl(key)}/reopen`),

  /**
   * Activates a flow on 1 to 500 properties; the server checks the prerequisites of each one again and answers one outcome per property
   * (a list that is empty is 422 `onboarding_property_ids_empty`, never «all»). Organization administrator only.
   */
  activateFlow: (flow: OnboardingFlowKey, propertyIds: string[]) =>
    ApiClient.post<FlowActivationResult>(`${flowUrl(flow)}/activate`, { propertyIds }),

  /** Deactivates a flow on the properties where it stands activated (the row stays, with when and who). Organization administrator only. */
  deactivateFlow: (flow: OnboardingFlowKey, propertyIds: string[]) =>
    ApiClient.post<FlowActivationResult>(`${flowUrl(flow)}/deactivate`, { propertyIds }),

  /** The final test: a recently imported booking passes through every flow with no effect at all. 404 `onboarding_property_not_found`, `test_booking_not_found`. */
  runTest: (propertyId: string, bookingId?: string) => {
    const body: TestRunRequest = bookingId ? { propertyId, bookingId } : { propertyId };
    return ApiClient.post<TestRunResult>('/onboarding/test-run', body);
  },

  /** The integration settings: the connection, the parts that can be reopened, the senders and the channels (NF-108). Organization administrator only. */
  getIntegration: () => ApiClient.get<IntegrationOverview>('/onboarding/integration'),

  /**
   * Starts a guided step of the Octorate panel (or starts it again; idempotent): the answer holds the stored state, the address of the panel
   * and, for `redirectCallback`, the page of CasaZen the panel sends the person back to. 409 `octorate_panel_url_missing`; 422
   * `panel_step_kind_invalid`, `panel_step_channel_invalid`, `panel_step_resume_invalid`.
   */
  startPanelStep: (request: StartPanelStepRequest) => ApiClient.post<StartedPanelStep>('/onboarding/panel-steps', request),

  /** The stored state of one step with the time of the next check; when a check is due it runs now, so a page that polls never burns the quota of Octorate. 404 `panel_step_not_found`. */
  getPanelStepStatus: (id: string) => ApiClient.get<PanelStep>(`${panelStepUrl(id)}/status`),

  /** The explicit trigger of a check (the window of the panel was closed, the tab got the focus again), held to a minimum gap from the previous one. */
  verifyPanelStep: (id: string) => ApiClient.post<PanelStep>(`${panelStepUrl(id)}/verify`),

  /**
   * The host says the step is done: allowed only after a real check found that CasaZen cannot tell. 409 `panel_step_verification_required`
   * (no check yet), `panel_step_not_valid` (the last check found it not valid), `panel_step_assist_open` (support is handling it).
   */
  confirmPanelStep: (id: string) => ApiClient.post<PanelStep>(`${panelStepUrl(id)}/confirm`),

  /**
   * The callback of a panel that sends the person back (a step in `redirectCallback`): the `state` is consumed (valid once, before its
   * expiry) and the step is verified. It travels in the body, so it stays out of the address. 422 `panel_step_state_invalid`.
   */
  completePanelStepCallback: (id: string, state: string) => ApiClient.post<PanelStep>(`${panelStepUrl(id)}/callback`, { state }),

  /** The guided steps of the org the caller reaches, the most recently started first. */
  listPanelSteps: () => ApiClient.get<PanelStep[]>('/onboarding/panel-steps'),

  /** «Fallo per me»: asks CasaZen support to do a step. 409 `assist_request_already_open`, `assist_step_already_done`; 422 `onboarding_part_unknown`, `assist_context_invalid`. */
  requestAssist: (request: CreateAssistRequest) => ApiClient.post<AssistRequest>('/onboarding/assist-requests', request),

  /** The «Fallo per me» requests of the org the caller reaches. */
  listAssistRequests: () => ApiClient.get<AssistRequest[]>('/onboarding/assist-requests'),

  /** The staff queue of the «Fallo per me» requests, a page at a time (platform admin only). */
  listAssistQueue: (query: AssistQueueQuery = {}) => ApiClient.get<PagedAssistRequests>('/admin/onboarding/assist-requests', query),

  /** Staff takes a request, closes it or cancels it, with an optional note (platform admin only). 409 `assist_request_closed`; 422 `assist_status_invalid`, `assist_note_invalid`. */
  updateAssistRequest: (id: string, request: UpdateAssistRequest) =>
    ApiClient.put<AdminAssistRequest>(`/admin/onboarding/assist-requests/${encodeURIComponent(id)}`, request),

  /** How many properties a bulk selection reaches, with a sample of 20 (NF-105). 422 `onboarding_selection_invalid`. */
  bulkPreview: (selection: BulkSelection) => ApiClient.post<BulkPreview>('/onboarding/bulk/preview', selection),

  /**
   * Applies one choice to a selection. Nothing is written unless `dryRun` is false AND `confirmed` is true: without them the answer says what
   * each property would do. 422 `onboarding_selection_invalid`, `onboarding_selection_too_large`, `onboarding_choice_invalid`.
   */
  bulkApply: (request: BulkApplyRequest) => ApiClient.post<BulkApplyResult>('/onboarding/bulk/apply', request),

  /** «`ready` of `total` ready», the four counts of each flow and the pilot group. */
  bulkProgress: () => ApiClient.get<BulkProgress>('/onboarding/bulk/progress'),

  /** The pilot group: its members, the recommended minimum and the maximum, and how each flow has got on it. */
  getPilot: () => ApiClient.get<PilotGroup>('/onboarding/bulk/pilot'),

  /** Sets the pilot group (5 to 10 properties are recommended; an empty list is 422 `onboarding_property_ids_empty`, never «no pilot group»). 404 `onboarding_property_not_found`; 422 `pilot_group_too_large`. */
  setPilot: (propertyIds: string[]) => ApiClient.put<PilotGroup>('/onboarding/bulk/pilot', { propertyIds }),

  /** Activates flows on a cohort, the pilot group or the rest. 409 `pilot_group_not_active` when the pilot group is not set or not active in every flow asked; 422 `onboarding_flows_empty`. */
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
    // Explicit multipart: the client's default JSON content type would serialize the form data as JSON.
    return ApiClient.post<ImportResult>(`/onboarding/bulk/import?dryRun=${dryRun ? 'true' : 'false'}`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
