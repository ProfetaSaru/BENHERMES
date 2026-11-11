import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gerarRelatorio, lerEsteira } from './calculo';

/**
 * Teste "golden": compara com o ranking oficial de 11/11/2026 gerado pela planilha (macro).
 * As esteiras têm CPF e o esperado tem nomes reais, então NÃO ficam no repositório: aponte
 * RANKING_GOLDEN_DIR para uma pasta com andamento.csv, pagamento.csv, config.json e esperado.json
 * (o esperado_2026-11-11.json do pacote). Sem a variável, o teste é pulado (CI).
 */
const PASTA = process.env.RANKING_GOLDEN_DIR ?? '';
const DISPONIVEL = Boolean(PASTA) && ['andamento.csv', 'pagamento.csv', 'config.json', 'esperado.json'].every((f) => existsSync(join(PASTA, f)));

describe.skipIf(!DISPONIVEL)('igual ao ranking oficial de 11/11/2026', () => {
  it('posições, nomes e valores', () => {
    const ler = (f: string) => readFileSync(join(PASTA, f), 'utf8');
    const config = { ia: { usar_chatgpt: true, usar_claude: true }, ...JSON.parse(ler('config.json')) };
    const esperado = JSON.parse(ler('esperado.json'));
    const rel = gerarRelatorio(lerEsteira(ler('andamento.csv')).linhas, lerEsteira(ler('pagamento.csv')).linhas, config, esperado.dia);
    for (const grupo of ['vendedores', 'supervisores'] as const) {
      expect(rel[grupo]).toHaveLength(esperado[grupo].length);
      rel[grupo].forEach((l, i) => {
        const e = esperado[grupo][i];
        expect([l.posicao, l.nome, l.margemCartao, l.elegivel]).toEqual([e[0], e[1], e[5], e[8]]);
        [l.portabilidade, l.projetando, l.potencial, l.andamento, l.projecao].forEach((v, j) =>
          expect(Math.abs(v - [e[2], e[3], e[4], e[6], e[7]][j])).toBeLessThanOrEqual(0.01)
        );
      });
    }
    const t = rel.total;
    const obtido: Record<string, number> = { portabilidade: t.portabilidade, projetando: t.projetando, potencial: t.potencial, margem_cartao: t.margemCartao, andamento: t.andamento, projecao: t.projecao, elegiveis: t.elegiveis };
    for (const [k, v] of Object.entries(esperado.total as Record<string, number>)) expect(Math.abs(obtido[k] - v)).toBeLessThanOrEqual(0.01);
  });
});
