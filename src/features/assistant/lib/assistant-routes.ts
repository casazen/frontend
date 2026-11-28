export const ASSISTANT_SETTINGS_PATH = '/app/short-rent/settings/assistant';

export const TODO_LIST_PATH = '/app/short-rent/activities';

export const ASSISTANT_TABS = ['rules', 'properties', 'situations'] as const;

export type AssistantTab = (typeof ASSISTANT_TABS)[number];
