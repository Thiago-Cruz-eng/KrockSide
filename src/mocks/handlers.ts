import { http, HttpResponse } from 'msw';
import { API_BASE_URL } from '../service/Api';

// msw 2 trocou `rest` por `http`, e o trio (req, res, ctx) por um objeto de argumentos
// que devolve HttpResponse. Os stubs abaixo respondem exatamente o mesmo de antes.

/**
 * Base derivada do próprio serviço, não uma constante repetida aqui.
 *
 * Estava fixo em 'https://localhost:5001'. Ao criar um `.env` local apontando a API para
 * `http://localhost:5001/`, o Vitest carregou esse env, o axios passou a chamar `http` e
 * nenhum handler casou — os testes de integração falharam com "Falha ao fazer login",
 * que é o `catch` do componente, sugerindo bug de UI onde havia divergência de mock.
 *
 * Derivar da mesma fonte que a aplicação usa fecha essa classe de erro.
 */
const BASE = API_BASE_URL.replace(/\/+$/, '');

export const handlers = [
  http.post(`${BASE}/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password === 'wrong') {
      return HttpResponse.json({
        success: false,
        mustChangePassword: false,
        message: 'invalid credentials',
      });
    }
    return HttpResponse.json({
      success: true,
      accessToken: 'fake-jwt',
      refreshToken: 'fake-refresh',
      expiresAt: '2027-01-01T00:00:00Z',
      userId: 'guid-1',
      email: body.email,
      role: 'Player',
      mustChangePassword: false,
      message: 'ok',
    });
  }),

  http.post(`${BASE}/refresh-token`, () =>
    HttpResponse.json({
      success: true,
      accessToken: 'fake-jwt-2',
      refreshToken: 'fake-refresh-2',
      expiresAt: '2027-02-01T00:00:00Z',
    }),
  ),

  http.post(`${BASE}/register`, async ({ request }) => {
    const body = (await request.json()) as { email: string };
    return HttpResponse.json({
      success: true,
      userId: 'guid-2',
      email: body.email,
      accessToken: 'fake-jwt-3',
      refreshToken: 'fake-refresh-3',
      name: 'Registrada',
      role: 'jogador',
      message: 'created',
    });
  }),

  http.get(`${BASE}/users/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id as string,
      name: `user-${params.id as string}`,
      role: 'jogador',
      mustChangePassword: false,
      email: `${params.id as string}@b.com`,
    }),
  ),

  http.post(`${BASE}/validation/verify`, () => HttpResponse.json({ valid: true })),

  http.post(`${BASE}/validation/get`, () =>
    HttpResponse.json({
      id: 'v1',
      userId: 'guid-1',
      userEmail: 'a@b.com',
      room: null,
      pieceColor: null,
      dayOfGame: '2026-05-17',
    }),
  ),

  http.post(`${BASE}/validation/update/:id`, () => HttpResponse.json({ updated: true })),

  http.post(`${BASE}/validation/can-move`, () => HttpResponse.json({ canMove: true })),
];
