import { api } from './Api';
import {
  CanMoveRequest,
  CreateUserRequest,
  CreateUserResponse,
  GetUserResponse,
  GetValidationResponse,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  UpdateValidationRequest,
} from '../types/auth';

/**
 * Rotas conferidas contra o backend real em 2026-08-01 (UserController e
 * ValidationController). Três delas apontavam para endpoints que não existem e
 * respondiam 404 em produção:
 *
 *   'create'      -> 'users'          POST   /users
 *   'get/{id}'    -> 'users/{id}'     GET    /users/{id}
 *   'refresh'     -> 'refresh-token'  POST   /refresh-token
 *
 * A de `getUser` era a mais grave: é chamada ao entrar numa sala, então entrar em sala
 * pela interface falhava sempre. Era a DT-02 deste repositório.
 */
export const userApi = {
  async createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
    const res = await api.post<CreateUserResponse>('users', data);
    return res.data;
  },

  async getUser(id: string | undefined): Promise<GetUserResponse> {
    const res = await api.get<GetUserResponse>(`users/${id}`);
    return res.data;
  },

  async login(data: LoginRequest): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>('login', data);
    return res.data;
  },

  async refresh(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const res = await api.post<RefreshTokenResponse>('refresh-token', data);
    return res.data;
  },

  async verifyValidation(userId: string): Promise<boolean> {
    const res = await api.post<{ valid: boolean }>('validation/verify', {
      userId,
    });
    return res.data.valid;
  },

  async getValidation(userId: string): Promise<GetValidationResponse | null> {
    try {
      const res = await api.post<GetValidationResponse>('validation/get', {
        userId,
      });
      return res.data;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) return null;
      throw err;
    }
  },

  async updateValidation(
    id: string,
    data: UpdateValidationRequest,
  ): Promise<boolean> {
    const res = await api.post<{ updated: boolean }>(
      `validation/update/${id}`,
      data,
    );
    return res.data.updated;
  },

  async canMove(data: CanMoveRequest): Promise<boolean> {
    const res = await api.post<{ canMove: boolean }>('validation/can-move', data);
    return res.data.canMove;
  },
};

export default userApi;
