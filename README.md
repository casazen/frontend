# CasaZen — Webapp

Webapp per gestire immobili, prenotazioni, ospiti, adempimenti, affitti lunghi e richieste ai fornitori. Il lavoro in organizzazione usa aree, ruoli e assegnazioni sugli immobili; le funzioni visibili dipendono anche dalla configurazione del backend.

## Documentazione

- **Utenti:** dopo il login, aprire **Guida** (icona libro nell’intestazione di ogni area). La guida include ricerca, indice e istruzioni in italiano e inglese.
- [Indice documentazione](docs/README.md)
- [Sviluppo locale e configurazione](docs/technical/development.md)
- [Architettura e convenzioni](docs/technical/architecture.md)
- [Test e rilascio](docs/technical/testing.md)
- [Manutenzione della guida prodotto](docs/product/README.md)
- [API e runbook condivisi](https://github.com/casazen/backend/blob/develop/docs/index.md)

## Avvio rapido

Richiede Node.js 22 e npm (come in CI). Dal repository:

```bash
npm ci
```

Creare `.env.local` con i valori dell’ambiente di sviluppo:

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-spa-client-id
VITE_AUTH0_AUDIENCE=https://casazen-api
```

```bash
npm run dev
```

L’app parte su `http://localhost:5173`. Il backend è un repository separato. Per esplorare l’interfaccia con dati dimostrativi: `npm run dev:demo` ([limiti e configurazione](docs/technical/demo-mode.md)).

## Verifica

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Per i test browser e gli ambienti reali seguire [la guida test](docs/technical/testing.md). Una suite demo verde non verifica le credenziali o lo staging reale.

## Stack

React 19, TypeScript 5.9, Vite 8, React Router 7, TanStack Query 5, Zustand 5, Tailwind CSS 4, Radix UI, Auth0, Vitest e Playwright. Versioni e comandi effettivi sono in [package.json](package.json).
