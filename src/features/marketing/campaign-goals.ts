import { CalendarDays, Gift, Heart, HeartHandshake, PenLine, Sparkles, type LucideIcon } from 'lucide-react';
import type { CalmTone } from '@/components/shared/calm/calm-tone';

export const GOAL_IDS = ['thanks', 'comeback', 'offer', 'event', 'loyal', 'custom'] as const;
export type GoalId = (typeof GOAL_IDS)[number];

export interface CampaignGoal {
  id: GoalId;
  icon: LucideIcon;
  tone: CalmTone;
  recipeId: string | null;
  needsDetails: boolean;
  needsEvent: boolean;
}

export const CAMPAIGN_GOALS: readonly CampaignGoal[] = [
  { id: 'thanks', icon: HeartHandshake, tone: 'success', recipeId: 'recent', needsDetails: false, needsEvent: false },
  { id: 'comeback', icon: Sparkles, tone: 'info', recipeId: 'lost', needsDetails: false, needsEvent: false },
  { id: 'offer', icon: Gift, tone: 'warning', recipeId: 'returning', needsDetails: true, needsEvent: false },
  { id: 'event', icon: CalendarDays, tone: 'neutral', recipeId: 'recent', needsDetails: false, needsEvent: true },
  { id: 'loyal', icon: Heart, tone: 'warning', recipeId: 'loyal', needsDetails: false, needsEvent: false },
  { id: 'custom', icon: PenLine, tone: 'neutral', recipeId: 'all', needsDetails: true, needsEvent: false },
];

export const goalById = (id: string | null): CampaignGoal | undefined => CAMPAIGN_GOALS.find((goal) => goal.id === id);

export const TONE_STEERS = ['shorter', 'warmer', 'formal'] as const;
export type ToneSteer = (typeof TONE_STEERS)[number];
