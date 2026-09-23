import MockAdapter from 'axios-mock-adapter';
import userApi, { isGuid } from './userApi';
import { httpClient } from './Api';
import { GUID_1 } from '../test-utils/jwt';

// Antes este arquivo substituía o módulo Api inteiro com vi.mock e reconstruía a
// instância axios via require('axios'). O require não sobrevive ao pacote virar ESM,
// e a duplicata desviava do wiring real. Agora o adaptador é anexado à instância que
// a aplicação de fato usa, então interceptores e baseURL entram no teste.
describe('userApi', () => {
  let mock = new MockAdapter(httpClient);

  beforeEach(() => {
    mock = new MockAdapter(httpClient);
  });

  afterEach(() => mock.restore());

  it('login posts credentials and returns response shape', async () => {
    mock.onPost('login').reply(200, {
      success: true,
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresAt: '2026-12-31T00:00:00Z',
      email: 'a@b.com',
      userId: 'guid-1',
      role: 'Player',
      mustChangePassword: false,
      message: 'ok',
    });
    const res = await userApi.login({ email: 'a@b.com', password: 'pw' });
    expect(res.accessToken).toBe('tok');
    expect(res.refreshToken).toBe('ref');
    expect(res.userId).toBe('guid-1');
  });

  it('register posts to /register and never sends a role', async () => {
    let sent: Record<string, unknown> = {};
    mock.onPost('register').reply((config) => {
      sent = JSON.parse(config.data);
      return [
        200,
        {
          success: true,
          message: 'Account created',
          userId: 'u2',
          name: 'thiago',
          email: 'a@b.com',
          role: 'jogador',
          accessToken: 'tok',
          refreshToken: 'ref',
        },
      ];
    });

    const res = await userApi.register({
      name: 'thiago',
      email: 'a@b.com',
      password: 'pw',
      passwordConfirmation: 'pw',
    });

    expect(res.success).toBe(true);
    expect(res.accessToken).toBe('tok');
    expect(res.role).toBe('jogador');
    // O papel é do servidor: o cliente não tem como pedir outro.
    expect(sent).not.toHaveProperty('role');
    expect(sent).not.toHaveProperty('createdBy');
    // Campos que o backend nunca conheceu e que saíram do formulário.
    expect(sent).not.toHaveProperty('dateBirth');
    expect(sent).not.toHaveProperty('phoneNumber');
  });

  it('createUser posts to /users with a role (admin path)', async () => {
    mock.onPost('users').reply(200, { success: true, userId: 'u3', message: 'User created' });

    const res = await userApi.createUser({
      name: 'Admin criou',
      email: 'novo@b.com',
      password: 'pw',
      passwordConfirmation: 'pw',
      role: 'jogador',
    });

    expect(res.success).toBe(true);
    expect(res.userId).toBe('u3');
  });

  it('canMove POSTs body with lowercase keys', async () => {
    mock.onPost('validation/can-move').reply((config) => {
      const body = JSON.parse(config.data);
      expect(body.userId).toBe('u');
      expect(body.pieceColor).toBe('white');
      expect(body.day).toBe('2026-05-17');
      return [200, { canMove: true }];
    });
    const ok = await userApi.canMove({
      day: '2026-05-17',
      pieceColor: 'white',
      room: 'r1',
      userEmail: 'e',
      userId: 'u',
    });
    expect(ok).toBe(true);
  });

  it('updateValidation POSTs to id route', async () => {
    mock.onPost('validation/update/v1').reply(200, { updated: true });
    const ok = await userApi.updateValidation('v1', {
      pieceColor: 'black',
      room: 'r1',
      userEmail: 'e',
      userId: 'u',
    });
    expect(ok).toBe(true);
  });

  it('getValidation returns null on 404', async () => {
    mock.onPost('validation/get').reply(404);
    const res = await userApi.getValidation('u1');
    expect(res).toBeNull();
  });

  it('getValidation returns body on 200', async () => {
    mock.onPost('validation/get').reply(200, {
      id: 'v1',
      userId: 'u1',
      userEmail: 'e@b.com',
      room: null,
      pieceColor: null,
      dayOfGame: '2026-05-17',
    });
    const res = await userApi.getValidation('u1');
    expect(res?.id).toBe('v1');
  });

  it('refresh POSTs to /refresh', async () => {
    mock.onPost('refresh-token').reply(200, {
      success: true,
      accessToken: 'new',
      refreshToken: 'new-r',
      expiresAt: '2027-01-01T00:00:00Z',
    });
    const res = await userApi.refresh({ userId: 'u', refreshToken: 'r' });
    expect(res.accessToken).toBe('new');
  });

  it('getUser GETs by id when it is a GUID', async () => {
    mock.onGet(`users/${GUID_1}`).reply(200, {
      id: GUID_1,
      name: 'thiago',
      email: 'a@b.com',
      role: 'jogador',
      mustChangePassword: false,
    });
    const res = await userApi.getUser(GUID_1);
    expect(res.name).toBe('thiago');
  });

  it.each(['u1', '../admin', 'guid-1?x=1', '', undefined])(
    'getUser refuses %j without touching the network',
    async (id) => {
      mock.onAny().reply(200, {});
      await expect(userApi.getUser(id)).rejects.toThrow(/GUID/);
      expect(mock.history.get).toHaveLength(0);
    },
  );

  it('isGuid accepts the backend format in either case and nothing else', () => {
    expect(isGuid(GUID_1)).toBe(true);
    expect(isGuid(GUID_1.toUpperCase())).toBe(true);
    expect(isGuid('11111111111111111111111111111111')).toBe(false); // sem hífens
    expect(isGuid('zzzzzzzz-1111-4111-8111-111111111111')).toBe(false);
    expect(isGuid(null)).toBe(false);
  });

  it('updateValidation URL-encodes the id segment', async () => {
    mock.onPost('validation/update/v%2F1').reply(200, { updated: true });
    const ok = await userApi.updateValidation('v/1', {
      pieceColor: 'black',
      room: 'r1',
      userEmail: 'e',
      userId: 'u',
    });
    expect(ok).toBe(true);
    expect(mock.history.post[0].url).toBe('validation/update/v%2F1');
  });
});
