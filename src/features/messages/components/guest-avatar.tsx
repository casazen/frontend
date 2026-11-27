import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GuestAvatar({ name, className }: { name?: string | null; className?: string }) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = [words[0], words.length > 1 ? words.at(-1) : undefined]
    .flatMap((word) => (word ? Array.from(word).slice(0, 1) : []))
    .join('')
    .toLocaleUpperCase();

  return (
    <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-semibold tracking-tight text-primary-text', className)}>
      {initials || <UserRound className="size-4" />}
    </span>
  );
}
