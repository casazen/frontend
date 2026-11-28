import type { UserDetail } from '@/types';

export function commercialModuleForPath(path: string): string | null {
  if (/\/(?:integrations\/octorate|channels|ota)(?:\/|$)/.test(path)) return 'channels';
  if (/\/(?:settings\/(?:domain|embed|site-appearance|site-documents|payments)|vetrina)(?:\/|$)/.test(path)) return 'direct-booking';
  if (/\/compliance\/identification(?:\/|$)|\/verifications(?:\/|$)/.test(path)) return 'identification';
  if (/\/(?:compliance|alloggiati)(?:\/|$)/.test(path)) return 'compliance';
  if (/\/automations(?:\/|$)/.test(path)) return 'ai-agents';
  if (/\/settings\/assistant(?:\/|$)/.test(path)) return 'messages-ai';
  if (/\/(?:interventions|service-requests)(?:\/|$)/.test(path)) return 'operations';
  if (/\/(?:fiscal|accountant)(?:\/|$)/.test(path)) return 'fiscal';
  if (/\/properties\/:id\/pricing(?:\/|$)/.test(path)) return 'revenue';
  if (/\/crm(?:\/|$)/.test(path)) return 'crm';
  return null;
}
export function commercialRouteAllowed(profile: UserDetail | null | undefined, path: string) {
  if (!profile?.commercialSignup) return true;
  const module = commercialModuleForPath(path);
  return !module || profile.commercialEnabledAddons?.includes(module) === true;
}

export function commercialPartAllowed(profile: UserDetail | null | undefined, part: string): boolean {
  if (!profile?.commercialSignup) return true;
  const modules: Record<string, string> = { octorateConnection: 'channels', channels: 'channels', listings: 'channels', prices: 'revenue', pricesRules: 'revenue', compliance: 'compliance', guestRegistration: 'compliance', identification: 'identification', messagesAi: 'messages-ai', fiscalDocuments: 'fiscal', partners: 'operations' };
  const module = modules[part];
  return !module || profile.commercialEnabledAddons?.includes(module) === true;
}
