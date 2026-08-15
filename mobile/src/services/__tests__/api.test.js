import { extractMessage, CONNECTION_ERROR_MESSAGE } from '../api';

describe('extractMessage', () => {
  it('returns string detail from FastAPI', () => {
    const error = { response: { data: { detail: 'Invalid credentials' } } };
    expect(extractMessage(error)).toBe('Invalid credentials');
  });

  it('joins array detail from FastAPI validation errors', () => {
    const error = {
      response: {
        data: {
          detail: [
            { loc: ['body', 'email'], msg: 'field required', type: 'missing' },
            { loc: ['body', 'password'], msg: 'too short', type: 'value_error' },
          ],
        },
      },
    };
    expect(extractMessage(error)).toBe('field required, too short');
  });

  it('handles array of plain strings in detail', () => {
    const error = { response: { data: { detail: ['Error one', 'Error two'] } } };
    expect(extractMessage(error)).toBe('Error one, Error two');
  });

  it('extracts message field', () => {
    const error = { response: { data: { message: 'Server error' } } };
    expect(extractMessage(error)).toBe('Server error');
  });

  it('extracts error field', () => {
    const error = { response: { data: { error: 'Not found' } } };
    expect(extractMessage(error)).toBe('Not found');
  });

  it('extracts nested detail.msg', () => {
    const error = { response: { data: { detail: { msg: 'Rate limited' } } } };
    expect(extractMessage(error)).toBe('Rate limited');
  });

  it('translates a network error instead of echoing axios at the user', () => {
    // Changed 2026-08-15. This asserted the raw string was passed through:
    //   expect(extractMessage({ message: 'Network Error' })).toBe('Network Error')
    //
    // That pass-through IS the sign-in bug. LoginScreen put whatever this
    // returned under the PASSWORD FIELD, so a dropped connection rendered as
    // "Network Error" beneath the password — which reads as "that password is
    // wrong". People retyped a correct password and tried again, reported as
    // "I have to log in like 5 times before it works".
    //
    // "Network Error" and "timeout of 30000ms exceeded" are the transport's
    // vocabulary, not a person's. The contract is now: say what happened, in
    // words that name the real problem.
    const error = { message: 'Network Error' };
    expect(extractMessage(error)).toBe(CONNECTION_ERROR_MESSAGE);
    expect(extractMessage({ message: 'timeout of 30000ms exceeded' }))
      .toBe(CONNECTION_ERROR_MESSAGE);
  });

  it('still passes through a real error message from the server', () => {
    // The translation must be narrow: a message that came WITH a response is
    // the server talking, and it must survive.
    const error = { message: 'nope', response: { data: { detail: 'Invalid credentials' } } };
    expect(extractMessage(error)).toBe('Invalid credentials');
  });

  it('returns fallback for null/undefined', () => {
    expect(extractMessage(null)).toBe('Something went wrong');
    expect(extractMessage(undefined)).toBe('Something went wrong');
  });

  it('returns fallback for empty response data', () => {
    const error = { response: { data: {} } };
    expect(extractMessage(error)).toBe('Something went wrong');
  });
});
