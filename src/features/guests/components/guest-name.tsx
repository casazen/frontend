import type { GuestSummary } from '@/types';

export function GuestName({ guest }: { guest: GuestSummary }) {
  const initials = [guest.firstName, guest.lastName].map((part) => Array.from(part?.trim() ?? '')[0] ?? '').join('').toLocaleUpperCase();
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary-text">{initials}</span>
      <span className="min-w-0 break-words font-semibold">{guest.firstName} {guest.lastName}</span>
    </span>
  );
}
