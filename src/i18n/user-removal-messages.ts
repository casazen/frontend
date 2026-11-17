export const userRemovalMessages = {
  it: {
    failureTitle: 'Account non rimosso',
    tokenFailed: 'CasaZen non riesce a ottenere il token di gestione Auth0. Verifica la configurazione del servizio e la raggiungibilità prima di riprovare.',
    credentialsRejected: 'Auth0 ha rifiutato la configurazione del servizio. Un amministratore tecnico deve verificare client, credenziali, dominio e autorizzazione Management API.',
    deleteNotAllowed: 'Il servizio non è autorizzato a rimuovere account in Auth0. Un amministratore tecnico deve verificare il permesso delete:users. L’account non è stato rimosso.',
    alternative: 'Se devi bloccare subito l’accesso a CasaZen, chiudi questa finestra e usa Disattiva nella riga dell’utente.',
  },
  en: {
    failureTitle: 'Account was not removed',
    tokenFailed: 'CasaZen could not obtain an Auth0 management token. Check the service configuration and connectivity before retrying.',
    credentialsRejected: 'Auth0 rejected the service configuration. A technical administrator must check the client, credentials, domain and Management API authorization.',
    deleteNotAllowed: 'The service is not authorized to remove Auth0 accounts. A technical administrator must check the delete:users permission. The account was not removed.',
    alternative: 'To block CasaZen access immediately, close this dialog and use Deactivate in the user’s row.',
  },
};
