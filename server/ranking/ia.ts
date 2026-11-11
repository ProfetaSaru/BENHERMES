import { conferirFrases, frasePronta, type Descricao, type TipoDeRanking } from './frases.ts';

/**
 * Comentários da coluna FEEDBACK: ChatGPT primeiro (a chave que a empresa já usa), Claude se o ChatGPT
 * estiver sem limite ou fora do ar, e as frases prontas se nenhuma IA responder.
 * As IAs recebem só o que `descrever` monta: primeiro nome e dados qualitativos (nada de CPF, sobrenome ou R$).
 * As chaves ficam só no ambiente do servidor; o conteúdo dos pedidos nunca vai para o log.
 */

export interface EntradaComentarios {
  vendedores: Descricao[];
  supervisores: Descricao[];
}

export interface FrasesDaIa {
  vendedores: string[];
  supervisores: string[];
}

export interface Provedor {
  nome: 'chatgpt' | 'claude';
  gerar(entrada: EntradaComentarios, instrucao: string): Promise<FrasesDaIa>;
}

export interface ResultadoComentarios extends FrasesDaIa {
  provedor: 'chatgpt' | 'claude' | 'frases';
  avisos: string[];
}

export const INSTRUCAO = `Você escreve os comentários da coluna FEEDBACK do ranking diário de vendas da BenConsig, uma financeira de portabilidade e crédito consignado.

Você vai assumir duas personalidades:
- Jordan Belfort (vendedor e palestrante motivacional): para quem está no topo. Motiva a continuar rumo ao topo, sempre lembrando que a posição atual pode ser perdida.
- Nicolau Maquiavel (filósofo florentino): para quem está com desempenho fraco. Críticas severas, sátira e ironia, com reflexão e gatilhos emocionais que despertem motivação.

Regra geral: quanto mais longe a pessoa estiver do topo, mais severas, irônicas e reflexivas devem ser as frases no estilo Maquiavel. Para a crítica, leve em conta a posição no ranking, mas sem citá-la.

Você recebe duas listas separadas: vendedores e supervisores (o ranking de supervisores recomeça do topo). Para supervisores, fale da equipe dele.

Regras de escrita (obrigatórias):
- Uma frase por pessoa, no máximo 18 palavras, em português do Brasil.
- Comece pelo primeiro nome da pessoa, exatamente como recebido.
- NÃO cite valores, números, porcentagens, posições numéricas nem quantidades (nada de "R$", "19º", "cinco cartões", "30%"). Fale de forma qualitativa ("no topo", "no fim da tabela", "esteira cheia").
- Não diga o nome das personalidades nem use rótulos.
- Nenhuma frase pode se repetir, nem entre pessoas empatadas.
- Ofensas pessoais, palavrões ou comentários sobre aparência/vida pessoal são proibidos; a crítica é sempre sobre o desempenho.

Responda SOMENTE com JSON válido, sem texto antes ou depois, no formato:
{"vendedores": ["frase", ...], "supervisores": ["frase", ...]}
na mesma ordem e com a mesma quantidade de itens das listas recebidas.`;

const LIMITE_MS = 30_000;

const comLimite = <T>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('tempo esgotado')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });

const listaDeTextos = (v: unknown, tamanho: number): v is string[] =>
  Array.isArray(v) && v.length === tamanho && v.every((x) => typeof x === 'string');

const NOME: Record<Provedor['nome'], string> = { chatgpt: 'ChatGPT', claude: 'Claude' };

const prontas = (descricoes: Descricao[], tipo: TipoDeRanking): string[] => {
  const usadas = new Set<string>();
  return descricoes.map((d, i) => frasePronta(d, i, descricoes.length, usadas, tipo));
};

export const gerarComentarios = async (
  entrada: EntradaComentarios,
  provedores: Provedor[],
  limiteMs = LIMITE_MS
): Promise<ResultadoComentarios> => {
  const falharam: string[] = [];
  for (const p of provedores) {
    let resposta: FrasesDaIa;
    try {
      resposta = await comLimite(p.gerar(entrada, INSTRUCAO), limiteMs);
    } catch (erro: any) {
      // Só o tipo do erro: o pedido e a resposta nunca vão para o log
      console.warn(`[ranking] ${NOME[p.nome]} não respondeu: ${String(erro?.status ?? erro?.name ?? 'erro')}`);
      falharam.push(p.nome);
      continue;
    }
    if (!listaDeTextos(resposta?.vendedores, entrada.vendedores.length) || !listaDeTextos(resposta?.supervisores, entrada.supervisores.length)) {
      console.warn(`[ranking] ${NOME[p.nome]} devolveu uma quantidade de frases diferente da de pessoas.`);
      falharam.push(p.nome);
      continue;
    }
    const v = conferirFrases(entrada.vendedores, resposta.vendedores, 'vendedor');
    const s = conferirFrases(entrada.supervisores, resposta.supervisores, 'supervisor');
    const avisos: string[] = [];
    if (falharam.length) avisos.push(`${falharam.map((n) => NOME[n as Provedor['nome']]).join(' e ')} sem limite ou fora do ar; comentários feitos pelo ${NOME[p.nome]}.`);
    const trocadas = v.trocadas + s.trocadas;
    if (trocadas) avisos.push(`${trocadas === 1 ? '1 frase da IA trocada' : `${trocadas} frases da IA trocadas`} por frase pronta (citava números ou se repetia).`);
    return { vendedores: v.frases, supervisores: s.frases, provedor: p.nome, avisos };
  }
  const avisos = falharam.length
    ? [`${falharam.map((n) => NOME[n as Provedor['nome']]).join(' e ')} sem limite ou fora do ar; comentários feitos com frases prontas.`]
    : ['Nenhuma IA ligada com chave no servidor; comentários feitos com frases prontas.'];
  return {
    vendedores: prontas(entrada.vendedores, 'vendedor'),
    supervisores: prontas(entrada.supervisores, 'supervisor'),
    provedor: 'frases',
    avisos,
  };
};

// ---------------------------------------------------------------------------
// Provedores reais (SDKs oficiais carregados só quando usados)
// ---------------------------------------------------------------------------

type Ambiente = Record<string, string | undefined>;

const pedido = (entrada: EntradaComentarios) => JSON.stringify(entrada);

const lerJson = (texto: string): FrasesDaIa => {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  return JSON.parse(limpo);
};

const ESQUEMA = {
  type: 'object',
  properties: {
    vendedores: { type: 'array', items: { type: 'string' } },
    supervisores: { type: 'array', items: { type: 'string' } },
  },
  required: ['vendedores', 'supervisores'],
  additionalProperties: false,
};

const chatgpt = (chave: string, modelo: string): Provedor => ({
  nome: 'chatgpt',
  async gerar(entrada, instrucao) {
    const OpenAI = (await import('openai')).default;
    const cliente = new OpenAI({ apiKey: chave, timeout: LIMITE_MS, maxRetries: 0 });
    const r = await cliente.chat.completions.create({
      model: modelo,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: instrucao },
        { role: 'user', content: pedido(entrada) },
      ],
    });
    return lerJson(r.choices[0]?.message?.content ?? '');
  },
});

const claude = (chave: string, modelo: string): Provedor => ({
  nome: 'claude',
  async gerar(entrada, instrucao) {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const cliente = new Anthropic({ apiKey: chave, timeout: LIMITE_MS, maxRetries: 0 });
    const r = await cliente.messages.create({
      model: modelo,
      max_tokens: 16000,
      system: instrucao,
      messages: [{ role: 'user', content: pedido(entrada) }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
    });
    if (r.stop_reason === 'refusal') throw new Error('recusa');
    const texto = r.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return lerJson(texto);
  },
});

/** Só as IAs ligadas na configuração e com chave no ambiente do servidor, na ordem ChatGPT → Claude */
export const provedoresDoAmbiente = (ia: { usar_chatgpt: boolean; usar_claude: boolean }, env: Ambiente = process.env): Provedor[] => {
  const lista: Provedor[] = [];
  if (ia.usar_chatgpt && env.OPENAI_API_KEY) lista.push(chatgpt(env.OPENAI_API_KEY, env.RANKING_MODELO_OPENAI || 'gpt-4o-mini'));
  if (ia.usar_claude && env.ANTHROPIC_API_KEY) lista.push(claude(env.ANTHROPIC_API_KEY, env.RANKING_MODELO_CLAUDE || 'claude-haiku-5-5'));
  return lista;
};

/** Para a tela de configuração: só se cada chave existe, nunca o valor */
export const chavesDoAmbiente = (env: Ambiente = process.env) => ({
  chatgpt: { chave: Boolean(env.OPENAI_API_KEY) },
  claude: { chave: Boolean(env.ANTHROPIC_API_KEY) },
});

/**
 * Remonta o pedido do navegador só com os campos permitidos: primeiro nome (uma palavra, sem dígitos),
 * posição "Xº de N", projetando arredondado e os textos qualitativos. Qualquer outro campo é descartado.
 */
export const limparEntrada = (bruto: any): EntradaComentarios | null => {
  const lista = (v: unknown): Descricao[] | null => {
    if (!Array.isArray(v) || v.length > 500) return null;
    const saida: Descricao[] = [];
    for (const d of v) {
      if (!d || typeof d !== 'object' || typeof d.nome !== 'string') return null;
      const nome = d.nome.trim().split(/\s+/)[0].replace(/[\d@]/g, '').slice(0, 30);
      const posicao = typeof d.posicao === 'string' && /^\d{1,3}º de \d{1,3}$/.test(d.posicao) ? d.posicao : '';
      const projetando = typeof d.projetando === 'number' && Number.isFinite(d.projetando) ? Math.round(d.projetando * 100) / 100 : 0;
      saida.push({
        nome,
        posicao,
        projetando,
        situacao: String(d.situacao ?? '').slice(0, 40),
        esteira: String(d.esteira ?? '').slice(0, 40),
        vendeu_cartao_ou_margem: d.vendeu_cartao_ou_margem === true,
      });
    }
    return saida;
  };
  const vendedores = lista(bruto?.vendedores);
  const supervisores = lista(bruto?.supervisores);
  return vendedores && supervisores ? { vendedores, supervisores } : null;
};
