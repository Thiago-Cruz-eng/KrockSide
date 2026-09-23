import MockAdapter from 'axios-mock-adapter';
import { http, HttpResponse } from 'msw';
import {
  API_BASE_URL,
  clearAllStoredTokens,
  clearStoredTokens,
  createApi,
  getCurrentToken,
  getStoredRefreshToken,
  getStoredToken,
  httpStatusOf,
  REQUEST_TIMEOUT_MS,
  setStoredTokens,
} from './Api';
import { server } from '../mocks/server';
import { failedRefresh } from '../mocks/handlers';

const BASE = API_BASE_URL.replace(/\/+$/, '');

describe('Api', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('storage', () => {
    it('getStoredToken returns null without userId', () => {
      expect(getStoredToken(null)).toBeNull();
    });

    it('setStoredTokens persists both tokens and currentUserId', () => {
      setStoredTokens('u1', 'A', 'R');
      expect(getStoredToken('u1')).toBe('A');
      expect(getStoredRefreshToken('u1')).toBe('R');
      expect(sessionStorage.getItem('currentUserId')).toBe('u1');
    });

    it('tokens live in sessionStorage, never in localStorage', () => {
      // Decisão do hardening de 2026-09-23: por aba, morre ao fechar. Nada é escrito no
      // localStorage, que persistiria além da sessão.
      setStoredTokens('u1', 'A', 'R');
      expect(sessionStorage.getItem('accessTokenu1')).toBe('A');
      expect(sessionStorage.getItem('refreshTokenu1')).toBe('R');
      expect(localStorage.getItem('accessTokenu1')).toBeNull();
      expect(localStorage.getItem('refreshTokenu1')).toBeNull();
    });

    it('clearStoredTokens removes both tokens', () => {
      setStoredTokens('u1', 'A', 'R');
      clearStoredTokens('u1');
      expect(getStoredToken('u1')).toBeNull();
      expect(getStoredRefreshToken('u1')).toBeNull();
      expect(sessionStorage.getItem('currentUserId')).toBeNull();
    });

    it('clearAllStoredTokens wipes every user, the legacy localStorage copies and notifies', () => {
      setStoredTokens('u1', 'A1', 'R1');
      setStoredTokens('u2', 'A2', 'R2');
      // Resquício de versão anterior, que guardava em localStorage.
      localStorage.setItem('accessTokenold', 'legacy');
      localStorage.setItem('refreshTokenold', 'legacy');
      localStorage.setItem('unrelated', 'keep');

      clearAllStoredTokens();

      expect(getStoredToken('u1')).toBeNull();
      expect(getStoredRefreshToken('u1')).toBeNull();
      expect(getStoredToken('u2')).toBeNull();
      expect(getStoredRefreshToken('u2')).toBeNull();
      expect(sessionStorage.getItem('currentUserId')).toBeNull();
      expect(getCurrentToken()).toBeNull();
      expect(localStorage.getItem('accessTokenold')).toBeNull();
      expect(localStorage.getItem('refreshTokenold')).toBeNull();
      expect(localStorage.getItem('unrelated')).toBe('keep');
    });
  });

  describe('request interceptor', () => {
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

    it('applies a request timeout', () => {
      const instance = createApi('http://test.local/');
      expect(instance.defaults.timeout).toBe(REQUEST_TIMEOUT_MS);
      expect(REQUEST_TIMEOUT_MS).toBe(10_000);
    });
  });

  describe('httpStatusOf', () => {
    it('reads the status of an axios error and ignores anything else', async () => {
      const instance = createApi('http://test.local/');
      const mock = new MockAdapter(instance);
      mock.onGet('/nope').reply(429, { success: false, message: 'Too many requests' });

      const err = await instance.get('/nope').catch((e: unknown) => e);
      expect(httpStatusOf(err)).toBe(429);
      expect(httpStatusOf(new Error('network'))).toBeUndefined();
      expect(httpStatusOf(undefined)).toBeUndefined();
    });
  });

  /**
   * Refresh automático, testado com MSW e não com axios-mock-adapter: a renovação sai por uma
   * instância axios própria (sem o interceptor), e o adaptador só enxerga a instância a que foi
   * anexado. O MSW intercepta na camada de rede e vê as duas.
   */
  describe('response interceptor (refresh on 401)', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());

    /** Endpoint protegido que só aceita o token indicado; 401 para qualquer outro. */
    function protectedEndpoint(acceptedToken: string, onHit?: () => void) {
      return http.get(`${BASE}/protected`, ({ request }) => {
        onHit?.();
        const auth = request.headers.get('Authorization');
        if (auth !== `Bearer ${acceptedToken}`) {
          return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        return HttpResponse.json({ ok: true, seen: auth });
      });
    }

    it('on 401 refreshes once, stores the rotated pair and retries with the new token', async () => {
      setStoredTokens('u1', 'stale-jwt', 'stale-refresh');
      let refreshCalls = 0;
      let refreshBody: unknown;
      server.use(
        protectedEndpoint('fake-jwt-2'),
        http.post(`${BASE}/refresh-token`, async ({ request }) => {
          refreshCalls += 1;
          refreshBody = await request.json();
          return HttpResponse.json({
            success: true,
            accessToken: 'fake-jwt-2',
            refreshToken: 'fake-refresh-2',
          });
        }),
      );
      const onSessionLost = vi.fn();
      const instance = createApi(API_BASE_URL, { onSessionLost });

      const res = await instance.get<{ ok: boolean; seen: string }>('protected');

      expect(res.status).toBe(200);
      expect(res.data.seen).toBe('Bearer fake-jwt-2');
      expect(refreshCalls).toBe(1);
      // Manda o par certo e grava o par NOVO — rotação.
      expect(refreshBody).toEqual({ userId: 'u1', refreshToken: 'stale-refresh' });
      expect(getStoredToken('u1')).toBe('fake-jwt-2');
      expect(getStoredRefreshToken('u1')).toBe('fake-refresh-2');
      expect(onSessionLost).not.toHaveBeenCalled();
    });

    it('concurrent 401s share a single refresh', async () => {
      setStoredTokens('u1', 'stale-jwt', 'stale-refresh');
      let refreshCalls = 0;
      server.use(
        protectedEndpoint('fake-jwt-2'),
        http.post(`${BASE}/refresh-token`, async () => {
          refreshCalls += 1;
          // Atraso para as três requisições chegarem ao 401 antes da primeira rotação acabar.
          await new Promise((r) => setTimeout(r, 30));
          return HttpResponse.json({
            success: true,
            accessToken: 'fake-jwt-2',
            refreshToken: 'fake-refresh-2',
          });
        }),
      );
      const instance = createApi(API_BASE_URL, { onSessionLost: vi.fn() });

      const results = await Promise.all([
        instance.get('protected'),
        instance.get('protected'),
        instance.get('protected'),
      ]);

      expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
      expect(refreshCalls).toBe(1);
    });

    it('when the refresh is refused, clears the whole session and redirects to login', async () => {
      setStoredTokens('u1', 'stale-jwt', 'revoked-refresh');
      server.use(protectedEndpoint('never'), failedRefresh);
      const onSessionLost = vi.fn();
      const instance = createApi(API_BASE_URL, { onSessionLost });

      await expect(instance.get('protected')).rejects.toMatchObject({
        response: { status: 401 },
      });

      expect(getStoredToken('u1')).toBeNull();
      expect(getStoredRefreshToken('u1')).toBeNull();
      expect(sessionStorage.getItem('currentUserId')).toBeNull();
      expect(onSessionLost).toHaveBeenCalledTimes(1);
    });

    it('when the refresh endpoint is rate limited (429), the session ends too', async () => {
      setStoredTokens('u1', 'stale-jwt', 'stale-refresh');
      server.use(
        protectedEndpoint('never'),
        http.post(`${BASE}/refresh-token`, () =>
          HttpResponse.json(
            { success: false, message: 'Too many requests' },
            { status: 429, headers: { 'Retry-After': '60' } },
          ),
        ),
      );
      const onSessionLost = vi.fn();
      const instance = createApi(API_BASE_URL, { onSessionLost });

      await expect(instance.get('protected')).rejects.toBeDefined();
      expect(getStoredToken('u1')).toBeNull();
      expect(onSessionLost).toHaveBeenCalledTimes(1);
    });

    it('without a refresh token, a 401 ends the session without calling the server', async () => {
      setStoredTokens('u1', 'stale-jwt'); // sem refresh
      let refreshCalls = 0;
      server.use(
        protectedEndpoint('never'),
        http.post(`${BASE}/refresh-token`, () => {
          refreshCalls += 1;
          return HttpResponse.json({ success: true });
        }),
      );
      const onSessionLost = vi.fn();
      const instance = createApi(API_BASE_URL, { onSessionLost });

      await expect(instance.get('protected')).rejects.toBeDefined();
      expect(refreshCalls).toBe(0);
      expect(onSessionLost).toHaveBeenCalledTimes(1);
    });

    it('does not retry more than once: a 401 after the refresh propagates', async () => {
      setStoredTokens('u1', 'stale-jwt', 'stale-refresh');
      let hits = 0;
      server.use(
        protectedEndpoint('some-other-token', () => {
          hits += 1;
        }),
        http.post(`${BASE}/refresh-token`, () =>
          HttpResponse.json({
            success: true,
            accessToken: 'fake-jwt-2',
            refreshToken: 'fake-refresh-2',
          }),
        ),
      );
      const onSessionLost = vi.fn();
      const instance = createApi(API_BASE_URL, { onSessionLost });

      await expect(instance.get('protected')).rejects.toMatchObject({
        response: { status: 401 },
      });
      // Original + uma repetição, e nada mais.
      expect(hits).toBe(2);
      // O refresh em si deu certo, então a sessão fica de pé.
      expect(onSessionLost).not.toHaveBeenCalled();
      expect(getStoredToken('u1')).toBe('fake-jwt-2');
    });

    it.each(['login', 'register', 'refresh-token'])(
      'a 401 from %s is a business answer and never triggers a refresh',
      async (endpoint) => {
        setStoredTokens('u1', 'jwt', 'refresh');
        let refreshCalls = 0;
        server.use(
          http.post(`${BASE}/login`, () =>
            HttpResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 }),
          ),
          http.post(`${BASE}/register`, () =>
            HttpResponse.json({ success: false, message: 'Invalid' }, { status: 401 }),
          ),
          http.post(`${BASE}/refresh-token`, () => {
            refreshCalls += 1;
            return HttpResponse.json({ success: false, message: 'Invalid' }, { status: 401 });
          }),
        );
        const onSessionLost = vi.fn();
        const instance = createApi(API_BASE_URL, { onSessionLost });

        await expect(instance.post(endpoint, {})).rejects.toMatchObject({
          response: { status: 401 },
        });

        // Para `refresh-token`, a única chamada é a do próprio teste; nenhuma renovação em cima.
        expect(refreshCalls).toBe(endpoint === 'refresh-token' ? 1 : 0);
        expect(onSessionLost).not.toHaveBeenCalled();
        expect(getStoredToken('u1')).toBe('jwt');
      },
    );
  });
});
