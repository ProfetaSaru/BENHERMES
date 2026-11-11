import { normalizar } from './calculo';

/**
 * Quem entra no ranking: os vendedores das esteiras que estão ATIVOS entre os operadores da Argus.
 *
 * O nome na esteira (Vanguard) nem sempre é escrito igual ao da Argus. Conferido com a esteira oficial de
 * 11/11/2026 e os operadores da Argus: muitas vezes a Argus tem o nome mais curto (menos sobrenomes) e às
 * vezes muda uma letra. Por isso a ligação segue esta ordem:
 *   1. ligação manual da configuração ("é a mesma pessoa que..." ou "não é a mesma pessoa");
 *   2. nome igual (sem diferenciar maiúsculas, acentos e espaços);
 *   3. mesmo primeiro nome e as palavras do nome mais curto aparecem, na ordem, no mais longo;
 *   4. mesmo primeiro nome e nomes quase iguais (semelhança ≥ 0,85; nos dados reais, a mesma pessoa deu
 *      0,95–0,97 e pessoas diferentes com o mesmo primeiro nome, no máximo 0,61).
 * Nos passos 3 e 4 só vale quando há um único candidato e ninguém mais da esteira aponta para ele; cada
 * operador da Argus vale para uma pessoa só. O resto fica fora do ranking e aparece na conferência da tela.
 */

export type ComoLigou = 'manual' | 'palavras' | 'parecido';

export interface ResultadoAtivos {
  /** Nomes como estão na esteira (normalizados): a lista que o cálculo usa */
  ativos: string[];
  /** Ligações feitas por nome diferente (as de nome igual não aparecem) */
  ligacoes: { esteira: string; argus: string; como: ComoLigou }[];
  /** Vendedores da esteira que ficaram fora, com os operadores da Argus de mesmo primeiro nome ainda livres */
  fora: { esteira: string; sugestoes: string[] }[];
}

export const SEMELHANCA_MINIMA = 0.85;

const distancia = (a: string, b: string): number => {
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      atual.push(Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    anterior = atual;
  }
  return anterior[b.length];
};

const semelhanca = (a: string, b: string): number => 1 - distancia(a, b) / Math.max(a.length, b.length, 1);

/** As palavras de `curto` aparecem, na mesma ordem, em `longo` */
const contidoEmOrdem = (curto: string[], longo: string[]): boolean => {
  let k = 0;
  for (const palavra of longo) if (palavra === curto[k]) k++;
  return k === curto.length;
};

const primeiro = (nome: string) => nome.split(' ')[0];

const unicos = (nomes: string[]) => [...new Set(nomes.map(normalizar).filter(Boolean))];

export const ativosDoRanking = (
  agentesDaEsteira: string[],
  operadoresAtivosDaArgus: string[],
  opcoes: { vinculos?: Record<string, string>; incluirSempre?: string[] } = {}
): ResultadoAtivos => {
  const agentes = unicos(agentesDaEsteira);
  const argus = unicos(operadoresAtivosDaArgus).sort();
  const argusSet = new Set(argus);
  const vinculos = new Map(Object.entries(opcoes.vinculos ?? {}).map(([de, para]) => [normalizar(de), normalizar(para)]));
  const incluir = new Set(unicos(opcoes.incluirSempre ?? []));

  const ligado = new Map<string, { argus: string | null; como: ComoLigou | 'igual' | 'incluir' }>();
  const usados = new Set<string>();
  const ligar = (agente: string, operador: string | null, como: ComoLigou | 'igual' | 'incluir') => {
    ligado.set(agente, { argus: operador, como });
    if (operador) usados.add(operador);
  };

  // 1. Incluir sempre e ligações manuais (vazio = "não é a mesma pessoa": fica de fora)
  for (const a of agentes) {
    if (incluir.has(a)) ligar(a, null, 'incluir');
    else if (vinculos.has(a)) {
      const alvo = vinculos.get(a)!;
      if (alvo && argusSet.has(alvo) && !usados.has(alvo)) ligar(a, alvo, 'manual');
    }
  }
  const pendentes = () => agentes.filter((a) => !ligado.has(a) && !vinculos.has(a));

  // 2. Nome igual
  for (const a of pendentes()) if (argusSet.has(a) && !usados.has(a)) ligar(a, a, 'igual');

  // 3 e 4. Um único candidato livre, que mais ninguém da esteira disputa
  const passo = (como: ComoLigou, combina: (agente: string, operador: string) => boolean) => {
    const candidatos = new Map(
      pendentes().map((a) => [a, argus.filter((o) => !usados.has(o) && primeiro(o) === primeiro(a) && combina(a, o))])
    );
    const disputa = new Map<string, number>();
    for (const lista of candidatos.values()) for (const o of lista) disputa.set(o, (disputa.get(o) ?? 0) + 1);
    for (const [a, lista] of candidatos) if (lista.length === 1 && disputa.get(lista[0]) === 1) ligar(a, lista[0], como);
  };
  passo('palavras', (a, o) => {
    const pa = a.split(' ');
    const po = o.split(' ');
    return contidoEmOrdem(po, pa) || contidoEmOrdem(pa, po);
  });
  passo('parecido', (a, o) => semelhanca(a, o) >= SEMELHANCA_MINIMA);

  return {
    ativos: [...agentes.filter((a) => ligado.has(a)), ...[...incluir].filter((n) => !agentes.includes(n))],
    ligacoes: agentes.flatMap((a) => {
      const l = ligado.get(a);
      return l && l.argus && (l.como === 'manual' || l.como === 'palavras' || l.como === 'parecido') ? [{ esteira: a, argus: l.argus, como: l.como }] : [];
    }),
    fora: agentes
      .filter((a) => !ligado.has(a))
      .map((a) => ({ esteira: a, sugestoes: argus.filter((o) => !usados.has(o) && primeiro(o) === primeiro(a)) })),
  };
};

/** Quem entrou e quem saiu entre duas listas de operadores (nomes normalizados, em ordem alfabética) */
export const diferencaDeListas = (antes: string[], depois: string[]): { entraram: string[]; sairam: string[] } => {
  const a = new Set(unicos(antes));
  const d = new Set(unicos(depois));
  return { entraram: [...d].filter((n) => !a.has(n)).sort(), sairam: [...a].filter((n) => !d.has(n)).sort() };
};
