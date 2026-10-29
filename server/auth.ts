import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type UserRole = 'admin' | 'gerente' | 'supervisor' | 'operador';

export interface TokenPayload {
  userId: string;
  username: string;
  role: UserRole;
  exp: number;
}

const COOKIE_NAME = 'benhermes_token';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'benhermes-local-server-secret-key-2026';
}

/**
 * Gera um hash seguro da senha usando scrypt e salt aleatório.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verifica se a senha corresponde ao hash salvo usando comparação em tempo constante.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

/**
 * Cria um token assinado (formato base64url(payload).base64url(hmac)).
 */
export function signAuthToken(user: { id: string; username: string; role: UserRole }): string {
  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getJwtSecret())
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

/**
 * Valida o token assinado e retorna o payload caso seja autêntico e não esteja expirado.
 */
export function verifyAuthToken(token: string): TokenPayload | null {
  if (!token || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getJwtSecret())
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as TokenPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extrai o token da requisição (cookie benhermes_token ou header Authorization: Bearer).
 */
export function extractTokenFromRequest(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === 'string') {
    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const [k, ...vParts] = part.trim().split('=');
      if (k === COOKIE_NAME) {
        return decodeURIComponent(vParts.join('='));
      }
    }
  }

  return null;
}

/**
 * Define o cookie HttpOnly de autenticação na resposta.
 */
export function setAuthCookie(res: ServerResponse, token: string): void {
  const maxAgeSec = Math.floor(TOKEN_TTL_MS / 1000);
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`
  );
}

/**
 * Remove o cookie de autenticação na resposta.
 */
export function clearAuthCookie(res: ServerResponse): void {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

