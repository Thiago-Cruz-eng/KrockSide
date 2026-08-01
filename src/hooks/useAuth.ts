import { useCallback, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { DecodedToken } from '../types/auth';
import {
  clearStoredTokens,
  getStoredRefreshToken,
  getStoredToken,
  setStoredTokens,
} from '../service/Api';

export function readToken(userId: string | undefined): string | null {
  return getStoredToken(userId ?? null);
}

export function decodeToken(token: string | null): DecodedToken | null {
  if (!token) return null;
  try {
    return jwtDecode<DecodedToken>(token);
  } catch {
    return null;
  }
}

export function isTokenValid(decoded: DecodedToken | null): boolean {
  if (!decoded) return false;
  return decoded.exp * 1000 > Date.now();
}

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  decoded: DecodedToken | null;
  isValid: boolean;
}

export interface AuthActions {
  setTokens: (userId: string, accessToken: string, refreshToken?: string) => void;
  logout: (userId: string) => void;
}

export function useAuth(userId: string | undefined): AuthState & AuthActions {
  const [token, setTokenState] = useState<string | null>(() => readToken(userId));
  const [refreshToken, setRefreshTokenState] = useState<string | null>(() =>
    getStoredRefreshToken(userId ?? null),
  );

  useEffect(() => {
    setTokenState(readToken(userId));
    setRefreshTokenState(getStoredRefreshToken(userId ?? null));
    if (userId) sessionStorage.setItem('currentUserId', userId);
  }, [userId]);

  const decoded = decodeToken(token);
  const isValid = isTokenValid(decoded);

  const setTokens = useCallback(
    (id: string, accessToken: string, refresh?: string) => {
      setStoredTokens(id, accessToken, refresh);
      setTokenState(accessToken);
      if (refresh) setRefreshTokenState(refresh);
    },
    [],
  );

  const logout = useCallback((id: string) => {
    clearStoredTokens(id);
    setTokenState(null);
    setRefreshTokenState(null);
  }, []);

  return { token, refreshToken, decoded, isValid, setTokens, logout };
}
