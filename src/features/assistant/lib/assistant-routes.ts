/** The page of the settings of the assistant (E05/F05/US04/T02, behind the flag `messageAssistant`): the rules, the properties and the situations. */
export const ASSISTANT_SETTINGS_PATH = '/app/short-rent/settings/assistant';

/** The list of what the system asks of the host («To do»): where an escalated message waits. */
export const TODO_LIST_PATH = '/app/short-rent/activities';

/** The tabs of the settings of the assistant (`?tab=`), in the order they are shown; the first is the one of the bare address. */
export const ASSISTANT_TABS = ['rules', 'properties', 'situations'] as const;

/** A tab of {@link ASSISTANT_TABS}. */
export type AssistantTab = (typeof ASSISTANT_TABS)[number];
