import MockAdapter from 'axios-mock-adapter';

jest.mock('./Api', () => {
  const axiosLib = require('axios');
  const axiosFactory = axiosLib.default || axiosLib;
  const instance = axiosFactory.create({ baseURL: 'http://test/' });
  return {
    __esModule: true,
    __instance: instance,
    api: {
      get: (url: string, c?: object) => instance.get(url, c),
      post: (url: string, d?: unknown, c?: object) => instance.post(url, d, c),
      put: (url: string, d?: unknown, c?: object) => instance.put(url, d, c),
      delete: (url: string, c?: object) => instance.delete(url, c),
    },
    API_BASE_URL: 'http://test/',
    HUB_URL: 'http://test/hub',
    getStoredToken: () => null,
    getStoredRefreshToken: () => null,
    setStoredTokens: () => undefined,
    clearStoredTokens: () => undefined,
    createApi: () => instance,
  };
});

import userApi from './userApi';
const ApiModule = require('./Api');

describe('userApi', () => {
  let mock = new MockAdapter(ApiModule.__instance);

  beforeEach(() => {
    mock = new MockAdapter(ApiModule.__instance);
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

  it('createUser posts payload', async () => {
    mock.onPost('create').reply((config) => {
      const body = JSON.parse(config.data);
      expect(body.userName).toBe('thiago');
      return [
        200,
        {
          success: true,
          userId: 'u2',
          message: '',
          email: '',
          accessToken: '',
        },
      ];
    });
    const res = await userApi.createUser({
      userName: 'thiago',
      email: 'a@b.com',
      password: 'pw',
      passwordConfirmation: 'pw',
      dateBirth: '2000-01-01',
      phoneNumber: '123',
    });
    expect(res.success).toBe(true);
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
    mock.onPost('refresh').reply(200, {
      success: true,
      accessToken: 'new',
      refreshToken: 'new-r',
      expiresAt: '2027-01-01T00:00:00Z',
    });
    const res = await userApi.refresh({ userId: 'u', refreshToken: 'r' });
    expect(res.accessToken).toBe('new');
  });

  it('getUser GETs by id', async () => {
    mock.onGet('get/u1').reply(200, { userName: 'thiago', email: 'a@b.com' });
    const res = await userApi.getUser('u1');
    expect(res.userName).toBe('thiago');
  });
});
