/**
 * JWT de teste, montado à mão.
 *
 * Só as duas primeiras partes importam para o cliente (`decodeToken` não valida assinatura), então
 * a terceira é um texto qualquer. Não importe uma biblioteca de JWT só para isto.
 */
export function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

const NOW_SECONDS = () => Math.floor(Date.now() / 1000);

/** Token válido por uma hora para o usuário `sub`, com os claims que o backend emite. */
export function validJwtFor(sub: string, extra: Record<string, unknown> = {}): string {
  return makeJwt({
    sub,
    name: `user-${sub}`,
    jti: 'jti',
    email: `${sub}@test.local`,
    exp: NOW_SECONDS() + 3600,
    ...extra,
  });
}

/** Token do usuário `sub` que expirou há dez minutos. */
export function expiredJwtFor(sub: string): string {
  return makeJwt({
    sub,
    name: `user-${sub}`,
    jti: 'jti',
    email: `${sub}@test.local`,
    exp: NOW_SECONDS() - 600,
  });
}

/** Guid fixo para os cenários que exigem id no formato do backend. */
export const GUID_1 = '11111111-1111-4111-8111-111111111111';
export const GUID_2 = '22222222-2222-4222-8222-222222222222';
