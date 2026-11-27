import type { GuestRegistration, GuestRegistrationRegime } from '@/types/guest-registration.types';
import type { SwissPlace } from '@/types/swiss-places.types';

/** The property the cards of these tests are about. */
export const PROPERTY_ID = '5b1c0e5a-7f43-4d7e-9a41-2c6f1d8a9b10';

/** The texts of a regime come from the server in the language of the request: these are the words of a test, not of a catalog. */
export const TICINO_SUMMARY = 'In Ticino ogni ospite va notificato alla polizia cantonale entro 24 ore: CasaZen prepara il file e tu lo carichi sul portale.';

/** The regime of Ticino (verified, a file to upload on the official portal), unless a test changes what it is about. */
export function regime(overrides: Partial<GuestRegistrationRegime> = {}): GuestRegistrationRegime {
  return {
    code: 'CH-TI',
    countryCode: 'CH',
    cantonCode: 'TI',
    obligation: 'ReportToAuthority',
    channel: 'PortalFileUpload',
    deadlineKind: 'Hours24FromArrival',
    deadlineNote: null,
    retentionYears: 5,
    privateRentals: 'Yes',
    portalUrl: 'https://www.notifiche.ti.ch/portale',
    verifiedOn: '2026-11-20',
    certainty: 'Verified',
    casaZenSupport: 'FileExport',
    retainDocumentImages: false,
    summary: TICINO_SUMMARY,
    ...overrides,
  };
}

export const LUGANO: SwissPlace = { municipalityCode: '5192', municipalityName: 'Lugano', cantonCode: 'TI', source: 'Stored', ambiguous: false };

/** The card of a property in Ticino: the duty is raised, nothing is missing. */
export function card(overrides: Partial<GuestRegistration> = {}): GuestRegistration {
  return { regime: regime(), effectiveDuty: 'Required', override: null, place: LUGANO, identifierMissing: [], ...overrides };
}

/** A canton whose sources do not say that the rule covers a private home (partly verified): the duty is the host's to decide. */
export function zurichCard(overrides: Partial<GuestRegistration> = {}): GuestRegistration {
  return card({
    regime: regime({
      code: 'CH-ZH',
      cantonCode: 'ZH',
      deadlineKind: 'None',
      deadlineNote: 'La scadenza non è verificata: chiedi alla polizia cantonale.',
      retentionYears: null,
      privateRentals: 'Unknown',
      certainty: 'Partial',
      casaZenSupport: 'AssistedNotification',
      portalUrl: 'https://www.kapo.zh.ch/hotelkontrolle',
      summary: 'A Zurigo la notifica elettronica è prevista, ma le fonti non dicono se vale per chi affitta una casa privata.',
    }),
    effectiveDuty: 'Ask',
    place: { municipalityCode: '261', municipalityName: 'Zurigo', cantonCode: 'ZH', source: 'Stored', ambiguous: false },
    ...overrides,
  });
}

/** A Swiss property whose municipality is not known (the postal code leaves several open): no canton is chosen for it. */
export function unknownPlaceCard(overrides: Partial<GuestRegistration> = {}): GuestRegistration {
  return card({
    regime: regime({
      code: 'CH-UNKNOWN',
      cantonCode: null,
      obligation: 'Unknown',
      channel: 'None',
      deadlineKind: 'None',
      retentionYears: null,
      privateRentals: 'Unknown',
      portalUrl: null,
      certainty: 'Unverified',
      casaZenSupport: 'InformationOnly',
      summary: 'Senza il comune non sappiamo quali regole valgono per questa struttura.',
    }),
    effectiveDuty: 'Ask',
    place: { municipalityCode: null, municipalityName: null, cantonCode: null, source: 'Derived', ambiguous: true },
    identifierMissing: ['swiss_municipality_missing'],
    ...overrides,
  });
}
