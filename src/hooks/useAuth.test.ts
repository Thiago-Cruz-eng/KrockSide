import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { decodeToken, isTokenValid, readSessionToken, readToken, useAuth } from './useAuth';
import { API_BASE_URL, setStoredTokens } from '../service/Api';
import { server } from '../mocks/server';
import { expiredJwtFor, makeJwt, validJwtFor } from '../test-utils/jwt';

const BASE = API_BASE_URL.replace(/\/+$/, '');

describe('useAuth helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('readToken returns null when userId is falsy', () => {
    expect(readToken(undefined)).toBeNull();
    expect(readToken('')).toBeNull();
  });

  it('readToken reads token by composite key from sessionStorage', () => {
    sessionStorage.setItem('accessTokenuser-123', 'abc');
    expect(readToken('user-123')).toBe('abc');
    // localStorage deixou de ser lido.
    localStorage.setItem('accessTokenother', 'legacy');
    expect(readToken('other')).toBeNull();
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

  it('readSessionToken requires token, matching sub and validity', () => {
    sessionStorage.setItem('accessTokenu1', validJwtFor('u1'));
    sessionStorage.setItem('accessTokenu2', validJwtFor('someone-else'));
    sessionStorage.setItem('accessTokenu3', expiredJwtFor('u3'));

    expect(readSessionToken('u1')).not.toBeNull();
    expect(readSessionToken('u2')).toBeNull(); // sub de outro usuário
    expect(readSessionToken('u3')).toBeNull(); // expirado
    expect(readSessionToken('u4')).toBeNull(); // sem token
    expect(readSessionToken(undefined)).toBeNull();
  });
});

describe('useAuth hook', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('reads existing access + refresh tokens on mount and marks the session current', () => {
    const jwt = validJwtFor('u1');
    sessionStorage.setItem('accessTokenu1', jwt);
    sessionStorage.setItem('refreshTokenu1', 'refresh');

    const { result } = renderHook(() => useAuth('u1'));

    expect(result.current.token).toBe(jwt);
    expect(result.current.refreshToken).toBe('refresh');
    expect(result.current.isValid).toBe(true);
    expect(result.current.decoded?.sub).toBe('u1');
    expect(sessionStorage.getItem('currentUserId')).toBe('u1');
  });

  it('does not trust the route id: no token for it means no session and no currentUserId', () => {
    const { result } = renderHook(() => useAuth('intruder'));

    expect(result.current.token).toBeNull();
    expect(result.current.isValid).toBe(false);
    expect(result.current.refreshing).toBe(false);
    // Antes qualquer :id era gravado como corrente. Agora só com sessão confirmada.
    expect(sessionStorage.getItem('currentUserId')).toBeNull();
  });

  it('rejects a token whose sub is another user', () => {
    sessionStorage.setItem('accessTokenu2', validJwtFor('u1'));

    const { result } = renderHook(() => useAuth('u2'));

    expect(result.current.isValid).toBe(false);
    expect(result.current.token).toBeNull();
    expect(sessionStorage.getItem('currentUserId')).toBeNull();
  });

  it('switching the route id to a user without a token does not inherit the session', () => {
    sessionStorage.setItem('accessTokenu1', validJwtFor('u1'));
    const { result, rerender } = renderHook(({ id }: { id: string }) => useAuth(id), {
      initialProps: { id: 'u1' },
    });
    expect(result.current.isValid).toBe(true);
    expect(sessionStorage.getItem('currentUserId')).toBe('u1');

    rerender({ id: 'u2' });

    expect(result.current.isValid).toBe(false);
    expect(result.current.token).toBeNull();
    expect(sessionStorage.getItem('currentUserId')).not.toBe('u2');
  });

  it('persists via setTokens and wipes everything via logout', () => {
    const jwt = validJwtFor('u1');
    const { result } = renderHook(() => useAuth('u1'));

    act(() => result.current.setTokens('u1', jwt, 'refresh'));
    expect(sessionStorage.getItem('accessTokenu1')).toBe(jwt);
    expect(sessionStorage.getItem('refreshTokenu1')).toBe('refresh');
    expect(sessionStorage.getItem('currentUserId')).toBe('u1');
    expect(result.current.isValid).toBe(true);

    // Outro usuário logado na mesma aba antes: logout não pode deixá-lo para trás.
    setStoredTokens('u9', 'other', 'other-r');

    act(() => result.current.logout('u1'));
    expect(sessionStorage.getItem('accessTokenu1')).toBeNull();
    expect(sessionStorage.getItem('refreshTokenu1')).toBeNull();
    expect(sessionStorage.getItem('accessTokenu9')).toBeNull();
    expect(sessionStorage.getItem('refreshTokenu9')).toBeNull();
    expect(sessionStorage.getItem('currentUserId')).toBeNull();
    expect(result.current.isValid).toBe(false);
    expect(result.current.token).toBeNull();
  });

  it('reacts to session changes made outside the hook (e.g. the refresh interceptor)', () => {
    const { result } = renderHook(() => useAuth('u1'));
    expect(result.current.isValid).toBe(false);

    const jwt = validJwtFor('u1');
    act(() => setStoredTokens('u1', jwt, 'r2'));

    expect(result.current.token).toBe(jwt);
    expect(result.current.refreshToken).toBe('r2');
    expect(result.current.isValid).toBe(true);
  });

  describe('proactive refresh of an expired token', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());

    it('renews an expired token with the stored refresh token and becomes valid', async () => {
      sessionStorage.setItem('accessTokenu1', expiredJwtFor('u1'));
      sessionStorage.setItem('refreshTokenu1', 'old-refresh');
      const renewed = validJwtFor('u1');
      let body: unknown;
      server.use(
        http.post(`${BASE}/refresh-token`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            success: true,
            accessToken: renewed,
            refreshToken: 'new-refresh',
          });
        }),
      );

      const { result } = renderHook(() => useAuth('u1'));

      // Enquanto renova: sem sessão válida, mas também sem redirecionar.
      expect(result.current.isValid).toBe(false);
      expect(result.current.refreshing).toBe(true);

      // Folga acima do padrão: a primeira requisição interceptada pelo MSW num arquivo paga o
      // aquecimento do interceptor, que passa de 1s em máquina carregada.
      await waitFor(() => expect(result.current.isValid).toBe(true), { timeout: 8_000 });
      expect(result.current.refreshing).toBe(false);
      expect(result.current.token).toBe(renewed);
      expect(result.current.refreshToken).toBe('new-refresh');
      expect(body).toEqual({ userId: 'u1', refreshToken: 'old-refresh' });
      expect(sessionStorage.getItem('currentUserId')).toBe('u1');
    });

    it('an expired token without a refresh token is simply no session', () => {
      sessionStorage.setItem('accessTokenu1', expiredJwtFor('u1'));

      const { result } = renderHook(() => useAuth('u1'));

      expect(result.current.isValid).toBe(false);
      expect(result.current.refreshing).toBe(false);
      expect(sessionStorage.getItem('currentUserId')).toBeNull();
    });
  });
});
