import { rest } from 'msw';

const BASE = 'https://localhost:5001';

export const handlers = [
  rest.post(`${BASE}/login`, async (req, res, ctx) => {
    const body = (await req.json()) as { email: string; password: string };
    if (body.password === 'wrong') {
      return res(
        ctx.status(200),
        ctx.json({
          success: false,
          mustChangePassword: false,
          message: 'invalid credentials',
        }),
      );
    }
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        accessToken: 'fake-jwt',
        refreshToken: 'fake-refresh',
        expiresAt: '2027-01-01T00:00:00Z',
        userId: 'guid-1',
        email: body.email,
        role: 'Player',
        mustChangePassword: false,
        message: 'ok',
      }),
    );
  }),

  rest.post(`${BASE}/refresh`, (_req, res, ctx) =>
    res(
      ctx.status(200),
      ctx.json({
        success: true,
        accessToken: 'fake-jwt-2',
        refreshToken: 'fake-refresh-2',
        expiresAt: '2027-02-01T00:00:00Z',
      }),
    ),
  ),

  rest.post(`${BASE}/create`, async (req, res, ctx) => {
    const body = (await req.json()) as { email: string };
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        userId: 'guid-2',
        email: body.email,
        accessToken: 'fake-jwt-3',
        message: 'created',
      }),
    );
  }),

  rest.get(`${BASE}/get/:id`, (req, res, ctx) =>
    res(
      ctx.status(200),
      ctx.json({
        userName: `user-${req.params.id as string}`,
        email: `${req.params.id as string}@b.com`,
      }),
    ),
  ),

  rest.post(`${BASE}/validation/verify`, (_req, res, ctx) =>
    res(ctx.status(200), ctx.json({ valid: true })),
  ),

  rest.post(`${BASE}/validation/get`, (_req, res, ctx) =>
    res(
      ctx.status(200),
      ctx.json({
        id: 'v1',
        userId: 'guid-1',
        userEmail: 'a@b.com',
        room: null,
        pieceColor: null,
        dayOfGame: '2026-05-17',
      }),
    ),
  ),

  rest.post(`${BASE}/validation/update/:id`, (_req, res, ctx) =>
    res(ctx.status(200), ctx.json({ updated: true })),
  ),

  rest.post(`${BASE}/validation/can-move`, (_req, res, ctx) =>
    res(ctx.status(200), ctx.json({ canMove: true })),
  ),
];
