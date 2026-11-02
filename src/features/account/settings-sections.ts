/** The sections of the settings of the account, as `?section=` names them (AM-08b-e). */
export const SETTINGS_SECTIONS = ['company', 'payments', 'billing', 'privacy'] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/** The id of the element of a section: where `?section=` scrolls to. */
export const settingsSectionId = (section: SettingsSection): string => `settings-${section}`;

/** The section the address asks for, or `undefined` for a value that is none of them (it is ignored). */
export function settingsSectionOf(value: string | null): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section === value);
}
