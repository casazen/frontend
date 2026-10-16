import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';

/** The initials of a person in a circle: the backend keeps no photo of a person, so none is shown. The name is next to it. */
export function PersonAvatar({ name }: { name: string }) {
  return (
    <Avatar className="size-9">
      <AvatarFallback aria-hidden="true" className="text-xs font-semibold">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
