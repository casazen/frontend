const languages = ['it', 'en', 'de', 'fr', 'es'];
const copy = {
  loading: ["Caricamento dei servizi…", "Loading services…", "Dienste werden geladen…", "Chargement des services…", "Cargando servicios…"],
  unavailable: ["Servizi non disponibili per il soggiorno.", "Services are unavailable for this stay.", "Für diesen Aufenthalt sind keine Dienste verfügbar.", "Les services sont indisponibles pour ce séjour.", "Los servicios no están disponibles para esta estancia."],
  loadError: ["Impossibile caricare i servizi.", "Could not load services.", "Dienste konnten nicht geladen werden.", "Impossible de charger les services.", "No se pudieron cargar los servicios."],
  testMode: ["Ambiente di test. I pagamenti e i rimborsi sono simulati.", "Test environment. Payments and refunds are simulated.", "Testumgebung. Zahlungen und Erstattungen werden simuliert.", "Environnement de test. Les paiements et remboursements sont simulés.", "Entorno de prueba. Los pagos y reembolsos son simulados."],
  offers: ["Servizi disponibili", "Available services", "Verfügbare Dienste", "Services disponibles", "Servicios disponibles"],
  noOffers: ["Nessun servizio disponibile.", "No services available.", "Keine Dienste verfügbar.", "Aucun service disponible.", "No hay servicios disponibles."],
  orders: ["I tuoi ordini", "Your orders", "Deine Bestellungen", "Vos commandes", "Tus pedidos"],
  noOrders: ["Non hai ancora ordinato servizi.", "You have no orders yet.", "Du hast noch keine Bestellungen.", "Vous n’avez pas encore de commande.", "Todavía no tienes pedidos."],
  price: ["Prezzo del fornitore", "Supplier price", "Anbieterpreis", "Prix du prestataire", "Precio del proveedor"],
  fee: ["Commissione", "Commission", "Provision", "Commission", "Comisión"],
  total: ["Totale", "Total", "Gesamtbetrag", "Total", "Total"],
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
