import { ApiClient } from './client';
import type { ServiceRequestAssist, ServiceRequestAssistAvailability, ServiceRequestAssistInput } from '@/types/service-request-assist';

const PATH = '/service-requests/assist';

export const serviceRequestAssistApi = {
  getAvailability: () => ApiClient.get<ServiceRequestAssistAvailability>(PATH),

  assist: (input: ServiceRequestAssistInput) => ApiClient.post<ServiceRequestAssist>(PATH, input),
};
