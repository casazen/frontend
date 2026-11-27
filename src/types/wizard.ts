export type WizardType =
  | 'ListingCreate'
  | 'ListingEdit'
  | 'BookingCreate'
  | 'BookingEdit'
  | 'CheckIn'
  | 'CheckOut'
  | 'ComplianceSender'
  | 'TouristTax'
  | 'OnboardingActivation'
  | 'OnboardingBulk';

export interface ServerWizardDraft {
  type: WizardType;
  entityId: string | null;
  version: number;
  /**
   * What the client saved, a JSON object. The web wizards write `{ shape, step, values }`: the version of the shape of the values
   * (`UseWizardDraftOptions.version`), the id of the step and the answers. The server stores the fields that name a person
   * (`WizardDraftPiiFields`) encrypted and gives them back in place.
   */
  data: Record<string, unknown>;
  lastSavedAt: string;
}

/**
 * The answer of a save (`POST /wizards/{type}/draft`): saved, with the new version and the time of the server, or in conflict because
 * another device or tab saved first and nothing was written. `serverDraft` is `null` only when the server has none left to show.
 */
export type SaveWizardDraftResult =
  | { status: 'saved'; version: number; lastSavedAt: string }
  | { status: 'conflict'; serverDraft: ServerWizardDraft | null; serverVersion: number };

export type WizardSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';
