import { useLocation, useNavigate } from 'react-router-dom';
import { CommandPaletteTrigger } from '../command-palette-trigger';

export function HarnessPage({ extra }: { extra: React.ReactNode }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <header>
        <CommandPaletteTrigger />
      </header>
      <main>
        <p data-testid="location">{`${pathname}${search}`}</p>
        <input aria-label="Un campo della pagina" data-testid="page-field" />
        <button type="button" onClick={() => navigate('/app/short-rent/elsewhere')}>
          Cambia pagina
        </button>
        <button type="button" onClick={() => navigate(-1)}>
          Torna indietro
        </button>
        {extra}
      </main>
    </>
  );
}
