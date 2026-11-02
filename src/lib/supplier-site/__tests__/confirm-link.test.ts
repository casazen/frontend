import { describe, expect, it } from 'vitest';
import { addressWithoutToken, readConfirmLink } from '../confirm-link';

const HOLD = '0f6c1c2e-7a4b-4d52-9d3e-2b1f6a8c9d10';
const TOKEN = 'Zm9vYmFyLXRva2VuLTEyMzQ1Njc4OTBhYmNkZWZnaGlqa2w';

describe('the link of the verification e-mail (privacy of the token)', () => {
  it('readConfirmLink_TokenInTheFragment_IsRead', () => {
    expect(readConfirmLink(`?hold=${HOLD}`, `#token=${TOKEN}`)).toEqual({ hold: HOLD, inquiry: null, token: TOKEN });
  });

  it('readConfirmLink_AnOlderLinkWithTheTokenInTheQuery_StillOpens', () => {
    expect(readConfirmLink(`?hold=${HOLD}&token=${TOKEN}`, '')).toEqual({ hold: HOLD, inquiry: null, token: TOKEN });
  });

  it('readConfirmLink_NotAGuidOrNotAToken_IsNothing', () => {
    expect(readConfirmLink('?hold=12345', '#token=<script>')).toEqual({ hold: null, inquiry: null, token: null });
  });

  it('addressWithoutToken_Always_CarriesNeitherTheFragmentNorTheTokenQuery', () => {
    const link = readConfirmLink(`?hold=${HOLD}&token=${TOKEN}`, `#token=${TOKEN}`);

    const address = addressWithoutToken('/fornitori/rossi/conferma', link);

    expect(address).toBe(`/fornitori/rossi/conferma?hold=${HOLD}`);
    expect(address).not.toContain(TOKEN);
    expect(address).not.toContain('#');
  });
});
