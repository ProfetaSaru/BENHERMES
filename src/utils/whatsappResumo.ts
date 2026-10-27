import type { Borders, Cell, Workbook, Worksheet } from 'exceljs';
import { Celular, EstadoWhatsapp, EventoWhatsapp, Lugar, Manutencao, MapaWhatsapp, Marca, Mesa, Situacao } from '../types/whatsapp';
import { FeriadoLocal } from './calendario';
import { estadoDaVaga, nomeDaVaga, nomeDoCelular, ondeEstaABaia, textoDoLocal } from './celulares';
import { codigoDoLugar, posicoesDaMesa } from './mapaMesas';
import { novaPlanilha } from './planilhaColorida';
import { Alerta, alertas, resumoDaSala, resumoDoCelular, resumoGeral } from './whatsappAlertas';
import { ROTULOS, exportarMapa, restricaoVencida, tempoDesde } from './whatsappBaias';
import { Estatisticas, calcularEstatisticas, formatarDuracao } from './whatsappEstatisticas';
import { GRUPO_SEM_CELULAR, ROTULO_JANELA } from './whatsappManutencao';

/**
 * Planilha do WhatsApp das Baias, minimalista: Painel (estreito, para o celular), Mapa, Celulares,
 * Lista (tabela com filtro), Estatísticas e Histórico (últimos 30 dias) e a aba oculta "dados"
 * (o .json do mapa), que faz a planilha voltar exatamente igual quando importada no BenHermes.
 */

const COR = {
  azul: 'FF0B3A82',
  amarelo: 'FFF5B800',
  texto: 'FF1B2230',
  secundario: 'FF6B7280',
  linha: 'FFE5E9F0',
  corredor: 'FFEEF1F5',
  branco: 'FFFFFFFF',
};

const SITUACAO: Record<Situacao, { texto: string; fundo: string | null }> = {
  OK: { texto: 'FF1F7A4D', fundo: null },
  BANIDO: { texto: 'FFB42318', fundo: 'FFFEF3F2' },
  ANALISE: { texto: 'FFC2410C', fundo: 'FFFFF7ED' },
  PERMANENTE: { texto: 'FF111827', fundo: 'FFF3F4F6' },
  RESTRINGIDO: { texto: 'FF9A6700', fundo: 'FFFFFBEB' },
  NAO_TEM: { texto: 'FF6B7280', fundo: null },
};

const MARCAS: Record<Marca, string> = { SAMSUNG: 'Samsung', MOTOROLA: 'Motorola', XIAOMI: 'Xiaomi', IPHONE: 'iPhone', OUTRO: 'Outro' };

const dois = (n: number) => String(n).padStart(2, '0');
const dataCurta = (iso: string) => {
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};
const dataHora = (d: Date) => `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} · ${dois(d.getHours())}:${dois(d.getMinutes())}`;

export const nomeDoResumoWhatsapp = (agora: Date): string =>
  `whatsapp_baias_${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}.xlsx`;

// ---------------------------------------------------------------------------
// Ajudantes de estilo
// ---------------------------------------------------------------------------

interface Estilo {
  tamanho?: number;
  negrito?: boolean;
  italico?: boolean;
  cor?: string;
  fundo?: string | null;
  alinhar?: 'left' | 'center' | 'right';
}

const escrever = (c: Cell, valor: Cell['value'], e: Estilo = {}): Cell => {
  c.value = valor;
  c.font = { name: 'Calibri', size: e.tamanho ?? 10, bold: !!e.negrito, italic: !!e.italico, color: { argb: e.cor ?? COR.texto } };
  if (e.fundo) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: e.fundo } };
  c.alignment = { vertical: 'middle', horizontal: e.alinhar ?? 'left', wrapText: false };
  return c;
};

const linhaFina = (c: Cell, cor = COR.linha, estilo: 'thin' | 'medium' = 'thin') => {
  c.border = { ...(c.border ?? {}), bottom: { style: estilo, color: { argb: cor } } };
};

const novaAba = (livro: Workbook, nome: string, larguras: number[], paisagem: boolean): Worksheet => {
  const ws = livro.addWorksheet(nome, {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: paisagem ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  larguras.forEach((l, i) => (ws.getColumn(i + 1).width = l));
  return ws;
};

/** Título em azul, subtítulo cinza e o traço amarelo curto; devolve a próxima linha livre */
const cabecalho = (ws: Worksheet, linha: number, col: number, titulo: string, subtitulo: string): number => {
  escrever(ws.getCell(linha, col), titulo, { tamanho: 18, negrito: true, cor: COR.azul });
  ws.getRow(linha).height = 26;
  escrever(ws.getCell(linha + 1, col), subtitulo, { tamanho: 10, cor: COR.secundario });
  ws.getCell(linha + 2, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.amarelo } };
  ws.getRow(linha + 2).height = 3;
  return linha + 4;
};

const secao = (ws: Worksheet, linha: number, col: number, texto: string) =>
  escrever(ws.getCell(linha, col), texto.toUpperCase(), { tamanho: 9, negrito: true, cor: COR.secundario });

/** "BANIDO", "até 28/10 14:00", "vencida · conferir" */
const textoCurto = (e: EstadoWhatsapp, agora: Date): string => {
  if (e.situacao === 'RESTRINGIDO' && e.restritoAte) {
    return restricaoVencida(e, agora) ? 'vencida · conferir' : `até ${dataCurta(e.restritoAte)}`;
  }
  return ROTULOS[e.situacao];
};

const corDa = (s: Situacao) => SITUACAO[s].texto;

const resumoEmTexto = (r: ReturnType<typeof resumoGeral>) =>
  [
    `${r.ok} OK`,
    `${r.banido} pedir análise`,
    `${r.analise} em análise`,
    `${r.permanente} perdidos`,
    `${r.restringido} restringidos`,
    `${r.naoTem} não tem`,
    `${r.vagasVazias} vagas vazias`,
  ].join(' · ');

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

const quandoDoAlerta = (a: Alerta, agora: Date): string => {
  switch (a.tipo) {
    case 'PEDIR_ANALISE':
      return `há ${tempoDesde(a.desde, agora)}`;
    case 'ANALISE_ATRASADA':
      return `pedida há ${tempoDesde(a.desde, agora)}`;
    case 'RESTRICAO_VENCIDA':
      return `venceu ${dataCurta(a.ate!)}`;
    case 'RESTRINGIDO':
      return `até ${dataCurta(a.ate!)}`;
    case 'PERMANENTE':
      return `desde ${dataCurta(a.desde)}`;
    default:
      return '—';
  }
};

const ROTULO_DO_ALERTA: Record<Alerta['tipo'], string> = {
  PEDIR_ANALISE: 'PEDIR ANÁLISE',
  ANALISE_ATRASADA: 'ANÁLISE +24H',
  RESTRICAO_VENCIDA: 'CONFERIR',
  PERMANENTE: 'TROCAR CHIP',
  RESTRINGIDO: 'RESTRINGIDO',
  NAO_TEM: 'NÃO TEM',
};

const abaPainel = (livro: Workbook, mapa: MapaWhatsapp, agora: Date) => {
  const ws = novaAba(livro, 'Painel', [2, 34, 22, 18, 16], false);
  let r = cabecalho(ws, 2, 2, 'WhatsApp das Baias', dataHora(agora));
  const resumo = resumoGeral(mapa, agora);
  const numeros: [string, number, string][] = [
    ['OK', resumo.ok, SITUACAO.OK.texto],
    ['Pedir análise', resumo.banido, SITUACAO.BANIDO.texto],
    ['Em análise', resumo.analise, SITUACAO.ANALISE.texto],
    ['Perdidos', resumo.permanente, SITUACAO.PERMANENTE.texto],
    ['Restringidos', resumo.restringido, SITUACAO.RESTRINGIDO.texto],
    ['Não tem', resumo.naoTem, SITUACAO.NAO_TEM.texto],
    ['Vagas vazias', resumo.vagasVazias, COR.texto],
    ['Celulares', resumo.celulares, COR.texto],
  ];
  // 8 números em 2 colunas (B e D); número em cima, rótulo embaixo
  numeros.forEach(([rotulo, valor, cor], i) => {
    const linha = r + Math.floor(i / 2) * 2;
    const col = i % 2 === 0 ? 2 : 4;
    escrever(ws.getCell(linha, col), valor, { tamanho: 20, negrito: true, cor });
    ws.getRow(linha).height = 26;
    linhaFina(escrever(ws.getCell(linha + 1, col), rotulo, { tamanho: 9, cor: COR.secundario }));
  });
  r += 9;

  secao(ws, r, 2, 'Atenção');
  r++;
  ['Onde', 'Quem', 'Situação', 'Desde/Até'].forEach((t, i) =>
    linhaFina(escrever(ws.getCell(r, 2 + i), t, { tamanho: 9, negrito: true, cor: COR.secundario }), COR.texto)
  );
  r++;
  const lista = alertas(mapa, agora);
  if (lista.length === 0) {
    escrever(ws.getCell(r, 2), 'Nada pendente.', { italico: true, cor: COR.secundario });
    r++;
  }
  for (const a of lista) {
    const cor = corDa(a.situacao);
    [
      escrever(ws.getCell(r, 2), a.onde, { negrito: true }),
      escrever(ws.getCell(r, 3), a.quem),
      escrever(ws.getCell(r, 4), `● ${ROTULO_DO_ALERTA[a.tipo]}`, { negrito: true, cor }),
      escrever(ws.getCell(r, 5), quandoDoAlerta(a, agora), { cor: COR.secundario }),
    ].forEach((c) => linhaFina(c));
    r++;
  }
  r++;

  secao(ws, r, 2, 'Equipes');
  r++;
  ['Equipe', 'OK', 'Problemas', 'Saúde'].forEach((t, i) =>
    linhaFina(escrever(ws.getCell(r, 2 + i), t, { tamanho: 9, negrito: true, cor: COR.secundario, alinhar: i ? 'right' : 'left' }), COR.texto)
  );
  r++;
  const primeira = r;
  for (const sala of mapa.salas) {
    for (const mesa of sala.mesas) {
      const s = resumoDaSala({ ...sala, mesas: [mesa] }, agora);
      const total = s.ok + s.banido + s.analise + s.permanente + s.restringido + s.naoTem;
      [
        escrever(ws.getCell(r, 2), `${mesa.sigla} · ${mesa.supervisor || mesa.nome}`),
        escrever(ws.getCell(r, 3), s.ok, { alinhar: 'right' }),
        escrever(ws.getCell(r, 4), total - s.ok, { alinhar: 'right', cor: total - s.ok ? SITUACAO.BANIDO.texto : COR.texto }),
        escrever(ws.getCell(r, 5), total ? s.ok / total : 0, { alinhar: 'right', cor: COR.secundario }),
      ].forEach((c) => linhaFina(c));
      ws.getCell(r, 5).numFmt = '0%';
      r++;
    }
  }
  if (r > primeira) {
    ws.addConditionalFormatting({
      ref: `E${primeira}:E${r - 1}`,
      rules: [{ type: 'dataBar', cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }], color: { argb: 'FF1F7A4D' } } as any],
    });
  }
};

// ---------------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------------

// Cada mesa: baia esquerda (2 colunas), corredor, baia direita (2 colunas); 2 mesas por linha
const LARGURAS_MAPA = [2, 22, 13, 2, 22, 13, 4, 22, 13, 2, 22, 13, 2];
const INICIO_MESA = [2, 8];

const bordaDaBaia = (cor: string, tracejada: boolean): Partial<Borders> => ({
  left: { style: tracejada ? 'dashed' : 'medium', color: { argb: cor } },
});

/** Uma baia em 3 linhas (código + situação / nome / onde está o WhatsApp) nas colunas c e c+1 */
const escreverBaia = (
  ws: Worksheet,
  r: number,
  c: number,
  codigo: string,
  lugar: Lugar | undefined,
  nome: string,
  local: string,
  vazia: boolean,
  desativada: boolean,
  agora: Date,
  semWhatsapp = false,
  ate = c + 1
) => {
  const e = lugar?.whatsapp;
  const fundo = desativada ? 'FFF3F4F6' : e && !semWhatsapp ? SITUACAO[e.situacao].fundo : null;
  const corBorda = desativada || semWhatsapp ? 'FF9AA3AF' : e ? corDa(e.situacao) : 'FF9AA3AF';
  for (let i = 0; i < 3; i++) {
    ws.mergeCells(r + i, c, r + i, ate);
  }
  escrever(ws.getCell(r, c), {
    richText: [
      { text: `${codigo}   `, font: { name: 'Calibri', size: 9, bold: true, color: { argb: COR.azul } } },
      desativada
        ? { text: 'DESATIVADA', font: { name: 'Calibri', size: 9, bold: true, color: { argb: COR.secundario } } }
        : semWhatsapp
          ? { text: 'SEM WHATSAPP', font: { name: 'Calibri', size: 9, bold: true, color: { argb: COR.secundario } } }
          : { text: e ? textoCurto(e, agora) : '', font: { name: 'Calibri', size: 9, bold: true, color: { argb: e ? corDa(e.situacao) : COR.secundario } } },
    ],
  } as any, { fundo });
  escrever(ws.getCell(r + 1, c), desativada ? 'Baia desativada' : nome, {
    tamanho: 11,
    negrito: !vazia && !desativada,
    italico: vazia || desativada,
    cor: vazia || desativada ? COR.secundario : COR.texto,
    fundo,
  });
  escrever(ws.getCell(r + 2, c), desativada ? '' : local, { tamanho: 8, cor: COR.secundario, fundo });
  for (let i = 0; i < 3; i++) {
    const celula = ws.getCell(r + i, c);
    celula.border = {
      ...bordaDaBaia(corBorda, vazia),
      ...(i === 0 ? { top: { style: 'thin', color: { argb: COR.linha } } } : {}),
      ...(i === 2 ? { bottom: { style: 'thin', color: { argb: COR.linha } } } : {}),
    };
  }
};

const ONDE_SUPERVISOR = { PC: 'No PC', CELULAR: 'No celular', NAO_TEM: 'Sem WhatsApp' } as const;

/** Desenha a mesa a partir da linha r, coluna c; devolve a última linha usada */
const escreverMesa = (ws: Worksheet, mapa: MapaWhatsapp, mesa: Mesa, r: number, c: number, agora: Date): number => {
  escrever(ws.getCell(r, c), `${mesa.sigla} · ${mesa.nome}`, { tamanho: 12, negrito: true, cor: COR.azul });
  ws.mergeCells(r, c + 3, r, c + 4);
  escrever(ws.getCell(r, c + 3), mesa.supervisor, { cor: COR.secundario, alinhar: 'right' });
  for (let i = 0; i < 5; i++) linhaFina(ws.getCell(r, c + i), COR.texto);
  let linha = r + 2;

  const { centro, esquerda, direita } = posicoesDaMesa(mesa);
  if (centro.includes('SUP')) {
    const sup = mesa.lugares.SUP;
    const sem = mesa.whatsappSupervisor === 'NAO_TEM';
    // Supervisor centralizado sobre o corredor (da 2ª coluna da esquerda à 1ª da direita)
    escreverBaia(ws, linha, c + 1, codigoDoLugar(mesa.sigla, 'SUP'), sup, `Supervisor${mesa.supervisor ? ` · ${mesa.supervisor}` : ''}`, ONDE_SUPERVISOR[mesa.whatsappSupervisor], false, false, agora, sem, c + 3);
    linha += 4;
  }

  const linhas = Math.max(esquerda.length, direita.length);
  const local = (posicao: string) => {
    const onde = ondeEstaABaia(mapa, mesa.id, posicao);
    return onde ? `📱 ${textoDoLocal(onde.celular, onde.vaga)}` : 'sem celular';
  };
  for (let i = 0; i < linhas; i++) {
    ([[esquerda[i], c], [direita[i], c + 3]] as [string | undefined, number][]).forEach(([posicao, col]) => {
      if (!posicao) return;
      const lugar = mesa.lugares[posicao];
      const desativada = mesa.desativadas.includes(posicao);
      const vazia = !desativada && !lugar?.operador.trim();
      escreverBaia(ws, linha, col, codigoDoLugar(mesa.sigla, posicao), lugar, vazia ? 'Vaga vazia' : lugar!.operador, local(posicao), vazia, desativada, agora);
    });
    for (let k = 0; k < 3; k++) {
      ws.getCell(linha + k, c + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.corredor } };
    }
    ws.getRow(linha + 3).height = 5;
    linha += 4;
  }
  ws.mergeCells(linha, c, linha, c + 4);
  escrever(ws.getCell(linha, c), 'início da mesa', { tamanho: 8, italico: true, cor: COR.secundario, alinhar: 'center' });
  return linha;
};

const abaMapa = (livro: Workbook, mapa: MapaWhatsapp, agora: Date) => {
  const ws = novaAba(livro, 'Mapa', LARGURAS_MAPA, true);
  let r = 2;
  for (const sala of mapa.salas) {
    r = cabecalho(ws, r, 2, `Mapa · ${sala.nome}`, `${dataHora(agora)} · ${resumoEmTexto(resumoDaSala(sala, agora))}`);
    const legenda: [Situacao, string][] = [
      ['OK', 'OK'],
      ['BANIDO', 'Banido'],
      ['ANALISE', 'Em análise'],
      ['PERMANENTE', 'Perdido'],
      ['RESTRINGIDO', 'Restringido'],
      ['NAO_TEM', 'Não tem'],
    ];
    ws.mergeCells(r, 2, r, 12);
    escrever(ws.getCell(r, 2), {
      richText: legenda.map(([s, t]) => ({ text: `●  ${t}      `, font: { name: 'Calibri', size: 9, color: { argb: corDa(s) } } })),
    } as any);
    r += 2;
    for (let i = 0; i < sala.mesas.length; i += 2) {
      const fim = Math.max(...sala.mesas.slice(i, i + 2).map((m, j) => escreverMesa(ws, mapa, m, r, INICIO_MESA[j], agora)));
      // Quebra de página depois de cada par de mesas: na impressão, nenhuma mesa fica cortada
      ws.getRow(fim + 1).addPageBreak();
      r = fim + 3;
    }
    r += 1;
  }
};

// ---------------------------------------------------------------------------
// Celulares
// ---------------------------------------------------------------------------

const abaCelulares = (livro: Workbook, mapa: MapaWhatsapp, agora: Date) => {
  const ws = novaAba(livro, 'Celulares', [2, 20, 22, 16, 3, 20, 22, 16, 3, 20, 22, 16, 2], true);
  const totais = mapa.celulares.reduce(
    (t, c) => {
      const r = resumoDoCelular(mapa, c, agora);
      return { total: t.total + r.total, operadores: t.operadores + r.operadores, backups: t.backups + r.backups };
    },
    { total: 0, operadores: 0, backups: 0 }
  );
  let r = cabecalho(
    ws,
    2,
    2,
    'Celulares',
    `${mapa.celulares.length} celulares · ${totais.total} WhatsApps · ${totais.operadores} de operadores · ${totais.backups} backups`
  );
  if (mapa.celulares.length === 0) {
    escrever(ws.getCell(r, 2), 'Nenhum celular cadastrado.', { italico: true, cor: COR.secundario });
    return;
  }
  const equipe = (c: Celular) => {
    for (const s of mapa.salas) {
      const m = s.mesas.find((x) => x.id === c.mesaId);
      if (m) return m.sigla;
    }
    return 'sem equipe';
  };
  for (let i = 0; i < mapa.celulares.length; i += 3) {
    let fim = r;
    mapa.celulares.slice(i, i + 3).forEach((cel, j) => {
      const c = 2 + j * 4;
      const branco = cel.hex.toUpperCase() === '#FFFFFF';
      escrever(ws.getCell(r, c), {
        richText: [
          { text: branco ? '□ ' : '■ ', font: { name: 'Calibri', size: 12, color: { argb: branco ? COR.secundario : `FF${cel.hex.replace('#', '').toUpperCase()}` } } },
          { text: nomeDoCelular(cel), font: { name: 'Calibri', size: 12, bold: true, color: { argb: COR.texto } } },
        ],
      } as any);
      ws.mergeCells(r, c + 1, r, c + 2);
      escrever(ws.getCell(r, c + 1), `${MARCAS[cel.marca]} · ${equipe(cel)} · ${cel.vagas.length}`, { tamanho: 9, cor: COR.secundario, alinhar: 'right' });
      for (let k = 0; k < 3; k++) linhaFina(ws.getCell(r, c + k), COR.texto);
      let linha = r + 1;
      let grupo = '';
      for (const vaga of cel.vagas) {
        if (vaga.grupo !== grupo) {
          grupo = vaga.grupo;
          escrever(ws.getCell(linha, c), grupo.toUpperCase(), { tamanho: 8, negrito: true, cor: COR.secundario });
          linha++;
        }
        const e = estadoDaVaga(mapa, cel, vaga);
        [
          escrever(ws.getCell(linha, c), vaga.rotulo),
          escrever(ws.getCell(linha, c + 1), nomeDaVaga(mapa, cel, vaga), { cor: vaga.baia ? COR.texto : COR.secundario }),
          escrever(ws.getCell(linha, c + 2), `● ${textoCurto(e, agora)}`, { cor: corDa(e.situacao) }),
        ].forEach((x) => linhaFina(x));
        linha++;
      }
      fim = Math.max(fim, linha);
    });
    r = fim + 2;
  }
};

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

const COLUNAS_LISTA = ['Tipo', 'Sala', 'Equipe', 'Onde', 'Nome', 'Celular · vaga', 'Situação', 'Desde/Até', 'Número do chip'];

const desdeOuAte = (e: EstadoWhatsapp): string => {
  if (e.situacao === 'RESTRINGIDO' && e.restritoAte) return `até ${dataCurta(e.restritoAte)}`;
  if (e.situacao === 'ANALISE' && e.analisePedidaEm) return `pedida ${dataCurta(e.analisePedidaEm)}`;
  return `desde ${dataCurta(e.mudouEm)}`;
};

const abaLista = (livro: Workbook, mapa: MapaWhatsapp) => {
  const ws = novaAba(livro, 'Lista', [12, 16, 22, 12, 26, 34, 14, 20, 18], true);
  const linhas: { valores: string[]; situacao: Situacao | null }[] = [];
  for (const sala of mapa.salas) {
    for (const mesa of sala.mesas) {
      const { centro, esquerda, direita } = posicoesDaMesa(mesa);
      for (const posicao of [...centro.filter((p) => p === 'SUP'), ...esquerda.slice().sort(), ...direita.slice().sort()]) {
        if (mesa.desativadas.includes(posicao)) continue;
        const lugar = mesa.lugares[posicao];
        if (!lugar) continue;
        const ehSup = posicao === 'SUP';
        const onde = ondeEstaABaia(mapa, mesa.id, posicao);
        const semWhatsapp = ehSup && mesa.whatsappSupervisor === 'NAO_TEM';
        linhas.push({
          valores: [
            ehSup ? 'Supervisor' : 'Baia',
            sala.nome,
            mesa.nome,
            codigoDoLugar(mesa.sigla, posicao),
            ehSup ? mesa.supervisor : lugar.operador || '(vaga vazia)',
            onde ? textoDoLocal(onde.celular, onde.vaga) : ehSup ? ONDE_SUPERVISOR[mesa.whatsappSupervisor] : '',
            semWhatsapp ? 'SEM WHATSAPP' : ROTULOS[lugar.whatsapp.situacao],
            semWhatsapp ? '' : desdeOuAte(lugar.whatsapp),
            onde?.vaga.numero ?? '',
          ],
          situacao: semWhatsapp ? null : lugar.whatsapp.situacao,
        });
      }
    }
  }
  for (const cel of mapa.celulares) {
    for (const vaga of cel.vagas.filter((v) => v.baia === null)) {
      linhas.push({
        valores: ['Backup', '', '', nomeDoCelular(cel), cel.nomeBackup, textoDoLocal(cel, vaga), ROTULOS[vaga.whatsapp.situacao], desdeOuAte(vaga.whatsapp), vaga.numero],
        situacao: vaga.whatsapp.situacao,
      });
    }
  }
  ws.addTable({
    name: 'Lista',
    ref: 'A1',
    headerRow: true,
    style: { theme: 'TableStyleLight1', showRowStripes: true },
    columns: COLUNAS_LISTA.map((name) => ({ name, filterButton: true })),
    rows: linhas.length ? linhas.map((l) => l.valores) : [COLUNAS_LISTA.map(() => '')],
  });
  linhas.forEach((l, i) => {
    if (!l.situacao) return;
    const c = ws.getCell(i + 2, 7);
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: corDa(l.situacao) } };
  });
};

// ---------------------------------------------------------------------------
// Estatísticas e Histórico (últimos 30 dias)
// ---------------------------------------------------------------------------

const PERIODO_DA_PLANILHA = 30;
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ondeDa = (l: { codigo: string; celular: string }) => l.codigo || (l.celular ? `backup · ${l.celular}` : 'backup');

/** Cabeçalho de uma tabela simples (sem filtro); devolve a próxima linha */
const titulos = (ws: Worksheet, r: number, nomes: string[], direita: number[] = []): number => {
  nomes.forEach((t, i) =>
    linhaFina(escrever(ws.getCell(r, 2 + i), t, { tamanho: 9, negrito: true, cor: COR.secundario, alinhar: direita.includes(i) ? 'right' : 'left' }), COR.texto)
  );
  return r + 1;
};

const porcentagem = (c: Cell, valor: number | null, e: Estilo = {}) => {
  escrever(c, valor ?? '—', { alinhar: 'right', ...e });
  if (valor !== null) c.numFmt = '0.0%';
  return c;
};

const abaEstatisticas = (livro: Workbook, e: Estatisticas, mapa: MapaWhatsapp) => {
  const ws = novaAba(livro, 'Estatísticas', [2, 30, 22, 18, 16], false);
  const desde = new Date(Math.max(e.de.getTime(), new Date(mapa.inicioDoHistorico).getTime()));
  const aviso = e.poucoHistorico ? ' · os números ficam mais confiáveis com o tempo' : '';
  let r = cabecalho(ws, 2, 2, 'Estatísticas', `Últimos ${PERIODO_DA_PLANILHA} dias · contando desde ${dataCurta(desde.toISOString()).slice(0, 5)}${aviso}`);

  const numeros: [string, Cell['value'], string, boolean][] = [
    ['Tempo OK', e.tempoOk ?? '—', SITUACAO.OK.texto, e.tempoOk !== null],
    ['Quedas', e.quedas, SITUACAO.BANIDO.texto, false],
    ['Tempo até voltar', e.ateVoltarMs === null ? '—' : formatarDuracao(e.ateVoltarMs), COR.texto, false],
    ['Perdidos', e.perdidos, SITUACAO.PERMANENTE.texto, false],
    ['Manutenções', `${e.manutencoes.feitas} de ${e.manutencoes.total}`, COR.azul, false],
  ];
  numeros.forEach(([rotulo, valor, cor, ehPorcentagem], i) => {
    const linha = r + Math.floor(i / 2) * 2;
    const col = i % 2 === 0 ? 2 : 4;
    const c = escrever(ws.getCell(linha, col), valor, { tamanho: 20, negrito: true, cor });
    if (ehPorcentagem) c.numFmt = '0.0%';
    ws.getRow(linha).height = 26;
    linhaFina(escrever(ws.getCell(linha + 1, col), rotulo, { tamanho: 9, cor: COR.secundario }));
  });
  r += 7;

  const vazio = (texto: string) => {
    escrever(ws.getCell(r, 2), texto, { italico: true, cor: COR.secundario });
    r++;
  };

  secao(ws, r++, 2, 'Os que mais caíram');
  r = titulos(ws, r, ['Onde', 'Operador', 'Celular', 'Quedas'], [3]);
  if (!e.maisCairam.length) vazio('Nenhuma queda no período.');
  for (const l of e.maisCairam) {
    [
      escrever(ws.getCell(r, 2), ondeDa(l), { negrito: true }),
      escrever(ws.getCell(r, 3), l.operador),
      escrever(ws.getCell(r, 4), l.celular, { cor: COR.secundario }),
      escrever(ws.getCell(r, 5), l.quedas, { alinhar: 'right', negrito: true, cor: SITUACAO.BANIDO.texto }),
    ].forEach((c) => linhaFina(c));
    r++;
  }
  r++;

  secao(ws, r++, 2, 'Os mais estáveis');
  r = titulos(ws, r, ['Onde', 'Operador', 'Celular', 'Dias seguidos OK'], [3]);
  if (!e.maisEstaveis.length) vazio('Nenhum número OK agora.');
  for (const l of e.maisEstaveis) {
    [
      escrever(ws.getCell(r, 2), ondeDa(l), { negrito: true }),
      escrever(ws.getCell(r, 3), l.operador),
      escrever(ws.getCell(r, 4), l.celular, { cor: COR.secundario }),
      escrever(ws.getCell(r, 5), `${l.desdeOInicio ? '≥ ' : ''}${l.dias}`, { alinhar: 'right', negrito: true, cor: SITUACAO.OK.texto }),
    ].forEach((c) => linhaFina(c));
    r++;
  }
  r++;

  secao(ws, r++, 2, 'Por operador');
  r = titulos(ws, r, ['Operador', 'Quedas', 'Tempo OK', 'Dias seguidos OK'], [1, 2, 3]);
  if (!e.porOperador.length) vazio('Sem operadores no período.');
  for (const g of e.porOperador) {
    [
      escrever(ws.getCell(r, 2), g.nome),
      escrever(ws.getCell(r, 3), g.quedas, { alinhar: 'right', cor: g.quedas ? SITUACAO.BANIDO.texto : COR.texto }),
      porcentagem(ws.getCell(r, 4), g.tempoOk, { cor: COR.secundario }),
      escrever(ws.getCell(r, 5), g.sequenciaDias ?? '—', { alinhar: 'right', cor: COR.secundario }),
    ].forEach((c) => linhaFina(c));
    r++;
  }
  r++;

  secao(ws, r++, 2, 'Por equipe');
  r = titulos(ws, r, ['Equipe', 'Quedas', 'Tempo OK'], [1, 2]);
  const primeira = r;
  for (const g of e.porEquipe) {
    [
      escrever(ws.getCell(r, 2), g.nome),
      escrever(ws.getCell(r, 3), g.quedas, { alinhar: 'right', cor: g.quedas ? SITUACAO.BANIDO.texto : COR.texto }),
      porcentagem(ws.getCell(r, 4), g.tempoOk, { cor: COR.secundario }),
    ].forEach((c) => linhaFina(c));
    r++;
  }
  if (r > primeira) {
    ws.addConditionalFormatting({
      ref: `D${primeira}:D${r - 1}`,
      rules: [{ type: 'dataBar', cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }], color: { argb: 'FF1F7A4D' } } as any],
    });
  }
  r++;

  secao(ws, r++, 2, 'Calendário das manutenções');
  r = titulos(ws, r, ['Dia', 'Manhã', 'Almoço']);
  const marca = (feita: boolean | null): [string, string] =>
    feita === null ? ['–', COR.secundario] : feita ? ['● feita', SITUACAO.OK.texto] : ['○ não feita', SITUACAO.BANIDO.texto];
  for (const d of [...e.calendario].reverse()) {
    const [m, corM] = marca(d.manha);
    const [a, corA] = marca(d.almoco);
    [
      escrever(ws.getCell(r, 2), `${diaCurto(d.dia)} · ${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${d.dia}T12:00:00`).getDay()]}`),
      escrever(ws.getCell(r, 3), m, { cor: corM }),
      escrever(ws.getCell(r, 4), a, { cor: corA }),
    ].forEach((c) => linhaFina(c));
    r++;
  }
};

const COLUNAS_HISTORICO = ['Data e hora', 'Tipo', 'Código', 'Operador', 'Equipe', 'Celular', 'Vaga', 'De', 'Para', 'Manutenção'];
const TIPO_DO_EVENTO: Record<EventoWhatsapp['tipo'], string> = { SITUACAO: 'Situação', OPERADOR: 'Operador', ENTROU: 'Entrou', SAIU: 'Saiu' };
const comoTexto = (e: EventoWhatsapp, valor: string) => (e.tipo === 'OPERADOR' ? valor : ROTULOS[valor as Situacao] ?? valor);

const abaHistorico = (livro: Workbook, mapa: MapaWhatsapp, e: Estatisticas) => {
  const ws = novaAba(livro, 'Histórico', [14, 11, 11, 20, 9, 16, 24, 14, 14, 16], true);
  const desde = Math.max(e.de.getTime(), new Date(mapa.inicioDoHistorico).getTime());
  const todas = [...mapa.manutencoes, ...(mapa.manutencaoAtual ? [mapa.manutencaoAtual] : [])];
  const daManutencao = (id?: string) => {
    const m = id ? todas.find((x) => x.id === id) : undefined;
    return m ? `${ROTULO_JANELA[m.janela]} ${dataCurta(m.inicio).slice(0, 5)}` : '';
  };
  const eventos = mapa.historico.filter((x) => new Date(x.em).getTime() >= desde).reverse();
  const linhas = eventos.map((x) => [
    dataCurta(x.em),
    TIPO_DO_EVENTO[x.tipo],
    x.codigo,
    x.operador,
    x.equipe,
    x.celular,
    x.vaga,
    comoTexto(x, x.de),
    comoTexto(x, x.para),
    daManutencao(x.manutencaoId),
  ]);
  ws.addTable({
    name: 'Historico',
    ref: 'A1',
    headerRow: true,
    style: { theme: 'TableStyleLight1', showRowStripes: true },
    columns: COLUNAS_HISTORICO.map((name) => ({ name, filterButton: true })),
    rows: linhas.length ? linhas : [COLUNAS_HISTORICO.map(() => '')],
  });
  eventos.forEach((x, i) => {
    if (x.tipo !== 'SITUACAO') return;
    const c = ws.getCell(i + 2, 9);
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: corDa(x.para as Situacao) } };
  });

  let r = Math.max(linhas.length, 1) + 3;
  escrever(ws.getCell(r++, 1), 'MANUTENÇÕES', { tamanho: 9, negrito: true, cor: COR.secundario });
  ['Data', 'Janela', 'Início–fim', 'Celulares conferidos', 'Ações'].forEach((t, i) =>
    linhaFina(escrever(ws.getCell(r, 1 + i), t, { tamanho: 9, negrito: true, cor: COR.secundario }), COR.texto)
  );
  r++;
  const doPeriodo = mapa.manutencoes.filter((m: Manutencao) => new Date(m.inicio).getTime() >= desde).reverse();
  if (!doPeriodo.length) escrever(ws.getCell(r++, 1), 'Nenhuma manutenção no período.', { italico: true, cor: COR.secundario });
  for (const m of doPeriodo) {
    [
      escrever(ws.getCell(r, 1), dataCurta(m.inicio).slice(0, 5)),
      escrever(ws.getCell(r, 2), ROTULO_JANELA[m.janela]),
      escrever(ws.getCell(r, 3), `${dataCurta(m.inicio).slice(6)}–${m.fim ? dataCurta(m.fim).slice(6) : ''}`),
      escrever(ws.getCell(r, 4), m.conferidos.filter((c) => c !== GRUPO_SEM_CELULAR).length),
      escrever(ws.getCell(r, 5), m.acoes.length),
    ].forEach((c) => linhaFina(c));
    r++;
  }
};

// ---------------------------------------------------------------------------

const PEDACO = 30_000;

/**
 * O .json do mapa em pedaços de até 30 000 caracteres (limite de uma célula do Excel), sem partir
 * um emoji (par substituto) entre dois pedaços.
 */
const abaDados = (livro: Workbook, mapa: MapaWhatsapp, agora: Date) => {
  const ws = livro.addWorksheet('dados', { state: 'hidden' });
  const texto = JSON.stringify(JSON.parse(exportarMapa(mapa, agora)));
  for (let i = 0, linha = 1; i < texto.length; linha++) {
    let fim = Math.min(i + PEDACO, texto.length);
    const ultimo = texto.charCodeAt(fim - 1);
    if (fim < texto.length && ultimo >= 0xd800 && ultimo <= 0xdbff) fim--;
    ws.getCell(linha, 1).value = texto.slice(i, fim);
    i = fim;
  }
};

export const gerarResumoWhatsapp = async (mapa: MapaWhatsapp, agora: Date, feriados: FeriadoLocal[] = []): Promise<Workbook> => {
  const livro = await novaPlanilha();
  const estatisticas = calcularEstatisticas(mapa, PERIODO_DA_PLANILHA, agora, feriados);
  abaPainel(livro, mapa, agora);
  abaMapa(livro, mapa, agora);
  abaCelulares(livro, mapa, agora);
  abaLista(livro, mapa);
  abaEstatisticas(livro, estatisticas, mapa);
  abaHistorico(livro, mapa, estatisticas);
  abaDados(livro, mapa, agora);
  return livro;
};
