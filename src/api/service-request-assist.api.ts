import { ApiClient } from './client';
import type { ServiceRequestAssist, ServiceRequestAssistAvailability, ServiceRequestAssistInput } from '@/types/service-request-assist';

const PATH = '/service-requests/assist';

/** «Descrivi di cosa hai bisogno» of the guided request «Richiedi un intervento» (WIZ-AI-REQUEST). */
export const serviceRequestAssistApi = {
  /** Whether an AI is in effect on the platform: the box is offered only when it is. A cheap read, no permit of the AI limit. */
  getAvailability: () => ApiClient.get<ServiceRequestAssistAvailability>(PATH),

  /** The AI reads the words of the host and proposes the service, the urgency and who to ask; a `200` also when it cannot (`aiUsed` false and the reason). */
  assist: (input: ServiceRequestAssistInput) => ApiClient.post<ServiceRequestAssist>(PATH, input),
};
