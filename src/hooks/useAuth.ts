import { useCallback, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { DecodedToken } from '../types/auth';
import {
  clearStoredTokens,
  getStoredRefreshToken,
  getStoredToken,
  setStoredTokens,
} from '../service/Api';

/**
 * Token de acesso guardado para um usuário, ou `null`.
 *
 * O storage é **por usuário** (`accessToken{userId}`), o que permite mais de uma conta na mesma
 * máquina sem uma sobrescrever a outra. Quem sabe montar essas chaves é `src/service/Api.ts`, e só
 * ele — nunca leia `localStorage` direto de um componente.
 */
export function readToken(userId: string | undefined): string | null {
  return getStoredToken(userId ?? null);
}

/**
 * Abre o JWT e devolve o conteúdo, ou `null` se ele não for decodificável.
 *
 * **Decodificar não é validar.** As duas primeiras partes de um JWT são só Base64: qualquer um lê, e
 * qualquer um consegue escrever um token com o conteúdo que quiser. Quem verifica a assinatura é o
 * **servidor**, com a chave secreta. Aqui a decodificação serve apenas para a interface saber o que
 * exibir — nunca para autorizar nada.
 *
 * Token malformado devolve `null` em vez de estourar: ele vem do storage e pode estar truncado ou
 * ser resquício de uma versão anterior.
 */
export function decodeToken(token: string | null): DecodedToken | null {
  if (!token) return null;
  try {
    return jwtDecode<DecodedToken>(token);
  } catch {
    return null;
  }
}

/**
 * O token ainda está no prazo?
 *
 * Checagem apenas de **expiração**, e apenas do lado do cliente: serve para a interface mandar o
 * usuário ao login em vez de deixá-lo tomar 401 numa ação. Um token expirado não é aceito pelo
 * servidor de qualquer forma, e um token adulterado passaria por aqui sem passar por lá.
 *
 * O `* 1000` existe porque `exp` é em **segundos** desde 1970 (padrão JWT) e `Date.now()` é em
 * milissegundos. Esquecer essa multiplicação faz todo token parecer expirado desde 1970.
 */
export function isTokenValid(decoded: DecodedToken | null): boolean {
  if (!decoded) return false;
  return decoded.exp * 1000 > Date.now();
}

export interface AuthState {
  /** Access token do usuário corrente. */
  token: string | null;
  /** Refresh token guardado, para renovar sem pedir senha. */
  refreshToken: string | null;
  /** Conteúdo do access token, ou `null` se ausente/ilegível. */
  decoded: DecodedToken | null;
  /** O token existe e não expirou. Ver a nota em `isTokenValid`. */
  isValid: boolean;
}

export interface AuthActions {
  /** Grava a sessão de um usuário e passa a tratá-lo como o usuário corrente. */
  setTokens: (userId: string, accessToken: string, refreshToken?: string) => void;
  /** Apaga a sessão do usuário. */
  logout: (userId: string) => void;
}

/**
 * A sessão do usuário de `userId`, como estado de React.
 *
 * **Por que recebe o `userId` por parâmetro** em vez de descobri-lo sozinho: o id vem da rota
 * (`/chess-lobby/:id`), então navegar entre contas troca de sessão. O efeito abaixo ressincroniza o
 * estado quando isso acontece.
 *
 * Este hook não fala com a rede. Quem faz login é `userApi.login`; aqui só se guarda o resultado.
 */
export function useAuth(userId: string | undefined): AuthState & AuthActions {
  // Inicialização por função (`() => ...`): sem isso, `readToken` correria em todo render, e não
  // apenas no primeiro.
  const [token, setTokenState] = useState<string | null>(() => readToken(userId));
  const [refreshToken, setRefreshTokenState] = useState<string | null>(() =>
    getStoredRefreshToken(userId ?? null),
  );

  useEffect(() => {
    // Relê do storage quando o usuário da rota muda — é o que faz trocar de conta funcionar sem
    // recarregar a página.
    setTokenState(readToken(userId));
    setRefreshTokenState(getStoredRefreshToken(userId ?? null));

    // `currentUserId` é como o interceptor do axios descobre qual dos tokens guardados usar. Sem
    // esta linha, navegar direto para uma URL de lobby deixaria as requisições sem Authorization.
    if (userId) sessionStorage.setItem('currentUserId', userId);
  }, [userId]);

  // Derivados, não estado: recalcular a cada render é barato e elimina a chance de o token e o seu
  // conteúdo decodificado ficarem fora de sincronia.
  const decoded = decodeToken(token);
  const isValid = isTokenValid(decoded);

  const setTokens = useCallback(
    (id: string, accessToken: string, refresh?: string) => {
      // Grava primeiro, atualiza o estado depois. `setStoredTokens` também avisa os assinantes de
      // sessão, o que é o que faz o HubProvider reabrir a conexão agora autenticada.
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
