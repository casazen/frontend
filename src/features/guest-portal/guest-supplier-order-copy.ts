const languages = ['it', 'en', 'de', 'fr', 'es'];
const copy = {
  loading: ["Caricamento dei servizi…", "Loading services…", "Dienste werden geladen…", "Chargement des services…", "Cargando servicios…"],
  unavailable: ["Servizi non disponibili per il soggiorno.", "Services are unavailable for this stay.", "Für diesen Aufenthalt sind keine Dienste verfügbar.", "Les services sont indisponibles pour ce séjour.", "Los servicios no están disponibles para esta estancia."],
  loadError: ["Impossibile caricare i servizi.", "Could not load services.", "Dienste konnten nicht geladen werden.", "Impossible de charger les services.", "No se pudieron cargar los servicios."],
  sandboxMode: ["Ambiente Stripe di prova. Usa una carta di test per autorizzare servizi nelle prossime 48 ore.", "Stripe sandbox. Use a test card to authorize services within the next 48 hours.", "Stripe-Testumgebung. Autorisiere mit einer Testkarte Leistungen innerhalb der nächsten 48 Stunden.", "Environnement de test Stripe. Utilisez une carte de test pour autoriser les services dans les 48 prochaines heures.", "Entorno de prueba de Stripe. Usa una tarjeta de prueba para autorizar servicios en las próximas 48 horas."],
  authorizeCard: ["Autorizza importo con carta di test", "Authorize with test card", "Mit Testkarte autorisieren", "Autoriser avec la carte de test", "Autorizar con tarjeta de prueba"],
  checking: ["Verifica autorizzazione…", "Checking authorization…", "Autorisierung wird geprüft…", "Vérification de l’autorisation…", "Verificando autorización…"],
  paymentError: ["Impossibile verificare l’autorizzazione. Riprova.", "Could not verify authorization. Please retry.", "Autorisierung konnte nicht geprüft werden. Versuche es erneut.", "Impossible de vérifier l’autorisation. Réessayez.", "No se pudo verificar la autorización. Inténtalo de nuevo."],
  notAuthorized: ["L’autorizzazione non è ancora confermata.", "Authorization has not been confirmed yet.", "Die Autorisierung wurde noch nicht bestätigt.", "L’autorisation n’est pas encore confirmée.", "La autorización aún no está confirmada."],
  verify: ["Verifica stato", "Check status", "Status prüfen", "Vérifier le statut", "Verificar estado"],
  sandboxTime: ["Scegli un orario nelle prossime 48 ore.", "Choose a time within the next 48 hours.", "Wähle einen Zeitpunkt innerhalb der nächsten 48 Stunden.", "Choisissez un horaire dans les 48 prochaines heures.", "Elige una hora en las próximas 48 horas."],
  invalidTime: ["Verifica la data e l’ora.", "Check the date and time.", "Prüfe Datum und Uhrzeit.", "Vérifiez la date et l’heure.", "Comprueba la fecha y la hora."],
  testMode: ["Ambiente di test. I pagamenti e i rimborsi sono simulati.", "Test environment. Payments and refunds are simulated.", "Testumgebung. Zahlungen und Erstattungen werden simuliert.", "Environnement de test. Les paiements et remboursements sont simulés.", "Entorno de prueba. Los pagos y reembolsos son simulados."],
  offers: ["Servizi disponibili", "Available services", "Verfügbare Dienste", "Services disponibles", "Servicios disponibles"],
  noOffers: ["Nessun servizio disponibile.", "No services available.", "Keine Dienste verfügbar.", "Aucun service disponible.", "No hay servicios disponibles."],
  orders: ["I tuoi ordini", "Your orders", "Deine Bestellungen", "Vos commandes", "Tus pedidos"],
  noOrders: ["Non hai ancora ordinato servizi.", "You have no orders yet.", "Du hast noch keine Bestellungen.", "Vous n’avez pas encore de commande.", "Todavía no tienes pedidos."],
  price: ["Prezzo del fornitore", "Supplier price", "Anbieterpreis", "Prix du prestataire", "Precio del proveedor"],
  fee: ["Commissione", "Commission", "Provision", "Commission", "Comisión"],
  total: ["Totale", "Total", "Gesamtbetrag", "Total", "Total"],
  refundProcessing: ["Rimborso in elaborazione", "Refund processing", "Erstattung in Bearbeitung", "Remboursement en cours", "Reembolso en curso"],
  refundReview: ["Rimborso in verifica", "Refund under review", "Erstattung wird geprüft", "Remboursement en vérification", "Reembolso en revisión"],
  refundFailed: ["Rimborso non riuscito", "Refund failed", "Erstattung fehlgeschlagen", "Échec du remboursement", "Error en el reembolso"],
  refund: ["Rimborso", "Refund", "Erstattung", "Remboursement", "Reembolso"],
  authorize: ["Simula autorizzazione", "Simulate authorization", "Autorisierung simulieren", "Simuler l’autorisation", "Simular autorización"],
  problem: ["Descrivi il problema", "Describe the problem", "Beschreibe das Problem", "Décrivez le problème", "Describe el problema"],
  dispute: ["Apri controversia", "Open a dispute", "Reklamation einreichen", "Ouvrir un litige", "Abrir una disputa"],
  complaint: ["Segnalazione", "Complaint", "Reklamation", "Réclamation", "Reclamación"],
  decision: ["Decisione", "Decision", "Entscheidung", "Décision", "Decisión"],
  failed: ["Operazione non riuscita. Ricarica la pagina e verifica lo stato dell’ordine.", "Something went wrong. Reload and check your order status.", "Vorgang fehlgeschlagen. Lade die Seite neu und prüfe den Bestellstatus.", "L’opération a échoué. Rechargez la page et vérifiez la commande.", "La operación falló. Recarga la página y comprueba tu pedido."],
  quote: ["Su preventivo", "Price on request", "Preis auf Anfrage", "Sur devis", "Precio bajo consulta"],
  date: ["Data", "Date", "Datum", "Date", "Fecha"],
  time: ["Ora italiana", "Time in Italy", "Uhrzeit in Italien", "Heure en Italie", "Hora de Italia"],
  note: ["Note per il fornitore", "Notes for the supplier", "Hinweise für den Anbieter", "Notes pour le prestataire", "Notas para el proveedor"],
  request: ["Richiedi preventivo", "Request a quote", "Angebot anfordern", "Demander un devis", "Solicitar presupuesto"],
  prepare: ["Prepara ordine", "Prepare order", "Bestellung vorbereiten", "Préparer la commande", "Preparar pedido"],
  PendingQuote: ["Preventivo in attesa", "Awaiting quote", "Angebot ausstehend", "Devis en attente", "Presupuesto pendiente"],
  Quoted: ["Da confermare", "Awaiting confirmation", "Bestätigung ausstehend", "À confirmer", "Pendiente de confirmación"],
  Authorized: ["Importo autorizzato", "Amount authorized", "Betrag autorisiert", "Montant autorisé", "Importe autorizado"],
  CardSaved: ["Carta di test registrata", "Test card saved", "Testkarte gespeichert", "Carte de test enregistrée", "Tarjeta de prueba guardada"],
  Accepted: ["Prenotato", "Booked", "Gebucht", "Réservé", "Reservado"],
  Declined: ["Rifiutato", "Declined", "Abgelehnt", "Refusé", "Rechazado"],
  Completed: ["Servizio completato", "Service completed", "Dienst abgeschlossen", "Service terminé", "Servicio completado"],
  Disputed: ["Controversia aperta", "Dispute open", "Reklamation offen", "Litige ouvert", "Disputa abierta"],
  Resolved: ["Controversia risolta", "Dispute resolved", "Reklamation abgeschlossen", "Litige résolu", "Disputa resuelta"],
  Released: ["Pagamento rilasciato", "Payment released", "Zahlung freigegeben", "Paiement débloqué", "Pago liberado"],
} satisfies Record<string, [string, string, string, string, string]>;

export function supplierOrderText(language: string) {
  const index = Math.max(0, languages.indexOf(language));
  return (key: keyof typeof copy) => copy[key][index];
}

export function supplierOrderState(state: string, language: string) {
  return Object.hasOwn(copy, state) ? supplierOrderText(language)(state as keyof typeof copy) : state;
}
