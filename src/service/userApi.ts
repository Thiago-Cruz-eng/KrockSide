import { api } from './Api';
import {
  CanMoveRequest,
  CreateUserRequest,
  RegisterRequest,
  RegisterResponse,
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
 * Todas as chamadas REST ao backend, num objeto só.
 *
 * Nenhum componente importa `axios`: quem quiser falar com o servidor usa este módulo, e é o
 * interceptor de `Api.ts` que anexa o `Authorization`. As URLs são **relativas** — a base vem de
 * `VITE_API_BASE_URL`.
 *
 * Note que as rotas **não** têm prefixo `api/v1`: o `UserController` do backend declara
 * `[Route("api/v1/[controller]")]` na classe, mas toda action usa rota absoluta, o que anula o
 * prefixo. Os endpoints reais são `/login`, `/users`, `/register`.
 *
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
 *
 * **A lição de como ela sobreviveu importa mais que a correção:** os dublês do MSW e do Playwright
 * reproduziam as rotas erradas, então a suíte ficava verde contra o mesmo erro que o código tinha.
 * Mock que espelha o bug não testa nada. Ao mexer em rota, **confira contra o backend real** e
 * corrija rota e mock no mesmo commit.
 */
export const userApi = {
  /** Auto-registro: o servidor fixa papel e autor, e devolve sessão pronta. */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const res = await api.post<RegisterResponse>('register', data);
    return res.data;
  },

  /** Criação administrativa. Exige `Role:Admin` — não é o caminho de cadastro do jogador. */
  async createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
    const res = await api.post<CreateUserResponse>('users', data);
    return res.data;
  },

  /**
   * Dados de um usuário. Chamada ao entrar numa sala, para pegar o nome do jogador.
   *
   * O campo é `name`, não `userName` — o front esperou `userName` por um tempo, recebia `undefined`,
   * e um `if (!user.userName) return;` no lobby abortava a entrada na sala **em silêncio**. Faz
   * parte do DT-03.
   */
  async getUser(id: string | undefined): Promise<GetUserResponse> {
    const res = await api.get<GetUserResponse>(`users/${id}`);
    return res.data;
  },

  /**
   * Autentica. Único endpoint que devolve o refresh token **em claro** — o servidor guarda só o hash,
   * então se o cliente não gravar agora o valor está perdido.
   *
   * Falha de credencial vem como `success: false` com HTTP 401, não como exceção de rede.
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>('login', data);
    return res.data;
  },

  /**
   * Renova a sessão. **Gasta** o refresh token enviado: a resposta traz um novo, e é ele que precisa
   * ser guardado. Reenviar o antigo falha, porque o servidor o revogou ao rotacionar.
   */
  async refresh(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const res = await api.post<RefreshTokenResponse>('refresh-token', data);
    return res.data;
  },

  /** Existe autorização de sessão para este usuário? Ver a nota sobre `/validation` no fim do arquivo. */
  async verifyValidation(userId: string): Promise<boolean> {
    const res = await api.post<{ valid: boolean }>('validation/verify', {
      userId,
    });
    return res.data.valid;
  },

  /**
   * A autorização de sessão do usuário, ou `null` quando não existe.
   *
   * O 404 é convertido em `null` porque "não tem validação" é resposta esperada, não falha. Qualquer
   * outro status continua estourando — 401 e 403 não devem ser confundidos com ausência.
   *
   * Cuidado: hoje o servidor **não** responde 404 nesse caso. `GetValidationByUserToken` lança
   * exceção quando não encontra, e o controller não a trata, então o que chega é **500** — que este
   * `catch` deixa propagar. É defeito do backend, registrado no
   * `docs/guia-do-desenvolvedor.md` dele. O tratamento aqui está correto para quando ele for
   * consertado.
   */
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

  /**
   * Grava sala e cor na autorização.
   *
   * @param id Vai na URL porque a rota o declara, e o servidor o **ignora** — ele localiza o registro
   *   por usuário e token.
   */
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

  /**
   * O usuário pode mover esta cor nesta sala?
   *
   * **Não é o que autoriza um lance.** O `ChessHub` revalida turno, posse e legalidade sozinho e não
   * consulta este endpoint: um `true` aqui não garante que o lance passe, e um `false` não o impede.
   * Os campos `userEmail` e `day` do request são obrigatórios e **ignorados** pelo servidor.
   */
  async canMove(data: CanMoveRequest): Promise<boolean> {
    const res = await api.post<{ canMove: boolean }>('validation/can-move', data);
    return res.data.canMove;
  },
};

export default userApi;
