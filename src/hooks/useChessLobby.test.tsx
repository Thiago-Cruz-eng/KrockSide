import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { HubConnectionState } from '@microsoft/signalr';
import type { Mock } from 'vitest';
import { INVALID_ROOM_NAME_MESSAGE, useChessLobby } from './useChessLobby';
import { createFakeHub, HubTestProvider } from '../test-utils/hub';
import { GUID_1, validJwtFor } from '../test-utils/jwt';
import userApi from '../service/userApi';
import { CreateRoomResponse, JoinRoomResponse } from '../types/chess';

vi.mock('../service/userApi', () => ({
  __esModule: true,
  default: {
    getUser: vi.fn(),
    verifyValidation: vi.fn(),
    getValidation: vi.fn(),
    updateValidation: vi.fn(),
  },
}));

const mockedGetUser = userApi.getUser as Mock<typeof userApi.getUser>;
const mockedVerify = userApi.verifyValidation as Mock<typeof userApi.verifyValidation>;
const mockedGetValidation = userApi.getValidation as Mock<typeof userApi.getValidation>;

function wrapWith(hub: ReturnType<typeof createFakeHub>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <HubTestProvider hub={hub}>{children}</HubTestProvider>;
  };
}

/** Hub conectado que responde vazio ao carregamento do lobby e delega o resto a `impl`. */
function lobbyHub(impl: (method: string, ...args: unknown[]) => Promise<unknown>) {
  const hub = createFakeHub(HubConnectionState.Connected);
  const calls: Array<{ method: string; args: unknown[] }> = [];
  hub.setInvoke(async (method, ...args) => {
    calls.push({ method, args });
    if (method === 'GetAvailableRooms') return [];
    if (method === 'GetPlayersInEachRoom') return {};
    return impl(method, ...args);
  });
  return { hub, calls };
}

describe('useChessLobby', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem(`accessToken${GUID_1}`, validJwtFor(GUID_1));
  });

  describe('createRoom', () => {
    it('refuses an invalid name locally, in Portuguese, without calling the hub', async () => {
      const { hub, calls } = lobbyHub(async () => {
        throw new Error('should not be invoked');
      });
      const { result } = renderHook(() => useChessLobby(GUID_1), { wrapper: wrapWith(hub) });

      await act(async () => {
        await result.current.createRoom('sala<script>');
      });

      expect(result.current.errorMessage).toBe(INVALID_ROOM_NAME_MESSAGE);
      expect(calls.some((c) => c.method === 'CreateRoom')).toBe(false);
    });

    it.each(['a'.repeat(65), 'sala/1', 'sala.1', 'sala@x'])(
      'rejects %j before sending',
      async (name) => {
        const { hub, calls } = lobbyHub(async () => ({}));
        const { result } = renderHook(() => useChessLobby(GUID_1), { wrapper: wrapWith(hub) });

        await act(async () => {
          await result.current.createRoom(name);
        });

        expect(result.current.errorMessage).toBe(INVALID_ROOM_NAME_MESSAGE);
        expect(calls.some((c) => c.method === 'CreateRoom')).toBe(false);
      },
    );

    it('sends a valid Unicode name (trimmed) and adds the room on success', async () => {
      const created: CreateRoomResponse = {
        success: true,
        room: 'Sala Ação_1',
        alreadyExisted: false,
      };
      const { hub, calls } = lobbyHub(async (method) => {
        if (method === 'CreateRoom') return created;
        throw new Error(`unexpected ${method}`);
      });
      const { result } = renderHook(() => useChessLobby(GUID_1), { wrapper: wrapWith(hub) });

      await act(async () => {
        await result.current.createRoom('  Sala Ação_1  ');
      });

      const call = calls.find((c) => c.method === 'CreateRoom');
      expect(call?.args).toEqual(['Sala Ação_1']);
      expect(result.current.rooms).toContain('Sala Ação_1');
      expect(result.current.errorMessage).toBeNull();
    });

    it('shows the server message when the server refuses (success: false)', async () => {
      const refused: CreateRoomResponse = {
        success: false,
        message: 'Room limit reached',
        room: 'sala-x',
        alreadyExisted: false,
      };
      const { hub } = lobbyHub(async (method) => {
        if (method === 'CreateRoom') return refused;
        throw new Error(`unexpected ${method}`);
      });
      const { result } = renderHook(() => useChessLobby(GUID_1), { wrapper: wrapWith(hub) });

      await act(async () => {
        await result.current.createRoom('sala-x');
      });

      // Mensagem do servidor exibida como veio, e a sala NÃO entra na lista local.
      expect(result.current.errorMessage).toBe('Room limit reached');
      expect(result.current.rooms).not.toContain('sala-x');
    });

    it('warns when the room already existed', async () => {
      const { hub } = lobbyHub(async (method) => {
        if (method === 'CreateRoom') {
          return { success: true, room: 'dup', alreadyExisted: true } as CreateRoomResponse;
        }
        throw new Error(`unexpected ${method}`);
      });
      const { result } = renderHook(() => useChessLobby(GUID_1), { wrapper: wrapWith(hub) });

      await act(async () => {
        await result.current.createRoom('dup');
      });

      expect(result.current.errorMessage).toBe('Sala já existe.');
      expect(result.current.rooms).toContain('dup');
    });
  });

  describe('joinRoom', () => {
    it('returns the board route with the room name URL-encoded', async () => {
      mockedGetUser.mockResolvedValue({
        id: GUID_1,
        name: 'Ana',
        email: 'ana@b.com',
        role: 'jogador',
        mustChangePassword: false,
      });
      mockedVerify.mockResolvedValue(true);
      mockedGetValidation.mockResolvedValue(null);
      const joined: JoinRoomResponse = {
        connectionId: 'c1',
        player: 'Ana',
        room: 'sala um',
        color: 'White',
      };
      const { hub, calls } = lobbyHub(async (method) => {
        if (method === 'JoinRoom') return joined;
        throw new Error(`unexpected ${method}`);
      });
      const { result } = renderHook(() => useChessLobby(GUID_1), { wrapper: wrapWith(hub) });
      await waitFor(() => expect(result.current.connected).toBe(true));

      act(() => result.current.setPreferredColor('White'));
      let route: string | null = null;
      await act(async () => {
        route = await result.current.joinRoom('sala um');
      });

      expect(route).toBe(`/chess-board/sala%20um/${GUID_1}`);
      expect(mockedGetUser).toHaveBeenCalledWith(GUID_1);
      const join = calls.find((c) => c.method === 'JoinRoom');
      expect(join?.args).toEqual(['Ana', 'sala um', 'White']);
    });

    it('refuses without a valid session for the route id', async () => {
      sessionStorage.clear(); // sem token
      const { hub, calls } = lobbyHub(async () => ({}));
      const { result } = renderHook(() => useChessLobby(GUID_1), { wrapper: wrapWith(hub) });

      act(() => result.current.setPreferredColor('White'));
      let route: string | null = 'unset';
      await act(async () => {
        route = await result.current.joinRoom('sala');
      });

      expect(route).toBeNull();
      expect(result.current.errorMessage).toBe('Sessão inválida. Faça login novamente.');
      expect(calls.some((c) => c.method === 'JoinRoom')).toBe(false);
      expect(mockedGetUser).not.toHaveBeenCalled();
    });
  });
});
