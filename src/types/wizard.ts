/**
 * The copy of a wizard draft that the server keeps (ADR-024, `WizardDraftsController`): the person finds it again on any device.
 * The browser copy of the same draft is `WizardDraft` in `@/lib/wizard-draft`.
 */

/**
 * The wizards whose draft the server keeps, by the member name of the backend enum `Casazen.Core/Entities/Enums/WizardType.cs`
 * (the API speaks the name, `/wizards/{type}/draft`). The backend appends a value when a wizard joins (E03, E10): add the same
 * name here, in the same order.
 */
export type WizardType =
  | 'ListingCreate'
  | 'ListingEdit'
  | 'BookingCreate'
  | 'BookingEdit'
  | 'CheckIn'
  | 'CheckOut'
  | 'ComplianceSender'
  | 'TouristTax';

/** A draft as the server holds it (`GET /wizards/{type}/draft`). */
export interface ServerWizardDraft {
  type: WizardType;
  /** What the wizard edits (the property, the booking...); `null` for a wizard that creates something. */
  entityId: string | null;
  /** The counter of the draft: the `clientVersion` of the next save is the one the client last saw. */
  version: number;
  /**
   * What the client saved, a JSON object. The web wizards write `{ shape, step, values }`: the version of the shape of the values
   * (`UseWizardDraftOptions.version`), the id of the step and the answers. The server stores the fields that name a person
   * (`WizardDraftPiiFields`) encrypted and gives them back in place.
   */
  data: Record<string, unknown>;
  /** UTC instant (ISO 8601) of the last save: the «saved at» of the screen. */
  lastSavedAt: string;
}

/**
 * The answer of a save (`POST /wizards/{type}/draft`): saved, with the new version and the time of the server, or in conflict because
 * another device or tab saved first and nothing was written. `serverDraft` is `null` only when the server has none left to show.
 */
export type SaveWizardDraftResult =
  | { status: 'saved'; version: number; lastSavedAt: string }
  | { status: 'conflict'; serverDraft: ServerWizardDraft | null; serverVersion: number };

/**
 * Where the saving of the draft stands, for the person (`aria-live`): nothing yet, a change waiting, a request on its way, saved, not
 * saved (it will be tried again), or stopped until the person chooses between the two versions (`conflict`).
 */
export type WizardSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';
