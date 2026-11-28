import { ApiClient } from '@/api/client';
import axios from '@/lib/axios';
import type {
  ShowcaseContent,
  ShowcaseMedia,
  ShowcaseMediaKind,
  ShowcaseStats,
  ShowcaseTextSuggestion,
  ShowcaseTextSuggestionRequest,
  ShowcaseTextSuggestionStatus,
} from '@/types/supplier-showcase';

const UPLOAD_TIMEOUT_MS = 120_000;

export interface UploadMediaOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export const supplierShowcaseApi = {
  getContent: () => ApiClient.get<ShowcaseContent>('/supplier/showcase/content'),

  saveDraft: (version: number, patch: Record<string, unknown>) =>
    ApiClient.patch<ShowcaseContent>('/supplier/showcase/content', { version, ...patch }),

  discard: (version?: number) =>
    ApiClient.post<ShowcaseContent>('/supplier/showcase/discard', version === undefined ? undefined : { version }),

  publish: (version?: number) =>
    ApiClient.post<ShowcaseContent>('/supplier/showcase/publish', version === undefined ? undefined : { version }),

  undoPublish: () => ApiClient.post<ShowcaseContent>('/supplier/showcase/publish/undo'),

  pause: () => ApiClient.post<ShowcaseContent>('/supplier/showcase/pause'),

  resume: () => ApiClient.post<ShowcaseContent>('/supplier/showcase/resume'),

  getStats: () => ApiClient.get<ShowcaseStats>('/supplier/showcase/stats'),

  getTextSuggestionStatus: () => ApiClient.get<ShowcaseTextSuggestionStatus>('/supplier/showcase/texts/suggestion/status'),

  suggestTexts: (request: ShowcaseTextSuggestionRequest) =>
    ApiClient.post<ShowcaseTextSuggestion>('/supplier/showcase/texts/suggestion', request),

  async uploadMedia(kind: ShowcaseMediaKind, file: File, options: UploadMediaOptions = {}): Promise<ShowcaseMedia> {
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file, file.name);
    const response = await axios.post<ShowcaseMedia>('/supplier/showcase/media', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
      signal: options.signal,
      onUploadProgress: (event) => {
        if (event.total) options.onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      },
    });
    return response.data;
  },
};
