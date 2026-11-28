export const SETTINGS_SECTIONS = ['company', 'payments', 'billing', 'privacy'] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const settingsSectionId = (section: SettingsSection): string => `settings-${section}`;

export function settingsSectionOf(value: string | null): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section === value);
}
