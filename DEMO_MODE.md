# 🎭 CASAZEN Demo Mode

## Panoramica

CASAZEN supporta due modalità di esecuzione:

1. **Modalità Normale**: Richiede autenticazione Auth0
2. **Modalità Demo**: Salta l'autenticazione per dimostrazioni e test

## Come Usare la Demo Mode

### Avvio in modalità demo

```bash
npm run dev:demo
```

### Avvio in modalità normale (con autenticazione)

```bash
npm run dev
```

## Build per la produzione

### Build normale (con autenticazione)

```bash
npm run build
```

### Build demo (senza autenticazione)

```bash
npm run build:demo
```

## Cosa Cambia in Demo Mode

- ✅ **Nessun login richiesto**: L'app si apre direttamente sulla dashboard
- ✅ **Utente demo**: Viene simulato un utente "Demo User" (demo@casazen.com)
- ✅ **Banner visibile**: Un banner giallo in alto indica che l'app è in modalità demo
- ✅ **Tutte le funzionalità accessibili**: Puoi navigare in tutte le sezioni dell'app
- ⚠️ **Nessuna chiamata API reale**: Le chiamate API non includeranno token di autenticazione

## Configurazione

La modalità demo è controllata dalla variabile d'ambiente `VITE_DEMO_MODE`:

- `VITE_DEMO_MODE=true` → Modalità demo attiva
- `VITE_DEMO_MODE=false` → Modalità normale (default)

## Quando Usare la Demo Mode

- 🎯 **Presentazioni**: Mostrare l'app a clienti o stakeholder
- 🔧 **Sviluppo UI**: Testare componenti senza configurare Auth0
- 🎨 **Design review**: Valutare l'interfaccia utente
- 📸 **Screenshot**: Catturare schermate per documentazione

## Note Importanti

- La demo mode **NON** deve essere usata in produzione con dati reali
- La demo mode bypassa completamente l'autenticazione
- I dati visualizzati in demo mode sono simulati
