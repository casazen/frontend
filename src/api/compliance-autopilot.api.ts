import { ApiClient } from './client';
import type { AutopilotPlan, AutopilotRunCommand, AutopilotRunResult } from '@/types/compliance-autopilot.types';

const PATH = '/compliance/autopilot';

const RUN_TIMEOUT_MS = 90_000;

export const complianceAutopilotApi = {
  getPlan: () => ApiClient.get<AutopilotPlan>(PATH),

  run: (command: AutopilotRunCommand) => ApiClient.post<AutopilotRunResult>(`${PATH}/run`, command, { timeout: RUN_TIMEOUT_MS }),
};
