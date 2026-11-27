import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LegacyLeasesRedirect } from '../legacy-leases-redirect';

function Destination() {
  const location = useLocation();
  return <p data-testid="destination">{location.pathname}{location.search}</p>;
}

afterEach(cleanup);
describe('old contract-list addresses', () => {
  it.each([
    ['/app/long-rent/leases', '/app/long-rent/properties'],
    ['/app/long-rent/leases?propertyId=p1', '/app/long-rent/properties/p1?tab=contracts'],
  ])('redirects %s to %s', (from, to) => {
    render(<MemoryRouter initialEntries={[from]}><Routes>
      <Route path="/app/long-rent/leases" element={<LegacyLeasesRedirect />} />
      <Route path="/app/long-rent/properties/*" element={<Destination />} />
    </Routes></MemoryRouter>);
    expect(screen.getByTestId('destination')).toHaveTextContent(to);
  });
});
