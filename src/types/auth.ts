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

/**
 * Corpo de `POST /register` (auto-registro).
 *
 * Não tem `role` nem `createdBy` de propósito: o servidor decide os dois — papel fixo em
 * "jogador", autor em "self-registration". Quem precisa criar conta com outro papel usa
 * `POST /users`, que exige `Role:Admin`.
 *
 * Saíram daqui `dateBirth` e `phoneNumber`: o backend nunca os conheceu, os inputs nunca
 * eram renderizados na tela, e o formulário mandava um valor default para os dois.
 */
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

/** Resposta de `POST /register`: mesma forma do login, mais o nome. Já vem com sessão. */
export interface RegisterResponse {
  success: boolean;
  message: string;
  userId?: string;
  name?: string;
  email?: string;
  role?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

/**
 * Corpo de `POST /users` — criação administrativa, exige `Role:Admin`. Aqui o papel vem
 * pelo corpo; `createdBy` é ignorado pelo servidor, que usa o claim `sub` do chamador.
 *
 * O front não usa este endpoint hoje: cadastro de jogador é `POST /register`.
 */
export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  role: string;
}

/** Resposta de `POST /users`. Não traz token — criação administrativa não abre sessão. */
export interface CreateUserResponse {
  success: boolean;
  message: string;
  userId?: string;
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
