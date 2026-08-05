import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

// Vite expõe apenas as variáveis prefixadas com VITE_, via import.meta.env. As antigas
// REACT_APP_* eram substituídas em tempo de build pelo react-scripts e não existem mais.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:5001/';

export const HUB_URL =
  import.meta.env.VITE_HUB_URL ?? 'https://localhost:5001/chesshub';

const ACCESS_TOKEN_KEY = (userId: string) => `accessToken${userId}`;
const REFRESH_TOKEN_KEY = (userId: string) => `refreshToken${userId}`;

export function getStoredToken(userId?: string | null): string | null {
  if (!userId) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY(userId));
}

export function getStoredRefreshToken(userId?: string | null): string | null {
  if (!userId) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY(userId));
}

export function setStoredTokens(
  userId: string,
  accessToken: string,
  refreshToken?: string,
): void {
  localStorage.setItem(ACCESS_TOKEN_KEY(userId), accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY(userId), refreshToken);
  }
  sessionStorage.setItem('currentUserId', userId);
}

export function clearStoredTokens(userId: string): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY(userId));
  localStorage.removeItem(REFRESH_TOKEN_KEY(userId));
  sessionStorage.removeItem('currentUserId');
}

export function createApi(baseURL: string = API_BASE_URL): AxiosInstance {
  const instance = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const userId = sessionStorage.getItem('currentUserId');
    const token = getStoredToken(userId);
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  });

  return instance;
}

/**
 * Instância única usada por `api`. Exportada para que os testes anexem um
 * axios-mock-adapter à instância real, em vez de reconstruí-la com `vi.mock` +
 * `require('axios')` — o `require` nem existe mais, agora que o pacote é ESM.
 */
export const httpClient = createApi();

const axiosInstance = httpClient;

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    axiosInstance.get<T>(url, config),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosInstance.post<T>(url, data, config),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosInstance.put<T>(url, data, config),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    axiosInstance.delete<T>(url, config),
};

export default api;
