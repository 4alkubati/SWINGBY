import { extractMessage } from '../api';

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

  it('falls back to error.message for network errors', () => {
    const error = { message: 'Network Error' };
    expect(extractMessage(error)).toBe('Network Error');
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
