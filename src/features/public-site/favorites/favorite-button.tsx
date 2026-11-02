import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFavorites } from './use-favorites';
import '../components/public-site-chrome.css';

/**
 * The heart of a home (DB-02b): saves it on this device for later, or forgets it. A button that is pressed or not (`aria-pressed`)
 * named after the home ("Salva Casa del Faro nei preferiti"), 44 px, in the colors of the theme, with a small pop when it is
 * saved (none with `prefers-reduced-motion`). The first home a guest saves says where the list is ("la ritrovi dal cuore in alto")
 * and offers to undo, as the prototype does. Position it from outside (`className`): it sits on the photo of a card, or next to
 * the title of a page.
 */
export function FavoriteButton({
  site,
  propertyId,
  propertyName,
  className,
}: {
  /** The slug of the booking site: the list is kept for each site. */
  site: string;
  propertyId: string;
  propertyName: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { ids, toggle } = useFavorites(site);
  const saved = ids.includes(propertyId);
  const [popping, setPopping] = useState(false);

  const press = () => {
    const first = ids.length === 0;
    if (!toggle(propertyId)) return;
    setPopping(true);
    if (first) {
      toast(t('favorites.saved'), {
        description: t('favorites.savedHint'),
        action: { label: t('favorites.undo'), onClick: () => toggle(propertyId) },
      });
    }
  };

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? t('favorites.remove', { name: propertyName }) : t('favorites.add', { name: propertyName })}
      className={cn('public-heart grid place-items-center', popping && 'is-pop', className)}
      onClick={press}
      onAnimationEnd={() => setPopping(false)}
      data-testid="favorite-button"
    >
      <Heart className="h-5 w-5" aria-hidden />
    </button>
  );
}
