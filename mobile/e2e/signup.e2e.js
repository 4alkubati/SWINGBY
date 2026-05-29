/**
 * T88 — E2E test for signup flow
 *
 * Test scenario:
 * 1. App opens to authentication screen
 * 2. User taps "Sign Up" button
 * 3. User fills out signup form (email, password, name, role)
 * 4. User submits form
 * 5. App navigates to home screen (successful signup)
 *
 * NOTE: This is a scaffold. Actual selectors depend on React Native component IDs.
 * Component IDs should be added with testID props:
 *   <Pressable testID="signupButton">Sign Up</Pressable>
 */

describe('Signup Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should sign up a new user and navigate to home', async () => {
    // T88.1: App opens with auth screen visible
    await expect(element(by.id('authScreen'))).toBeVisible();

    // T88.2: Tap "Sign Up" button
    await waitFor(element(by.id('signupButton')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('signupButton')).multiTap();

    // T88.3: Verify signup form is displayed
    await expect(element(by.id('signupForm'))).toBeVisible();

    // T88.4: Fill email field
    await element(by.id('emailInput')).typeText('newuser@example.com');

    // T88.5: Fill password field
    await element(by.id('passwordInput')).typeText('SecurePass123');

    // T88.6: Fill first name
    await element(by.id('firstNameInput')).typeText('John');

    // T88.7: Fill last name
    await element(by.id('lastNameInput')).typeText('Doe');

    // T88.8: Select role (client)
    await element(by.id('roleSelector')).multiTap();
    await element(by.text('Client')).multiTap();

    // T88.9: Scroll down and tap submit
    await waitFor(element(by.id('submitButton')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('submitButton')).multiTap();

    // T88.10: Wait for navigation to home screen
    await waitFor(element(by.id('homeScreen')))
      .toBeVisible()
      .withTimeout(10000);

    // T88.11: Verify we're on home screen
    await expect(element(by.id('homeScreen'))).toBeVisible();
  });
});
