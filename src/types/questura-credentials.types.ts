/**
 * Alloggiati Web (Questura) credentials of a property (CO-14): write-only. The API never returns a value, only whether
 * they are configured and since when (backend QuesturaCredentialsStatusDto).
 */
export interface QuesturaCredentialsStatus {
  configured: boolean;
  /** When the credentials were last set (UTC ISO string); null when not configured. */
  configuredAt: string | null;
}

/** Body of PUT /api/properties/{id}/questura-credentials: all three values, every time. */
export interface SetQuesturaCredentialsRequest {
  username: string;
  password: string;
  wsKey: string;
}

/** Maximum lengths accepted by the API (PropertyQuesturaCredentials.Max*Length). */
export const QUESTURA_CREDENTIALS_MAX_LENGTH = {
  username: 100,
  password: 200,
  wsKey: 200,
} as const;
