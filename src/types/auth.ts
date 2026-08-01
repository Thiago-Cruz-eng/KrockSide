export interface DecodedToken {
  sub: string;
  name: string;
  jti: string;
  emailAddress: string;
  exp: number;
  role?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  email?: string;
  userId?: string;
  role?: string;
  mustChangePassword: boolean;
  message: string;
}

export interface RefreshTokenRequest {
  userId: string;
  refreshToken: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  message?: string;
}

export interface CreateUserRequest {
  userName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  dateBirth: Date | string;
  phoneNumber: string;
}

export interface CreateUserResponse {
  success: boolean;
  email: string;
  accessToken: string;
  message: string;
  userId: string;
}

/**
 * Contrato real de `GET /users/{id}` (Orchestrator/UseCases/Dto/Response/GetUserResponse.cs),
 * conferido contra o backend em 2026-08-01.
 *
 * Este tipo declarava `userName`, que o backend nunca envia — o campo se chama `name`.
 * `user.userName` era sempre `undefined`, e o `if (!user.userName) return` do lobby abortava
 * a entrada na sala em silêncio, sem mensagem nenhuma para o jogador.
 */
export interface GetUserResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  assignments?: unknown[];
}

export interface GetValidationResponse {
  id: string;
  userId: string;
  userEmail: string;
  room: string | null;
  pieceColor: string | null;
  dayOfGame: string;
}

export interface UpdateValidationRequest {
  userId: string;
  room: string;
  pieceColor: string;
  userEmail: string;
}

export interface CanMoveRequest {
  userId: string;
  room: string;
  pieceColor: string;
  userEmail: string;
  day: string;
}
