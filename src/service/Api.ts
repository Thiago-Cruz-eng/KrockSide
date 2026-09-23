import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { RefreshTokenRequest, RefreshTokenResponse } from '../types/auth';

// Vite expõe apenas as variáveis prefixadas com VITE_, via import.meta.env. As antigas
// REACT_APP_* eram substituídas em tempo de build pelo react-scripts e não existem mais.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:5001/';

export const HUB_URL =
  import.meta.env.VITE_HUB_URL ?? 'https://localhost:5001/chesshub';

/**
 * Tempo máximo de uma requisição REST.
 *
 * Sem limite, uma API que aceita a conexão e nunca responde deixa o botão em "Enviando…" para
 * sempre. Dez segundos é folgado para qualquer endpoint deste backend (todos são leitura ou
 * escrita de um documento) e curto o bastante para a tela reagir.
 */
export const REQUEST_TIMEOUT_MS = 10_000;

const ACCESS_TOKEN_PREFIX = 'accessToken';
const REFRESH_TOKEN_PREFIX = 'refreshToken';
const CURRENT_USER_KEY = 'currentUserId';

const ACCESS_TOKEN_KEY = (userId: string) => `${ACCESS_TOKEN_PREFIX}${userId}`;
const REFRESH_TOKEN_KEY = (userId: string) => `${REFRESH_TOKEN_PREFIX}${userId}`;

/**
 * Onde o token mora: `sessionStorage`, por aba.
 *
 * Era `localStorage`, que persiste até alguém apagar — fechar o navegador não encerrava a
 * sessão, e qualquer script na origem podia ler o token a qualquer momento depois. Em
 * `sessionStorage` o token morre com a aba, sobrevive a F5 e não é compartilhado entre abas.
 *
 * Consequência deliberada: **duas abas são duas sessões independentes**. O cenário de teste
 * "dois jogadores no mesmo navegador" continua funcionando — cada aba faz o próprio login — e
 * fica até mais isolado, porque o token de uma aba não aparece na outra. O que se perde é a
 * sessão sobreviver a fechar o navegador: o usuário loga de novo. É o custo aceito.
 *
 * Cookie `HttpOnly` seria melhor ainda, mas exige o backend emitir o cookie e proteger contra
 * CSRF — está pedido em `BACKEND_CHANGES.md`.
 */
const tokenStore = (): Storage => sessionStorage;

export function getStoredToken(userId?: string | null): string | null {
  if (!userId) return null;
  return tokenStore().getItem(ACCESS_TOKEN_KEY(userId));
}

export function getStoredRefreshToken(userId?: string | null): string | null {
  if (!userId) return null;
  return tokenStore().getItem(REFRESH_TOKEN_KEY(userId));
}

/**
 * Assinantes avisados quando a sessão guardada muda (login, logout, refresh).
 *
 * Existe por um bug de bloqueio: o HubProvider monta na raiz da aplicação, antes de
 * qualquer login, então a primeira negociação com o `/chesshub` vai sem token e leva 401.
 * O `withAutomaticReconnect` do SignalR só reage a uma conexão que caiu depois de ter
 * subido — ele NÃO repete uma conexão inicial que falhou. Resultado: depois do login a
 * conexão nunca era refeita, o lobby ficava permanentemente desconectado e mostrava
 * "Nenhuma sala aberta" para sempre, sem erro visível.
 *
 * O evento `storage` do navegador não serve: ele não dispara na aba que fez a escrita.
 */
type SessionListener = () => void;
const sessionListeners = new Set<SessionListener>();

/** Assina mudanças de sessão. Devolve a função de cancelamento. */
export function onSessionChange(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function notifySessionChange(): void {
  sessionListeners.forEach((listener) => listener());
}

/** Id do usuário corrente desta aba, ou null. */
export function getCurrentUserId(): string | null {
  return sessionStorage.getItem(CURRENT_USER_KEY);
}

/** Token da sessão corrente, ou null. É o que o hub usa para autenticar. */
export function getCurrentToken(): string | null {
  return getStoredToken(getCurrentUserId());
}

export function setStoredTokens(
  userId: string,
  accessToken: string,
  refreshToken?: string,
): void {
  tokenStore().setItem(ACCESS_TOKEN_KEY(userId), accessToken);
  if (refreshToken) {
    tokenStore().setItem(REFRESH_TOKEN_KEY(userId), refreshToken);
  }
  sessionStorage.setItem(CURRENT_USER_KEY, userId);
  notifySessionChange();
}

export function clearStoredTokens(userId: string): void {
  tokenStore().removeItem(ACCESS_TOKEN_KEY(userId));
  tokenStore().removeItem(REFRESH_TOKEN_KEY(userId));
  sessionStorage.removeItem(CURRENT_USER_KEY);
  notifySessionChange();
}

function tokenKeysOf(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && (key.startsWith(ACCESS_TOKEN_PREFIX) || key.startsWith(REFRESH_TOKEN_PREFIX))) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Encerra a sessão desta aba por completo: apaga **todo** token guardado, de qualquer usuário,
 * mais o `currentUserId`.
 *
 * É o que "Sair" deve fazer. `clearStoredTokens(userId)` limpa só um usuário e existe para o
 * caso em que se sabe exatamente qual — mas o botão de sair e a expiração de sessão não podem
 * deixar token de ninguém para trás, senão trocar o `:id` da URL herdava a sessão de outra conta.
 *
 * Também varre o `localStorage`: é onde a versão anterior guardava os tokens, e um usuário que
 * atualizou a aplicação ainda pode ter resquício lá. Nada mais lê de lá; só se apaga.
 */
export function clearAllStoredTokens(): void {
  tokenKeysOf(sessionStorage).forEach((key) => sessionStorage.removeItem(key));
  tokenKeysOf(localStorage).forEach((key) => localStorage.removeItem(key));
  sessionStorage.removeItem(CURRENT_USER_KEY);
  notifySessionChange();
}

/**
 * Para onde ir quando a sessão não pode ser renovada.
 *
 * `window.location.assign` em vez de `navigate` porque este módulo não conhece React nem o
 * router — e um recarregamento completo é o que se quer aqui: zera todo estado em memória,
 * inclusive a conexão com o hub. Fica atrás de uma função para o teste trocar por um espião
 * em vez de depender de `window.location`.
 */
export type SessionLostHandler = () => void;

export const redirectToLogin: SessionLostHandler = () => {
  window.location.assign('/');
};

/** Status HTTP de um erro do axios, ou `undefined` se não for erro HTTP (rede, timeout, código). */
export function httpStatusOf(err: unknown): number | undefined {
  if (!axios.isAxiosError(err)) return undefined;
  return err.response?.status;
}

/**
 * Renova a sessão do usuário corrente: gasta o refresh token e grava o par novo.
 *
 * **Single-flight.** N requisições que recebem 401 ao mesmo tempo chamam isto ao mesmo tempo, e
 * cada refresh token só vale uma vez (o backend rotaciona). Sem a trava, a primeira rotação
 * invalidaria o token que a segunda ia usar, a segunda falharia, e a sessão seria derrubada
 * exatamente na hora em que estava sendo renovada. Por isso a promise é compartilhada no módulo:
 * quem chega enquanto há um refresh em curso espera o mesmo resultado.
 *
 * Devolve o access token novo, ou `null` quando não deu — e nesse caso a sessão já foi
 * encerrada (`clearAllStoredTokens` + `onSessionLost`), porque um refresh token recusado
 * significa que não há mais como continuar sem senha.
 *
 * A chamada de refresh vai por uma instância **sem** interceptor de resposta: se ela mesma
 * levasse 401, o interceptor tentaria renovar de novo, em loop.
 */
let refreshInFlight: Promise<string | null> | null = null;

export interface RefreshOptions {
  baseURL?: string;
  onSessionLost?: SessionLostHandler;
  /** Usuário a renovar. Default: o corrente da aba. */
  userId?: string | null;
}

export function refreshSession(options: RefreshOptions = {}): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = doRefresh(options).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh({
  baseURL = API_BASE_URL,
  onSessionLost = redirectToLogin,
  userId = getCurrentUserId(),
}: RefreshOptions): Promise<string | null> {
  const refreshToken = getStoredRefreshToken(userId);
  if (!userId || !refreshToken) {
    endSession(onSessionLost);
    return null;
  }

  try {
    const bare = axios.create({ baseURL, timeout: REQUEST_TIMEOUT_MS });
    const body: RefreshTokenRequest = { userId, refreshToken };
    const { data } = await bare.post<RefreshTokenResponse>('refresh-token', body);

    if (!data.success || !data.accessToken || !data.refreshToken) {
      endSession(onSessionLost);
      return null;
    }

    // Os DOIS tokens: o refresh é rotativo, e o antigo acabou de ser revogado no servidor.
    setStoredTokens(userId, data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    // Rede, timeout, 429, 5xx: sem como distinguir "tente de novo" de "acabou", e a
    // requisição original já falhou. Encerrar é a saída segura.
    endSession(onSessionLost);
    return null;
  }
}

function endSession(onSessionLost: SessionLostHandler): void {
  clearAllStoredTokens();
  onSessionLost();
}

/**
 * Endpoints em que 401 é resposta de negócio, não sessão expirada.
 *
 * Login com senha errada e refresh com token revogado respondem 401 — e tentar renovar a sessão
 * a partir deles seria um loop (o refresh falha em 401, que dispara refresh, que...).
 */
const AUTH_ENDPOINTS = new Set(['login', 'register', 'refresh-token']);

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  // `new URL` com base fictícia normaliza os dois formatos que aparecem aqui: caminho relativo
  // (`login`, `/login`) e absoluto (`https://api/login`). Só o caminho interessa.
  const path = new URL(url, 'http://placeholder.invalid').pathname.replace(/^\/+/, '');
  return AUTH_ENDPOINTS.has(path);
}

/** Config de requisição com a marca de "já foi repetida uma vez". */
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

export interface CreateApiOptions {
  /** Chamado quando a sessão não pôde ser renovada. Default: recarrega em `/`. */
  onSessionLost?: SessionLostHandler;
}

export function createApi(
  baseURL: string = API_BASE_URL,
  { onSessionLost = redirectToLogin }: CreateApiOptions = {},
): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json' },
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getCurrentToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  });

  /**
   * 401 → um refresh → repete a requisição com o token novo.
   *
   * Uma vez só por requisição (`_retried`): se o token renovado também levar 401, o problema
   * não é expiração, e repetir de novo seria loop. E nunca para os endpoints de autenticação,
   * onde 401 é a resposta normal de "credencial inválida".
   */
  instance.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isExpiredSession =
      error.response?.status === 401 &&
      config !== undefined &&
      !config._retried &&
      !isAuthEndpoint(config.url);

    if (!isExpiredSession) throw error;

    const newToken = await refreshSession({ baseURL, onSessionLost });
    if (!newToken) throw error;

    config._retried = true;
    config.headers.set('Authorization', `Bearer ${newToken}`);
    return instance.request(config);
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
