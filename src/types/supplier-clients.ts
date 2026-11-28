interface SupplierClientContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface SupplierClient {
  id: string;
  kind: string;
  source: string;
  label: string | null;
  anonymized: boolean;
  jobsAccepted: number;
  jobsCompleted: number;
  lastJobAt?: string | null;
  nextJobAt?: string | null;
  grossPaidCents: number;
  regular: boolean;
  contact?: SupplierClientContact | null;
}

export interface SupplierClientsResponse {
  items: SupplierClient[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SupplierClientJob {
  requestId: string;
  serviceName?: string | null;
  category: string;
  status: string;
  phase: string;
  scheduledStart?: string | null;
  completedAt?: string | null;
  amountCents?: number | null;
}

export interface SupplierClientDetail extends SupplierClient {
  recentJobs: SupplierClientJob[];
}
