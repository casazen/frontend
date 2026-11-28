export interface SwissLocality {
  postalCode: string;
  name: string;
  municipalityCode: string;
  municipalityName: string;
  cantonCode: string;
}

export interface SwissMunicipality {
  municipalityCode: string;
  name: string;
  cantonCode: string;
}

type SwissPlaceSource = 'Stored' | 'Derived';

export interface SwissPlace {
  municipalityCode: string | null;
  municipalityName: string | null;
  cantonCode: string | null;
  source: SwissPlaceSource;
  ambiguous: boolean;
}
