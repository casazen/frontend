import type { PublicShowcaseContent } from '@/api/public-supplier.api';

export type ShowcaseState = 'Draft' | 'Online' | 'ChangesReady' | 'Paused';

export type ShowcaseDocument = PublicShowcaseContent & { serviceOrder?: string[] };

type ShowcaseReadinessLevel = 'ok' | 'warn' | 'todo';

export interface ShowcaseReadinessItem {
  code: string;
  level: ShowcaseReadinessLevel;
  required: boolean;
  target: string;
}

export type ShowcaseBlockedBy = 'not_published' | 'paused' | 'payments_off' | 'payments_account_not_ready' | 'bookings_off';

export interface ShowcaseContent {
  schemaVersion: number;
  state: ShowcaseState;
  version: number;
  draft: ShowcaseDocument;
  published: ShowcaseDocument | null;
  changes: string[];
  savedAt: string | null;
  publishedAt: string | null;
  pausedAt: string | null;
  undoUntil: string | null;
  readiness: { canPublish: boolean; items: ShowcaseReadinessItem[] };
  bookings: { open: boolean; blockedBy: ShowcaseBlockedBy[] };
  publicPath: string | null;
  publicUrl: string | null;
}

export type ShowcaseMediaKind = 'logo' | 'cover' | 'work' | 'before';

export interface ShowcaseMedia {
  id: string;
  kind: ShowcaseMediaKind;
  url: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  bytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface ShowcaseStats {
  days: number;
  requests: number;
  pending: number;
}

export type ShowcaseTextField = 'tagline' | 'intro' | 'bio' | 'prep';

export interface ShowcaseTextAnswers {
  about?: string;
  years?: string;
  specialties?: string;
  differentiator?: string;
}

export interface ShowcaseTextSuggestionRequest {
  fields?: ShowcaseTextField[];
  answers?: ShowcaseTextAnswers;
  regenerate?: boolean;
}

interface ShowcaseTextBasis {
  categories: string[];
  zones: string[];
  services: string[];
  answers: Array<keyof ShowcaseTextAnswers>;
}

export interface ShowcaseTextSuggestion {
  tagline?: string;
  intro?: string;
  bio?: string;
  prep: string[];
  basis: ShowcaseTextBasis;
  rejected: ShowcaseTextField[];
  aiUsed: boolean;
}

export interface ShowcaseTextSuggestionStatus {
  available: boolean;
}
