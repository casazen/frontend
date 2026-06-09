import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function PublicOrgNotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Organizzazione non trovata</h1>
      <p className="max-w-md text-muted-foreground">
        Il sito di prenotazione che stai cercando non esiste o non è più disponibile.
      </p>
      <Button asChild variant="outline">
        <Link to="/search">Esplora altre strutture</Link>
      </Button>
    </div>
  );
}
