import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Lista padrão de IPs e blocos CIDR liberados para acessar o servidor local:
 * - 2804:431:80f7:7700::/48
 * - 2804:1b3:a5e7:c3c7::/48
 * - 201.93.163.133
 * - 2804:1b3:a5e7:2c83::/48
 * - 201.93.159.169
 * - 2804:1b3:a5e7:8e38::/48
 * + Loopback local (127.0.0.1 e ::1) para healthcheck e acesso no próprio host.
 */
export const DEFAULT_ALLOWED_IPS: string[] = [
  '2804:431:80f7:7700::/48',
  '2804:1b3:a5e7:c3c7::/48',
  '201.93.163.133',
  '2804:1b3:a5e7:2c83::/48',
  '201.93.159.169',
  '2804:1b3:a5e7:8e38::/48',
  '127.0.0.1',
  '::1',
];

interface ParsedIp {
  version: 4 | 6;
  value: bigint;
}

interface ParsedCidr {
  version: 4 | 6;
  network: bigint;
  mask: bigint;
  raw: string;
}

/**
 * Remove colchetes, porta ou sufixo de zona (%eth0) de um endereço IP bruto.
 */
export function normalizeIpString(raw: string): string {
  let s = raw.trim();
  if (!s) return '';

  // Se vier no formato [2804:...]:12345
  if (s.startsWith('[')) {
    const closeIdx = s.indexOf(']');
    if (closeIdx !== -1) {
      s = s.slice(1, closeIdx);
    }
  } else if (s.includes('.') && s.includes(':') && !s.includes('::') && s.split(':').length === 2) {
    // Formato IPv4:porta (ex.: 201.93.163.133:54321)
    s = s.split(':')[0];
  }

  // Remove zone index (ex.: fe80::1%eth0)
  const zoneIdx = s.indexOf('%');
  if (zoneIdx !== -1) {
    s = s.slice(0, zoneIdx);
  }

  return s.toLowerCase();
}

/**
 * Converte um endereço IPv4 (a.b.c.d) em BigInt de 32 bits, ou null se inválido.
 */
export function parseIpv4(ip: string): bigint | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const num = Number(part);
    if (num < 0 || num > 255) return null;
    result = (result << 8n) | BigInt(num);
  }
  return result;
}

/**
 * Converte um endereço IPv6 em BigInt de 128 bits, ou null se inválido.
 */
export function parseIpv6(ip: string): bigint | null {
  let working = ip;

  // Caso termine com IPv4 embutido (ex.: ::ffff:201.93.163.133)
  const lastColon = working.lastIndexOf(':');
  if (lastColon !== -1 && working.slice(lastColon + 1).includes('.')) {
    const ipv4Part = working.slice(lastColon + 1);
    const v4 = parseIpv4(ipv4Part);
    if (v4 === null) return null;
    const high = Number((v4 >> 16n) & 0xffffn).toString(16);
    const low = Number(v4 & 0xffffn).toString(16);
    working = `${working.slice(0, lastColon)}:${high}:${low}`;
  }

  const doubleColonParts = working.split('::');
  if (doubleColonParts.length > 2) return null;

  let hextets: string[] = [];
  if (doubleColonParts.length === 2) {
    const left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
    const right = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    hextets = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    hextets = working.split(':');
    if (hextets.length !== 8) return null;
  }

  if (hextets.length !== 8) return null;

  let result = 0n;
  for (const h of hextets) {
    if (!/^[0-9a-f]{1,4}$/i.test(h)) return null;
    const val = BigInt(parseInt(h, 16));
    result = (result << 16n) | val;
  }
  return result;
}

/**
 * Faz o parse de um IP (IPv4 ou IPv6).
 * Se for um IPv4 mapeado em IPv6 (::ffff:a.b.c.d), normaliza para IPv4 (version: 4).
 */
export function parseIp(rawIp: string): ParsedIp | null {
  const clean = normalizeIpString(rawIp);
  if (!clean) return null;

  if (clean.startsWith('::ffff:')) {
    const rest = clean.slice('::ffff:'.length);
    const v4Direct = parseIpv4(rest);
    if (v4Direct !== null) {
      return { version: 4, value: v4Direct };
    }
  }

  const v4 = parseIpv4(clean);
  if (v4 !== null) {
    return { version: 4, value: v4 };
  }

  const v6 = parseIpv6(clean);
  if (v6 !== null) {
    // Verifica se o IPv6 de 128 bits está no intervalo ::ffff:0:0/96
    const ipv4MappedPrefix = 0xffff00000000n;
    if ((v6 >> 32n) === 0xffffn && (v6 & ~0xffffffffffffn) === 0n) {
      return { version: 4, value: v6 & 0xffffffffn };
    }
    void ipv4MappedPrefix;
    return { version: 6, value: v6 };
  }

  return null;
}

function createMask(bits: number, prefix: number): bigint {
  if (prefix <= 0) return 0n;
  const total = BigInt(bits);
  const p = BigInt(Math.min(bits, prefix));
  const allOnes = (1n << total) - 1n;
  const hostMask = (1n << (total - p)) - 1n;
  return allOnes ^ hostMask;
}

/**
 * Faz o parse de uma regra de IP único ou bloco CIDR (ex.: "201.93.163.133" ou "2804:431:80f7:7700::/48").
 */
export function parseCidrRule(rule: string): ParsedCidr | null {
  const trimmed = rule.trim();
  if (!trimmed) return null;

  const [ipPart, prefixPart] = trimmed.split('/');
  const parsed = parseIp(ipPart);
  if (!parsed) return null;

  const maxBits = parsed.version === 4 ? 32 : 128;
  let prefix = maxBits;

  if (prefixPart !== undefined) {
    if (!/^\d{1,3}$/.test(prefixPart.trim())) return null;
    prefix = Number(prefixPart.trim());
    if (prefix < 0 || prefix > maxBits) return null;
  }

  const mask = createMask(maxBits, prefix);
  return {
    version: parsed.version,
    network: parsed.value & mask,
    mask,
    raw: trimmed,
  };
}

/**
 * Verifica se um endereço IP corresponde a pelo menos uma das regras permitidas.
 */
export function isIpAllowed(clientIp: string, allowedRules: string[] = DEFAULT_ALLOWED_IPS): boolean {
  const parsedClient = parseIp(clientIp);
  if (!parsedClient) return false;

  for (const ruleStr of allowedRules) {
    const rule = parseCidrRule(ruleStr);
    if (!rule) continue;
    if (rule.version !== parsedClient.version) continue;
    if ((parsedClient.value & rule.mask) === rule.network) {
      return true;
    }
  }

  return false;
}

/**
 * Lê a lista de IPs permitidos da variável de ambiente ALLOWED_IPS (se definida)
 * ou retorna DEFAULT_ALLOWED_IPS.
 */
export function getAllowedIpsFromEnv(envValue?: string): string[] {
  const raw = envValue ?? process.env.ALLOWED_IPS;
  if (!raw || !raw.trim()) {
    return DEFAULT_ALLOWED_IPS;
  }
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_ALLOWED_IPS;
}

/**
 * Extrai o IP do cliente considerando X-Forwarded-For / X-Real-IP quando TRUST_PROXY estiver ativo
 * ou o endereço direto do socket.
 */
export function extractClientIp(req: IncomingMessage, trustProxy = process.env.TRUST_PROXY !== 'false'): string {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp.trim();
    }
  }
  return req.socket?.remoteAddress || '';
}

/**
 * Verifica a requisição e bloqueia com 403 caso o IP não esteja na lista autorizada.
 * Retorna true se permitido, false se bloqueado (já tendo enviado a resposta 403).
 */
export function enforceIpWhitelist(
  req: IncomingMessage,
  res: ServerResponse,
  allowedRules: string[] = getAllowedIpsFromEnv()
): boolean {
  const clientIp = extractClientIp(req);
  if (isIpAllowed(clientIp, allowedRules)) {
    return true;
  }

  res.statusCode = 403;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(
    JSON.stringify({
      erro: 'Acesso negado: o seu endereço IP não tem permissão para acessar este servidor.',
      ip: normalizeIpString(clientIp) || 'desconhecido',
    })
  );
  return false;
}

