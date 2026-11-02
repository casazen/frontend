import { ApiClient } from './client';
import type { AutopilotPlan, AutopilotRunCommand, AutopilotRunResult } from '@/types/compliance-autopilot.types';

const PATH = '/compliance/autopilot';

/** A run asks the guests (one e-mail each), closes departures and, when an AI is in effect, waits for it to write the messages. */
const RUN_TIMEOUT_MS = 90_000;

/** «Gestisci con AI» of the page of the adempimenti. */
export const complianceAutopilotApi = {
  /** What the assistant would do now, item by item. Nothing is changed and nobody is contacted. */
  getPlan: () => ApiClient.get<AutopilotPlan>(PATH),

  /** Does what the plan says it will do, planned again now: the items that are `Ready` (only the ones in `keys` when it is given). */
  run: (command: AutopilotRunCommand) => ApiClient.post<AutopilotRunResult>(`${PATH}/run`, command, { timeout: RUN_TIMEOUT_MS }),
};
