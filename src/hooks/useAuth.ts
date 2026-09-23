import { useCallback, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { DecodedToken } from '../types/auth';
import {
  clearAllStoredTokens,
  getStoredRefreshToken,
  getStoredToken,
  onSessionChange,
  refreshSession,
  setStoredTokens,
} from '../service/Api';

/**
 * Token de acesso guardado para um usuário, ou `null`.
 *
 * O storage é **por usuário** (`accessToken{userId}`), o que permite mais de uma conta na mesma
 * máquina sem uma sobrescrever a outra. Quem sabe montar essas chaves é `src/service/Api.ts`, e só
 * ele — nunca leia `sessionStorage` direto de um componente.
 *
 * Leitura **bruta**: devolve o que está guardado, expirado ou não, de quem for. Para saber se há
 * sessão utilizável para o `userId`, use `readSessionToken`.
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

/**
 * O que o storage diz sobre a sessão de `userId`, classificado.
 *
 * - `none`: não há token para esse id, ou há mas o `sub` dele é de **outro** usuário. Nos dois
 *   casos não existe sessão para o `:id` da rota — e é isso que impede trocar o id na URL e
 *   herdar a sessão de quem estava logado antes.
 * - `expired`: token do usuário certo, fora do prazo, **com** refresh token guardado. Dá para
 *   renovar sem senha.
 * - `valid`: token do usuário certo e no prazo.
 */
type SessionStatus =
  | { kind: 'none' }
  | { kind: 'expired'; refreshToken: string }
  | { kind: 'valid'; token: string; refreshToken: string | null };

function readSessionStatus(userId: string | undefined): SessionStatus {
  const token = readToken(userId);
  const decoded = decodeToken(token);
  if (!userId || !token || !decoded || decoded.sub !== userId) return { kind: 'none' };

  const refreshToken = getStoredRefreshToken(userId);
  if (isTokenValid(decoded)) return { kind: 'valid', token, refreshToken };
  if (refreshToken) return { kind: 'expired', refreshToken };
  return { kind: 'none' };
}

/**
 * Token utilizável para `userId`, ou `null`.
 *
 * Exige três coisas ao mesmo tempo: existir token guardado para esse id, o `sub` do token ser esse
 * id, e ele não ter expirado. Faltando qualquer uma, não há sessão — mesmo que haja um token de
 * outro usuário no storage.
 */
export function readSessionToken(userId: string | undefined): string | null {
  const status = readSessionStatus(userId);
  return status.kind === 'valid' ? status.token : null;
}

export interface AuthState {
  /** Access token do usuário corrente, quando há sessão válida para ele. */
  token: string | null;
  /** Refresh token guardado, para renovar sem pedir senha. */
  refreshToken: string | null;
  /** Conteúdo do access token, ou `null` se ausente/ilegível. */
  decoded: DecodedToken | null;
  /** O token existe, é deste usuário e não expirou. Ver a nota em `isTokenValid`. */
  isValid: boolean;
  /** O token expirou e uma renovação com o refresh token está em curso. */
  refreshing: boolean;
}

export interface AuthActions {
  /** Grava a sessão de um usuário e passa a tratá-lo como o usuário corrente. */
  setTokens: (userId: string, accessToken: string, refreshToken?: string) => void;
  /**
   * Encerra a sessão da aba: apaga **todos** os tokens guardados, não só os de `userId`.
   *
   * O parâmetro é mantido pela assinatura histórica e por legibilidade no chamador
   * (`logout(id)` diz de quem se está saindo), mas não restringe a limpeza — sair não pode deixar
   * o token de nenhuma conta para trás.
   */
  logout: (userId: string) => void;
}

/**
 * A sessão do usuário de `userId`, como estado de React.
 *
 * **Por que recebe o `userId` por parâmetro** em vez de descobri-lo sozinho: o id vem da rota
 * (`/chess-lobby/:id`), então navegar entre contas troca de sessão. O efeito abaixo ressincroniza o
 * estado quando isso acontece.
 *
 * **O id da rota não é confiável por si só.** Só vira sessão corrente (`currentUserId`) se houver
 * token guardado para ele, cujo `sub` seja ele, e no prazo. Antes qualquer `:id` era gravado como
 * corrente, e trocar o id na URL fazia o interceptor procurar o token daquele id — não achava,
 * mas o `currentUserId` ficava apontando para um usuário que nunca logou.
 *
 * Este hook não fala com a rede, com uma exceção: token expirado com refresh token disponível
 * dispara `refreshSession` (single-flight, em `Api.ts`). Quem faz login é `userApi.login`; aqui só
 * se guarda o resultado.
 */
export function useAuth(userId: string | undefined): AuthState & AuthActions {
  // Inicialização por função (`() => ...`): sem isso, a leitura correria em todo render, e não
  // apenas no primeiro.
  const [status, setStatus] = useState<SessionStatus>(() => readSessionStatus(userId));

  useEffect(() => {
    // Relê do storage quando o usuário da rota muda — é o que faz trocar de conta funcionar sem
    // recarregar a página — e quando a sessão guardada muda por fora (login em outra tela, refresh
    // feito pelo interceptor, logout).
    //
    // As decisões abaixo usam a leitura FRESCA (`next`), nunca o `status` do render anterior: ao
    // trocar de `u1` (válido) para `u2` (sem token), um efeito que olhasse o estado antigo gravaria
    // `currentUserId = u2` antes de o estado alcançar a troca — exatamente a herança de sessão que
    // esta checagem existe para impedir.
    const sync = () => {
      const next = readSessionStatus(userId);
      setStatus(next);
      if (!userId) return;
      if (next.kind === 'valid') {
        // `currentUserId` é como o interceptor do axios e o hub descobrem qual dos tokens guardados
        // usar. Só é gravado com sessão válida confirmada — nunca a partir do id da URL sozinho.
        sessionStorage.setItem('currentUserId', userId);
      } else if (next.kind === 'expired') {
        // Renovação proativa: o token venceu com a tela aberta (ou entre um F5 e outro). Sucesso
        // regrava os dois tokens e avisa os assinantes — inclusive este hook, que volta aqui e
        // encontra `valid`. Falha limpa o storage e leva ao login. Single-flight em `Api.ts`, então
        // chamar de novo enquanto uma renovação corre é inofensivo.
        void refreshSession({ userId });
      }
    };
    sync();
    return onSessionChange(sync);
  }, [userId]);

  // Derivados, não estado: recalcular a cada render é barato e elimina a chance de o token e o seu
  // conteúdo decodificado ficarem fora de sincronia.
  const token = status.kind === 'valid' ? status.token : null;
  const refreshToken = status.kind === 'none' ? null : status.refreshToken;
  const decoded = decodeToken(token);
  const isValid = isTokenValid(decoded);
  const refreshing = status.kind === 'expired';

  const setTokens = useCallback(
    (id: string, accessToken: string, refresh?: string) => {
      // `setStoredTokens` avisa os assinantes de sessão — o HubProvider, que reabre a conexão agora
      // autenticada, e este próprio hook, que relê o storage. Se `id` não for o `userId` deste hook
      // (caso do Login, que chama `useAuth(undefined)`), o estado aqui continua vazio, e é o certo:
      // a sessão pertence à tela seguinte.
      setStoredTokens(id, accessToken, refresh);
    },
    [],
  );

  const logout = useCallback((_id: string) => {
    clearAllStoredTokens();
  }, []);

  return { token, refreshToken, decoded, isValid, refreshing, setTokens, logout };
}
