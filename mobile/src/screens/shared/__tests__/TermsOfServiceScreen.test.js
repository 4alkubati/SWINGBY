import { renderScreen } from '../../../test-utils/renderWithProviders';
import TermsOfServiceScreen from '../TermsOfServiceScreen';

// Full-screen render proof: mounts a real screen through the provider stack
// (SafeArea + Navigation + Theme) and asserts its content is on the page.
// This is the pattern D6.4 agents use to prove a screen "renders properly".
describe('TermsOfServiceScreen (full-screen render proof)', () => {
  it('mounts and renders its section headings', () => {
    const { getByText } = renderScreen(<TermsOfServiceScreen />);
    expect(getByText('1. Use of the Platform')).toBeTruthy();
    expect(getByText('2. Payments, Escrow & Refunds')).toBeTruthy();
    expect(getByText('3. Disclaimers & Limitation of Liability')).toBeTruthy();
  });
});
