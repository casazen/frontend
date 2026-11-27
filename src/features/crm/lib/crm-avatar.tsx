import { UserRound } from 'lucide-react';
import { CALM_TONES, TONE_STYLES } from '@/components/shared/calm/calm-tone';
import { cn } from '@/lib/utils';

// Red reads as an alert: a guest is never tinted with it.
const AVATAR_TONES = CALM_TONES.filter((tone) => tone !== 'danger');

function hashOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return hash;
}

interface CrmAvatarProps {
  name?: string | null;
  className?: string;
}

export function CrmAvatar({ name, className }: CrmAvatarProps) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = [words[0], words.length > 1 ? words.at(-1) : undefined]
    .flatMap((word) => (word ? Array.from(word).slice(0, 1) : []))
    .join('')
    .toLocaleUpperCase();
  const tone = TONE_STYLES[AVATAR_TONES[hashOf(words.join(' ').toLocaleLowerCase()) % AVATAR_TONES.length]];

  return (
    <span
      aria-hidden="true"
      data-testid="crm-avatar"
      className={cn('grid size-10 shrink-0 place-items-center rounded-xl text-sm font-semibold tracking-tight', tone.badge, tone.accent, className)}
    >
      {initials || <UserRound className="size-4" />}
    </span>
  );
}
