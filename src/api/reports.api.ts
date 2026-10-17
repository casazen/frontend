import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';

/** The reads of short rent under `GET /api/reports/*` (SR-10): ricavo, occupazione e canali. */
export type HostReportKind = 'revenue-by-property' | 'occupancy-by-property' | 'bookings-by-channel';

/** Report period: calendar dates `YYYY-MM-DD` in Europe/Rome, both included, at most 24 months. */
export interface ReportPeriod {
  from: string;
  to: string;
}

/** Start of the file name of each report: the words of the file the backend sends (the base is in it where it has one). */
const FILE_NAMES: Record<HostReportKind, string> = {
  'revenue-by-property': 'casazen-ricavo-per-immobile-competenza',
  'occupancy-by-property': 'casazen-occupazione-per-immobile',
  'bookings-by-channel': 'casazen-prenotazioni-per-canale-competenza',
};

/** Name of the downloaded file: the report and its days (`casazen-ricavo-per-immobile-competenza-2026-10-01-2026-10-31.csv`). */
export function hostReportFileName(kind: HostReportKind, period: ReportPeriod): string {
  return `${FILE_NAMES[kind]}-${period.from}-${period.to}.csv`;
}

export const reportsApi = {
  /** The CSV of a report (`;`, decimal comma, BOM); a problem body (JSON Blob) is parsed so `getProblemMessage` can read it. */
  downloadCsv: async (kind: HostReportKind, period: ReportPeriod): Promise<Blob> => {
    try {
      const res = await axios.get<Blob>(`/reports/${kind}`, {
        params: { ...period, format: 'csv' },
        responseType: 'blob',
      });
      return res.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },
};
