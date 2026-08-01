import { renderHook, act } from '@testing-library/react';
import { decodeToken, isTokenValid, readToken, useAuth } from './useAuth';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('useAuth helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('readToken returns null when userId is falsy', () => {
    expect(readToken(undefined)).toBeNull();
    expect(readToken('')).toBeNull();
  });

  it('readToken reads token by composite key', () => {
    localStorage.setItem('accessTokenuser-123', 'abc');
    expect(readToken('user-123')).toBe('abc');
  });

  it('decodeToken returns null for invalid input', () => {
    expect(decodeToken(null)).toBeNull();
    expect(decodeToken('not.a.jwt')).toBeNull();
  });

  it('decodeToken parses a valid JWT', () => {
    const token = makeJwt({
      sub: 'guid-1',
      name: 'Thiago',
      jti: 'j',
      emailAddress: 'a@b.com',
      exp: 1234,
      role: 'Player',
    });
    expect(decodeToken(token)).toMatchObject({
      sub: 'guid-1',
      role: 'Player',
    });
  });

  it('isTokenValid checks expiration', () => {
    expect(isTokenValid(null)).toBe(false);
    expect(
      isTokenValid({
        sub: 'u',
        name: 'n',
        jti: 'j',
        emailAddress: 'e',
        exp: Math.floor(Date.now() / 1000) - 10,
      }),
    ).toBe(false);
    expect(
      isTokenValid({
        sub: 'u',
        name: 'n',
        jti: 'j',
        emailAddress: 'e',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toBe(true);
  });
});

describe('useAuth hook', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('reads existing access + refresh tokens on mount', () => {
    localStorage.setItem('accessTokenu1', 'access');
    localStorage.setItem('refreshTokenu1', 'refresh');
    const { result } = renderHook(() => useAuth('u1'));
    expect(result.current.token).toBe('access');
    expect(result.current.refreshToken).toBe('refresh');
  });

  it('persists and removes both tokens via setTokens/logout', () => {
    const { result } = renderHook(() => useAuth('u1'));

    act(() => result.current.setTokens('u1', 'access', 'refresh'));
    expect(localStorage.getItem('accessTokenu1')).toBe('access');
    expect(localStorage.getItem('refreshTokenu1')).toBe('refresh');
    expect(sessionStorage.getItem('currentUserId')).toBe('u1');

    act(() => result.current.logout('u1'));
    expect(localStorage.getItem('accessTokenu1')).toBeNull();
    expect(localStorage.getItem('refreshTokenu1')).toBeNull();
    expect(sessionStorage.getItem('currentUserId')).toBeNull();
  });
});
