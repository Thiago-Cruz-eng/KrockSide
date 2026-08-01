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

export interface GetUserResponse {
  userName: string;
  email: string;
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
