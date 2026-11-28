import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';

export function PersonAvatar({ name }: { name: string }) {
  return (
    <Avatar className="size-9">
      <AvatarFallback aria-hidden="true" className="text-xs font-semibold">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
