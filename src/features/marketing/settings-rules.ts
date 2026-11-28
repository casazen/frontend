import { Gem, Heart, PartyPopper, Zap, type LucideIcon } from 'lucide-react';

type VoiceStyleId = 'warm' | 'elegant' | 'direct' | 'playful';

export const VOICE_STYLES: ReadonlyArray<{ id: VoiceStyleId; icon: LucideIcon }> = [
  { id: 'warm', icon: Heart },
  { id: 'elegant', icon: Gem },
  { id: 'direct', icon: Zap },
  { id: 'playful', icon: PartyPopper },
];

export const MONTHLY_LIMITS = [0, 1, 2] as const;
export const LOYAL_STAYS_CHOICES = [2, 3, 4, 5, 10] as const;
export const LOST_MONTHS_CHOICES = [6, 12, 18, 24, 36] as const;
export const CADENCE_CHOICES = [7, 14, 30, 60, 90] as const;
export const CADENCE_KEYS: Record<(typeof CADENCE_CHOICES)[number], string> = { 7: 'week', 14: 'twoWeeks', 30: 'month', 60: 'twoMonths', 90: 'threeMonths' };
export const NEWSLETTER_TOPICS = ['news', 'events', 'season', 'offer'] as const;

export function withCurrent(choices: readonly number[], current: number): number[] {
  return choices.includes(current) ? [...choices] : [...choices, current].sort((a, b) => a - b);
}

export function isPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && url.hostname.includes('.') && !url.username && !url.password && value.trim().length <= 2000;
  } catch {
    return false;
  }
}

export function cleanEntries(entries: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => value.trim() !== '').map(([key, value]) => [key, value.trim()]));
}

export function addLine(text: string, line: string): string {
  if (text.includes(line)) return text;
  return text.trim() === '' ? line : `${text.trimEnd()}\n${line}`;
}
