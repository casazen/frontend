import { EmbedGuestAccessForm } from '@/features/embed/guest-access/embed-guest-access-form';

export function GuestAccessWidget() {
  return (
    <div data-testid="embed-widget-guest-access">
      <EmbedGuestAccessForm />
    </div>
  );
}
