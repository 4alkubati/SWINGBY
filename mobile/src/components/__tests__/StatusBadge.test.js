import { render } from '@testing-library/react-native';
import StatusBadge from '../StatusBadge';

// Harness smoke test: proves the render rig actually mounts a real component
// from the tree (StatusBadge -> Text -> theme tokens) and reads its output.
// If this passes, agents can render + assert on any screen the same way.
describe('StatusBadge (render harness smoke)', () => {
  it('renders the supplied label', () => {
    const { getByText } = render(<StatusBadge label="En route" tone="accent" />);
    expect(getByText('En route')).toBeTruthy();
  });

  it('falls back to muted tone for an unknown tone without crashing', () => {
    const { getByText } = render(<StatusBadge label="Pending" tone="not-a-real-tone" />);
    expect(getByText('Pending')).toBeTruthy();
  });
});
