import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ALLOWED_IPS,
  isIpAllowed,
  parseIp,
  parseCidrRule,
  extractClientIp,
} from './ipFilter';

describe('ipFilter - Validação dos IPs e blocos CIDR autorizados', () => {
  it('permite exatamente os IPs IPv4 especificados (201.93.163.133 e 201.93.159.169)', () => {
    expect(isIpAllowed('201.93.163.133')).toBe(true);
    expect(isIpAllowed('201.93.159.169')).toBe(true);
    expect(isIpAllowed('::ffff:201.93.163.133')).toBe(true);
    expect(isIpAllowed('::ffff:201.93.159.169')).toBe(true);

    // IPs vizinhos não autorizados devem ser bloqueados
    expect(isIpAllowed('201.93.163.132')).toBe(false);
    expect(isIpAllowed('201.93.163.134')).toBe(false);
    expect(isIpAllowed('201.93.159.168')).toBe(false);
    expect(isIpAllowed('192.168.1.50')).toBe(false);
  });

  it('permite endereços dentro dos blocos IPv6 /48 configurados', () => {
    // 2804:431:80f7:7700::/48 -> primeiros 48 bits são 2804:0431:80f7
    expect(isIpAllowed('2804:431:80f7:7700::1')).toBe(true);
    expect(isIpAllowed('2804:0431:80f7:0000:1234:5678:9abc:def0')).toBe(true);
    expect(isIpAllowed('2804:431:80f7:ffff:ffff:ffff:ffff:ffff')).toBe(true);

    // 2804:1b3:a5e7:c3c7::/48 -> primeiros 48 bits são 2804:01b3:a5e7
    expect(isIpAllowed('2804:1b3:a5e7:c3c7::1')).toBe(true);
    expect(isIpAllowed('2804:1b3:a5e7:2c83:abcd::1')).toBe(true);
    expect(isIpAllowed('2804:1b3:a5e7:8e38:9999:1111:2222:3333')).toBe(true);

    // Fora dos blocos /48
    expect(isIpAllowed('2804:431:80f8:7700::1')).toBe(false);
    expect(isIpAllowed('2804:1b3:a5e8:c3c7::1')).toBe(false);
    expect(isIpAllowed('2001:db8::1')).toBe(false);
  });

  it('permite loopback local (127.0.0.1 e ::1)', () => {
    expect(isIpAllowed('127.0.0.1')).toBe(true);
    expect(isIpAllowed('::ffff:127.0.0.1')).toBe(true);
    expect(isIpAllowed('::1')).toBe(true);
  });

  it('normaliza colchetes, portas e zonas em endereços IP', () => {
    expect(parseIp('[2804:431:80f7:7700::1]:8080')?.version).toBe(6);
    expect(isIpAllowed('[2804:431:80f7:7700::1]:8080')).toBe(true);
    expect(isIpAllowed('201.93.163.133:54321')).toBe(true);
    expect(isIpAllowed('2804:1b3:a5e7:2c83::1%eth0')).toBe(true);
  });

  it('valida todas as regras padrão sem erro de parse', () => {
    for (const rule of DEFAULT_ALLOWED_IPS) {
      expect(parseCidrRule(rule)).not.toBeNull();
    }
  });

  it('extrai IP corretamente de X-Forwarded-For quando trustProxy está ativo', () => {
    const fakeReq: any = {
      headers: {
        'x-forwarded-for': '201.93.163.133, 10.0.0.1',
      },
      socket: {
        remoteAddress: '172.17.0.1',
      },
    };
    expect(extractClientIp(fakeReq, true)).toBe('201.93.163.133');
    expect(extractClientIp(fakeReq, false)).toBe('172.17.0.1');
  });
});

