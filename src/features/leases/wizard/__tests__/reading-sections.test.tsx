import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { renderAt } from '../../__tests__/lease-test-utils';
import { ReadingBanner } from '../reading-marks';
import { emptyFlow } from '../wizard-model';
import type { LeaseReading } from '@/types';

// CF-DOCS-REAL: after the reading of the file the guided service delivers (the contract, its attestation and its calculation sheet in one
// scan) the screen says what it recognized, in the words of a person, and what is worth a second look; it never shows a value.
function reading(overrides: Partial<LeaseReading['documents'][number]> = {}): LeaseReading {
  return {
    state: 'Done',
    documents: [
      {
        id: 'doc-1',
        fileName: 'contratto.pdf',
        status: 'Completed',
        error: null,
        sections: [
          { kind: 'contract', firstPage: 1, lastPage: 6 },
          { kind: 'attestation', firstPage: 7, lastPage: 10 },
          { kind: 'calculationSheet', firstPage: 11, lastPage: 14 },
        ],
        containsAttestation: true,
        containsCalculationSheet: true,
        warnings: [],
        ...overrides,
      },
    ],
    fields: [{ field: 'monthlyRent', partyId: null, role: null, state: 'Read', confidence: 95, derived: false }],
    stipulaDate: null,
    contractDocumentId: 'doc-1',
  };
}

function renderBanner(value: LeaseReading) {
  return renderAt('/x', '/x', <ReadingBanner reading={value} flow={emptyFlow('Imported')} />);
}

describe('ReadingBanner — what the file turned out to hold (CF-DOCS-REAL)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => cleanup());

  it('render_FileWithTheThreeSections_SaysWhatItRecognizedWithThePages_AndNoWarningBoxWhenAllAgrees', () => {
    renderBanner(reading());

    expect(screen.getByTestId('lease-reading-recognized')).toHaveTextContent(
      'Nel file abbiamo riconosciuto: Contratto (pp. 1–6), attestazione (pp. 7–10), scheda di calcolo (pp. 11–14).',
    );
    expect(screen.queryByTestId('lease-reading-warnings')).not.toBeInTheDocument();
  });

  it('render_Warnings_AreToldInPlainWordsWithTheirPages_AndNeverBlockTheWizard', () => {
    renderBanner(
      reading({
        warnings: [
          { code: 'pages_unreadable', pages: [3, 9] },
          { code: 'attestation_rent_differs', pages: null },
          { code: 'a_code_the_screen_does_not_know', pages: null },
        ],
      }),
    );

    const box = screen.getByTestId('lease-reading-warnings');
    expect(within(box).getByTestId('lease-reading-warning-pages_unreadable')).toHaveTextContent('Alcune pagine non si leggono bene (pagine 3, 9)');
    expect(within(box).getByTestId('lease-reading-warning-attestation_rent_differs')).toHaveTextContent('Il canone attestato non è quello del contratto.');
    expect(within(box).getByTestId('lease-reading-warning-a_code_the_screen_does_not_know')).toHaveTextContent('C\'è qualcosa da controllare nel file.');
    // The line that says the data were filled in is still there: a warning asks for a look, it does not stop anything.
    expect(screen.getByTestId('lease-reading-done')).toBeInTheDocument();
  });

  it('render_ContractWithNoAttestation_IsOneContract_NothingWrongWithIt', () => {
    renderBanner(reading({ sections: [{ kind: 'contract', firstPage: 1, lastPage: 3 }], containsAttestation: false, containsCalculationSheet: false }));

    expect(screen.getByTestId('lease-reading-recognized')).toHaveTextContent('Nel file abbiamo riconosciuto: Contratto (pp. 1–3).');
    expect(screen.queryByTestId('lease-reading-warnings')).not.toBeInTheDocument();
  });
});
