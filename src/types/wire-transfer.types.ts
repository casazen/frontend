export type WireBatchStatus = 'Generated' | 'Downloaded' | 'Paid';

export interface WireBatch {
  batchId: string;
  currency: string;
  totalAmount: number;
  transferCount: number;
  status?: WireBatchStatus;
  createdAt?: string;
  downloadedAt?: string | null;
  paidAt?: string | null;
}

export interface CreateBatchRequest {
  statementIds: string[];
  debitAccount: string;
}

export interface CreateBatchResponse {
  batchId: string;
  currency: string;
  totalAmount: number;
  transferCount: number;
}
