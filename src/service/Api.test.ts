import MockAdapter from 'axios-mock-adapter';
import {
  clearStoredTokens,
  createApi,
  getStoredRefreshToken,
  getStoredToken,
  setStoredTokens,
} from './Api';

describe('Api', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('getStoredToken returns null without userId', () => {
    expect(getStoredToken(null)).toBeNull();
  });

  it('setStoredTokens persists both tokens and currentUserId', () => {
    setStoredTokens('u1', 'A', 'R');
    expect(getStoredToken('u1')).toBe('A');
    expect(getStoredRefreshToken('u1')).toBe('R');
    expect(sessionStorage.getItem('currentUserId')).toBe('u1');
  });

  it('clearStoredTokens removes both tokens', () => {
    setStoredTokens('u1', 'A', 'R');
    clearStoredTokens('u1');
    expect(getStoredToken('u1')).toBeNull();
    expect(getStoredRefreshToken('u1')).toBeNull();
    expect(sessionStorage.getItem('currentUserId')).toBeNull();
  });

  it('injects Bearer token when present', async () => {
    setStoredTokens('u1', 'jwt-token');
    const instance = createApi('http://test.local/');
    const mock = new MockAdapter(instance);
    mock.onGet('/ping').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer jwt-token');
      return [200, {}];
    });
    await instance.get('/ping');
  });

  it('omits Authorization when no token', async () => {
    const instance = createApi('http://test.local/');
    const mock = new MockAdapter(instance);
    mock.onGet('/ping').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, {}];
    });
    await instance.get('/ping');
  });
});
