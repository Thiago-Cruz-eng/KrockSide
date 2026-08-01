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

export const userApi = {
  async createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
    const res = await api.post<CreateUserResponse>('create', data);
    return res.data;
  },

  async getUser(id: string | undefined): Promise<GetUserResponse> {
    const res = await api.get<GetUserResponse>(`get/${id}`);
    return res.data;
  },

  async login(data: LoginRequest): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>('login', data);
    return res.data;
  },

  async refresh(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const res = await api.post<RefreshTokenResponse>('refresh', data);
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
