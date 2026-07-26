import { render, fireEvent } from '@testing-library/react-native';
import BusinessLogo, { businessInitials } from '../BusinessLogo';
import NearbyCard from '../NearbyCard';
import FeaturedCard from '../FeaturedCard';

// There will be ZERO logos in the database on day one, so the monogram is the
// common case, not the error case. These tests pin that it is always something
// deliberate — never a broken image, never an empty box.

const LOGO = 'https://stub.supabase.co/storage/v1/object/public/job-photos/a.png';

describe('businessInitials', () => {
  it('builds a monogram from the first and last word', () => {
    expect(businessInitials('Calgary Clean Co.')).toBe('CC');
  });

  it('uses the first two letters of a single-word name', () => {
    expect(businessInitials('Sparkle')).toBe('SP');
  });

  it('never returns empty for a missing or blank name', () => {
    expect(businessInitials('')).toBe('?');
    expect(businessInitials('   ')).toBe('?');
    expect(businessInitials(null)).toBe('?');
    expect(businessInitials(undefined)).toBe('?');
  });
});

describe('BusinessLogo', () => {
  it('renders the monogram when there is no logo — the day-one default', () => {
    const { getByText } = render(<BusinessLogo name="Calgary Clean Co." />);
    expect(getByText('CC')).toBeTruthy();
  });

  it('renders the image instead of the monogram when a logo exists', () => {
    const { queryByText, UNSAFE_getByType } = render(
      <BusinessLogo uri={LOGO} name="Calgary Clean Co." />
    );
    const { Image } = require('react-native');
    expect(UNSAFE_getByType(Image).props.source).toEqual({ uri: LOGO });
    expect(queryByText('CC')).toBeNull();
  });

  it('falls back to the monogram when the image fails to load', () => {
    // A dead URL must be indistinguishable from having no logo at all —
    // this is the "never a broken image" guarantee.
    const { Image } = require('react-native');
    const { UNSAFE_getByType, getByText, queryByText } = render(
      <BusinessLogo uri="https://example.com/gone.png" name="Calgary Clean Co." />
    );
    expect(queryByText('CC')).toBeNull();

    fireEvent(UNSAFE_getByType(Image), 'error');

    expect(getByText('CC')).toBeTruthy();
  });

  it('is decorative unless given a label, so cards do not read twice', () => {
    const { toJSON } = render(<BusinessLogo name="Calgary Clean Co." />);
    expect(toJSON().props.accessible).toBe(false);

    const { toJSON: labelled } = render(
      <BusinessLogo name="Calgary Clean Co." accessibilityLabel="Calgary Clean Co. logo" />
    );
    expect(labelled().props.accessibilityLabel).toBe('Calgary Clean Co. logo');
  });
});

describe('business cards', () => {
  it('NearbyCard shows the monogram when the business has no logo', () => {
    const { getByText } = render(
      <NearbyCard name="Calgary Clean Co." rating="4.8" jobs={12} />
    );
    expect(getByText('CC')).toBeTruthy();
    expect(getByText('Calgary Clean Co.')).toBeTruthy();
  });

  it('NearbyCard shows the logo when there is one', () => {
    const { Image } = require('react-native');
    const { UNSAFE_getByType, queryByText } = render(
      <NearbyCard name="Calgary Clean Co." logoUrl={LOGO} rating="4.8" jobs={12} />
    );
    expect(UNSAFE_getByType(Image).props.source).toEqual({ uri: LOGO });
    expect(queryByText('CC')).toBeNull();
  });

  it('FeaturedCard shows the monogram when the business has no logo', () => {
    const { getByText } = render(
      <FeaturedCard name="Calgary Clean Co." rating="4.9" jobs={30} />
    );
    expect(getByText('CC')).toBeTruthy();
  });

  it('FeaturedCard shows the logo when there is one', () => {
    const { Image } = require('react-native');
    const { UNSAFE_getByType } = render(
      <FeaturedCard name="Calgary Clean Co." logoUrl={LOGO} rating="4.9" jobs={30} />
    );
    expect(UNSAFE_getByType(Image).props.source).toEqual({ uri: LOGO });
  });
});
