export interface PropertyIcalStatus {
  importUrl?: string | null;
  exportUrl: string;
  lastImportAt?: string | null;
  lastImportStatus?: string | null;
  lastError?: string | null;
  blockCount: number;
}

export interface PropertyIcalExportUrl {
  exportUrl: string;
}

export interface PropertyIcalImportUrlRequest {
  importUrl: string;
}
