import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { OwnerPortalShell } from '@/features/owner-portal/owner-portal-shell';
import { formatMoney, isInformationalLine, portalFeeNoteOf, shownLineAmount, type PortalFeeNote } from '@/features/owner-portal/owner-statement-model';
import { StatementSectionBlock } from '@/features/owner-portal/statement-parts';
import type { OwnerPortalStatement, OwnerPortalStatementLine, OwnerPortalStatementSection } from '@/types';
import { OwnerStatementDetail } from '../OwnerStatementDetail';
import { CHF_STATEMENT, statementDetail, statementLine } from './owner-statement-fixtures';

vi.mock('@/api/ownerPortal.api', () => ({
  ownerPortalApi: {
    getStatement: vi.fn(),
    listContacts: vi.fn(),
    downloadStatementPdf: vi.fn(),
  },
}));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

import { ownerPortalApi } from '@/api/ownerPortal.api';

const api = vi.mocked(ownerPortalApi);

const plain = (value: string | null) => (value ?? '').replace(/\s/g, ' ');

const STATEMENT: OwnerPortalStatement = {
  ...CHF_STATEMENT,
  totals: { gross: 450, channelFees: 0, withholding: 0, commission: -103.77, charges: -80, corrections: 0, net: 266.23, payments: 0, openingBalance: 0, closingBalance: 266.23 },
};
const BORNE = statementLine('l-borne', {
  type: 'ChannelFeeBorneByAgency',
  sharePercent: 50,
  amount: -67.5,
  channelFeeBilledToAgencyNotRecharged: true,
  informational: true,
});
const SECTIONS: OwnerPortalStatementSection[] = [
  { section: 'stays', total: 450, lines: [statementLine('l1', { amount: 450, sharePercent: 50 })] },
  { section: 'channelFees', total: 0, lines: [BORNE] },
  { section: 'withholding', total: 0, lines: [] },
  { section: 'commission', total: -103.77, lines: [statementLine('l3', { type: 'AgencyCommission', checkIn: null, checkOut: null, bookingCode: null, channel: null, amount: -103.77 })] },
  { section: 'recharges', total: -80, lines: [statementLine('l4', { type: 'OwnerCharge', checkIn: null, checkOut: null, bookingCode: null, channel: null, description: 'Pulizie finali', amount: -80 })] },
  { section: 'corrections', total: 0, lines: [] },
  { section: 'payments', total: 0, lines: [] },
];

function renderStatement() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/portale-proprietari/contabilita/st-chf']}>
        <Routes>
          <Route path="/portale-proprietari" element={<OwnerPortalShell />}>
            <Route path="contabilita/:statementId" element={<OwnerStatementDetail />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  api.listContacts.mockResolvedValue([]);
  api.getStatement.mockResolvedValue(statementDetail(STATEMENT, { sections: SECTIONS }));
});

afterEach(() => {
  cleanup();
});

describe('an informational line is shown in its part and is in no total of the owner portal (FIX/FE-V2-INFORMATIONAL-WAIVER)', () => {
  it('OwnerPortal_AnInformationalLineOfMinus6750_IsShown_AndEveryTotalIsTheSumWithoutIt', async () => {
    renderStatement();

    const detail = await screen.findByTestId('owner-statement-detail');
    const money = (amount: number) => plain(formatMoney(amount, 'CHF', 'it'));
    const total = (key: string) => plain(within(detail).getByTestId(`owner-statement-total-${key}`).textContent);
    expect(total('gross')).toBe(money(450));
    expect(total('channelFees')).toBe(money(0));
    expect(total('commission')).toBe(money(-103.77));
    expect(total('charges')).toBe(money(-80));
    expect(plain(within(detail).getByTestId('owner-statement-net').textContent)).toBe(money(266.23));
    expect(plain(within(detail).getByTestId('owner-statement-total-closingBalance').textContent)).toBe(money(266.23));

    for (const part of SECTIONS.filter((candidate) => candidate.lines.length > 0)) {
      const counted = part.lines.filter((candidate) => !isInformationalLine(candidate)).reduce((sum, candidate) => sum + Math.round(candidate.amount * 100), 0) / 100;
      expect(counted, part.section).toBe(part.total);
      expect(plain(within(within(detail).getByTestId(`owner-statement-section-${part.section}`)).getByTestId(`owner-statement-section-${part.section}-total`).textContent), part.section).toBe(money(counted));
    }

    const fees = within(detail).getByTestId('owner-statement-section-channelFees');
    const row = within(fees).getByTestId('owner-statement-line');
    expect(row).toHaveAttribute('data-informational', 'true');
    expect(plain(within(row).getByTestId('owner-statement-line-amount').textContent)).toBe(money(67.5));
    expect(within(row).getByTestId('owner-statement-line-note')).toHaveTextContent('Commissione del portale sostenuta dall’agenzia, non addebitata al proprietario');
    expect(row).toHaveTextContent(i18n.t('ownerPortal.accounting.line.informational'));
    expect(within(row).getByTestId('owner-statement-line-amount')).not.toHaveClass('font-semibold');
    expect(plain(fees.textContent)).not.toMatch(/-\s*67,50/);
    const stays = within(within(detail).getByTestId('owner-statement-section-stays')).getByTestId('owner-statement-line-amount');
    expect(stays).toHaveClass('font-semibold');
    expect(plain(within(within(detail).getByTestId('owner-statement-section-commission')).getByTestId('owner-statement-line-amount').textContent)).toBe(money(-103.77));
    expect(within(detail).getAllByTestId('owner-statement-line').filter((candidate) => candidate.hasAttribute('data-informational'))).toHaveLength(1);
  });

  it('OwnerPortal_TheInformationalLine_IsToldInEnglishToo_WithOwnWords', async () => {
    await i18n.changeLanguage('en');
    renderStatement();

    const row = await within(await screen.findByTestId('owner-statement-section-channelFees')).findByTestId('owner-statement-line');
    expect(within(row).getByTestId('owner-statement-line-note')).toHaveTextContent('Portal commission paid by the agency, not charged to the owner');
    expect(plain(within(row).getByTestId('owner-statement-line-amount').textContent)).toMatch(/^CHF 67\.50$/);
    expect(row).toHaveTextContent('For information only');
  });

  it('OwnerPortal_AServerOlderThanTheRule_WithNoInformationalMember_ShowsTheLinesAsToday', async () => {
    const fee = statementLine('l2', { type: 'ChannelFee', amount: -67.5, sharePercent: 50 });
    api.getStatement.mockResolvedValue(
      statementDetail(
        { ...STATEMENT, totals: { ...STATEMENT.totals, channelFees: -67.5, net: 198.73, closingBalance: 198.73 } },
        { sections: SECTIONS.map((part) => (part.section === 'channelFees' ? { section: 'channelFees' as const, total: -67.5, lines: [fee] } : part)) },
      ),
    );
    renderStatement();

    const row = await within(await screen.findByTestId('owner-statement-section-channelFees')).findByTestId('owner-statement-line');
    expect(row).not.toHaveAttribute('data-informational');
    expect(within(row).queryByTestId('owner-statement-line-note')).toBeNull();
    expect(plain(within(row).getByTestId('owner-statement-line-amount').textContent)).toBe(plain(formatMoney(-67.5, 'CHF', 'it')));
    expect(plain(screen.getByTestId('owner-statement-total-channelFees').textContent)).toBe(plain(formatMoney(-67.5, 'CHF', 'it')));
  });
});

describe('the four flags of a line of the owner portal give the right label for each combination (data rule)', () => {
  const COMBINATIONS: ReadonlyArray<{ name: string; flags: Partial<OwnerPortalStatementLine>; note: PortalFeeNote | null; informational: boolean }> = [
    { name: 'V1, the account of the owner: all four false', flags: {}, note: null, informational: false },
    {
      name: 'V2 with the recharge: (true, false, false, false)',
      flags: { channelFeeRechargedByAgency: true, channelFeeBilledToAgencyNotRecharged: false, channelFeeChargedOnAgencyAccount: false, informational: false },
      note: 'rechargedByAgency',
      informational: false,
    },
    {
      name: 'V2 without the recharge, the commission the agency bears: (false, true, false, true)',
      flags: { channelFeeRechargedByAgency: false, channelFeeBilledToAgencyNotRecharged: true, channelFeeChargedOnAgencyAccount: false, informational: true },
      note: 'borneByAgency',
      informational: true,
    },
    {
      name: 'charged to the owner on an account of the agency, before the rule: (false, false, true, false)',
      flags: { channelFeeRechargedByAgency: false, channelFeeBilledToAgencyNotRecharged: false, channelFeeChargedOnAgencyAccount: true, informational: false },
      note: 'chargedOnAgencyAccount',
      informational: false,
    },
    { name: 'a server older than the rule: the old flag alone, (false, true, -, -)', flags: { channelFeeBilledToAgencyNotRecharged: true }, note: 'chargedOnAgencyAccount', informational: false },
  ];

  const TEXTS: Record<'it' | 'en', Record<PortalFeeNote, string>> = {
    it: {
      borneByAgency: 'Commissione del portale sostenuta dall’agenzia, non addebitata al proprietario',
      rechargedByAgency: 'Il canale ha fatturato la commissione all’agenzia, che la riaddebita a te.',
      chargedOnAgencyAccount: 'Commissione del portale su un account intestato all’agenzia, addebitata a te senza riaddebito in fattura',
    },
    en: {
      borneByAgency: 'Portal commission paid by the agency, not charged to the owner',
      rechargedByAgency: 'The channel billed the commission to the agency, which recharges it to you.',
      chargedOnAgencyAccount: 'Portal commission on an account held by the agency, charged to you with no recharge on an invoice',
    },
  };

  it.each(COMBINATIONS)('portalFeeNoteOf_$name', ({ flags, note, informational }) => {
    const line = statementLine('l-flags', { type: 'ChannelFee', amount: -67.5, ...flags });

    expect(portalFeeNoteOf(line)).toBe(note);
    expect(isInformationalLine(line)).toBe(informational);
    expect(shownLineAmount(line)).toBe(informational ? 67.5 : -67.5);
  });

  it.each(COMBINATIONS)('OwnerPortal_TheLineShowsTheLabelOfItsCombination_InBothLanguages_$name', async ({ flags, note, informational }) => {
    const line = statementLine('l-flags', { type: informational ? 'ChannelFeeBorneByAgency' : 'ChannelFee', amount: -67.5, ...flags });
    for (const language of ['it', 'en'] as const) {
      await i18n.changeLanguage(language);
      const { unmount } = render(<StatementSectionBlock section={{ section: 'channelFees', total: informational ? 0 : -67.5, lines: [line] }} currency="CHF" />);

      const row = screen.getByTestId('owner-statement-line');
      if (note === null) {
        expect(within(row).queryByTestId('owner-statement-line-note'), language).toBeNull();
      } else {
        const shown = within(row).getByTestId('owner-statement-line-note');
        expect(shown, language).toHaveAttribute('data-note', note);
        expect(shown.textContent, language).toBe(TEXTS[language][note]);
        for (const other of Object.keys(TEXTS[language]) as PortalFeeNote[]) if (other !== note) expect(row.textContent, `${language} ${other}`).not.toContain(TEXTS[language][other]);
      }
      expect(row.hasAttribute('data-informational'), language).toBe(informational);
      unmount();
    }
  });

  it('theTextsOfTheFlags_AreDifferentInTheTwoLanguages_AndNameNoSupplier', () => {
    for (const note of Object.keys(TEXTS.it) as PortalFeeNote[]) {
      expect(TEXTS.it[note]).not.toBe(TEXTS.en[note]);
      expect(i18n.t(`ownerPortal.accounting.line.${note}`, { lng: 'it' })).toBe(TEXTS.it[note]);
      expect(i18n.t(`ownerPortal.accounting.line.${note}`, { lng: 'en' })).toBe(TEXTS.en[note]);
    }
    for (const text of [...Object.values(TEXTS.it), ...Object.values(TEXTS.en)]) expect(text).not.toMatch(/airbnb|booking\.com|expedia|vrbo|octorate|concordato/i);
  });
});
