import * as XLSX from 'xlsx';
import type { Borders, Cell, Workbook, Worksheet } from 'exceljs';
import { CelularCorporativo, EstadoWhatsapp, Lugar, MapaWhatsapp, Mesa, Sala, Situacao } from '../types/whatsapp';
import { normalizarNome } from './calendario';
import { codigoDoLugar } from './mapaMesas';
import { novaPlanilha } from './planilhaColorida';
import { ROTULOS, corDoCelular, estado, novaMesa } from './whatsappBaias';

/**
 * Planilha do WhatsApp das Baias: leitura da RELATORIO-WHATSAPP-INTUITIVO.xlsx
 * (salas, equipes lado a lado, supervisor/backup e celulares corporativos) e a planilha
 * de resumo no mesmo visual, que pode ser importada de volta.
 */

/** Primeira aba como texto, em coordenadas absolutas: grade[0][0] = A1 */
export const gradeDaPlanilha = (livro: XLSX.WorkBook): string[][] => {
  const aba = livro.Sheets[livro.SheetNames[0]];
  if (!aba?.['!ref']) return [];
  const fim = XLSX.utils.decode_range(aba['!ref']).e;
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, {
    header: 1,
    defval: '',
    blankrows: true,
    raw: false,
    range: { s: { r: 0, c: 0 }, e: fim },
  });
  return linhas.map((linha) => linha.map((v) => String(v ?? '').trim()));
};

/** Situação escrita na planilha; null se vazia ou desconhecida */
export const lerSituacao = (texto: string, agora: Date): { situacao: Situacao; restritoAte?: Date } | null => {
  const t = normalizarNome(texto);
  if (t === 'OK') return { situacao: 'OK' };
  if (t === 'BANIDO') return { situacao: 'BANIDO' };
  if (t === 'NAO TEM') return { situacao: 'NAO_TEM' };
  if (!t.startsWith('RESTRINGIDO')) return null;
  const prazo = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+(\d{1,2}):(\d{2})/);
  if (!prazo) return { situacao: 'RESTRINGIDO' };
  const [, dia, mes, ano, hora, minuto] = prazo.map(Number);
  return {
    situacao: 'RESTRINGIDO',
    restritoAte: new Date(ano || agora.getFullYear(), mes - 1, dia, hora, minuto),
  };
};

export interface ResultadoImportacao {
  mapa: MapaWhatsapp;
  avisos: string[];
}

const TITULO_EQUIPE = /^(\d+)\s*[º°oO]?\s*EQUIPE\s*-\s*(.*)$/i;
// A planilha gerada aqui leva a data no título: "... DO COMERCIAL 1 — 27/10/2026 10:00"
const TITULO_SALA = /^STATUS DOS WHATSAPP DO (.+?)(?:\s+[—–-]\s+\d{2}\/\d{2}\/\d{4}.*)?$/;
const TITULO_CELULARES = 'WHATSAPP DOS CELULARES CORPORATIVOS';

/** "COMERCIAL 1" -> "Comercial 1" */
const nomeDaSala = (texto: string): string =>
  texto
    .toLowerCase()
    .replace(/(^|\s)\S/g, (l) => l.toUpperCase())
    .trim();

/** Título sem número ("DIGITAL", "PLANTÃO - Joana"): nome, supervisor e sigla com as 3 primeiras letras */
const identificarSemNumero = (titulo: string) => {
  const [nome, ...resto] = titulo.split(' - ');
  if (normalizarNome(nome) === 'DIGITAL') return { nome: 'Digital', sigla: 'DG', supervisor: resto.join(' - ').trim() };
  const bonito = nome.trim().toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
  const sigla = normalizarNome(nome).replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'MESA';
  return { nome: bonito, sigla, supervisor: resto.join(' - ').trim() };
};

/** Nome, sigla e supervisor a partir de "Nº EQUIPE - texto" */
const identificarEquipe = (numero: number, texto: string) => {
  const nota = texto.match(/\(([^)]*)\)/)?.[1]?.trim().toLowerCase() ?? '';
  const resto = texto
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bVAZIA\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalizarNome(resto) === 'DIGITAL') return { nome: 'Digital', sigla: 'DG', supervisor: '' };
  return { nome: `${numero}º Equipe${nota ? ` (${nota})` : ''}`, sigla: `OP${numero}`, supervisor: resto };
};

const vazioOuVago = (texto: string): string => (normalizarNome(texto) === 'VAZIO' ? '' : texto.replace(/\s+/g, ' ').trim());

export const importarPlanilhaWhatsapp = (grade: string[][], agora: Date): ResultadoImportacao => {
  const avisos: string[] = [];
  const cel = (r: number, c: number): string => grade[r]?.[c] ?? '';

  const situacaoDe = (texto: string, codigo: string): EstadoWhatsapp => {
    const lida = lerSituacao(texto, agora);
    if (!lida) {
      if (texto.trim()) avisos.push(`${codigo}: "${texto.trim()}" não é uma situação conhecida; ficou como NÃO TEM.`);
      return estado('NAO_TEM', agora);
    }
    return estado(lida.situacao, agora, lida.restritoAte);
  };

  const salas: (Sala & { linha: number })[] = [];
  // Uma equipe é o título logo acima da linha "OPERADOR | WHATSAPP"
  const equipes: { r: number; c: number; id: { nome: string; sigla: string; supervisor: string } }[] = [];
  let celulares: { r: number; c: number } | null = null;

  grade.forEach((linha, r) =>
    linha.forEach((valor, c) => {
      const normal = normalizarNome(valor);
      const sala = normal.match(TITULO_SALA);
      if (sala) salas.push({ id: crypto.randomUUID(), nome: nomeDaSala(sala[1]), mesas: [], linha: r });
      const cabecalho = normalizarNome(cel(r + 1, c)) === 'OPERADOR' && normalizarNome(cel(r + 1, c + 1)) === 'WHATSAPP';
      const numerada = valor.trim().match(TITULO_EQUIPE);
      if (valor.trim() && (numerada || cabecalho)) {
        equipes.push({
          r,
          c,
          id: numerada ? identificarEquipe(Number(numerada[1]), numerada[2]) : identificarSemNumero(valor.trim()),
        });
      }
      if (normal.startsWith(TITULO_CELULARES) && !celulares) celulares = { r, c };
    })
  );

  if (equipes.length === 0) throw new Error('Não encontrei nenhuma equipe ("Nº EQUIPE - ...") na planilha.');

  const siglas = new Set<string>();
  for (const { r, c, id } of equipes) {
    let sigla = id.sigla;
    for (let letra = 66; siglas.has(sigla); letra++) sigla = `${id.sigla}${String.fromCharCode(letra)}`;
    siglas.add(sigla);

    // Linhas de operadores: da linha seguinte ao cabeçalho até "SUPERVISOR" (ou até uma linha vazia)
    const operadores: number[] = [];
    let rodape = -1;
    for (let l = r + 2; l < grade.length; l++) {
      if (normalizarNome(cel(l, c)).startsWith('SUPERVISOR')) {
        rodape = l;
        break;
      }
      if (![0, 1, 2, 3].some((d) => cel(l, c + d))) break;
      operadores.push(l);
    }
    const temBackup = rodape >= 0 && normalizarNome(cel(rodape, c + 2)).startsWith('BACKUP');
    const esq = operadores.filter((l) => cel(l, c) || cel(l, c + 1)).length;
    const dir = operadores.filter((l) => cel(l, c + 2) || cel(l, c + 3)).length;
    const mesa: Mesa = novaMesa(
      { ...id, sigla, esq, dir, centro: rodape < 0 ? 'NENHUM' : temBackup ? 'SUPSUB' : 'SUP', inicio: 'sup' },
      agora
    );

    const lugar = (posicao: string, operador: string, situacao: string): Lugar => ({
      operador: vazioOuVago(operador),
      whatsapp: situacaoDe(situacao, codigoDoLugar(sigla, posicao)),
    });
    operadores.forEach((l, i) => {
      if (i < esq) mesa.lugares[`E${i + 1}`] = lugar(`E${i + 1}`, cel(l, c), cel(l, c + 1));
      if (i < dir) mesa.lugares[`D${i + 1}`] = lugar(`D${i + 1}`, cel(l, c + 2), cel(l, c + 3));
    });
    if (rodape >= 0) mesa.lugares.SUP = lugar('SUP', '', cel(rodape, c + 1));
    if (temBackup) mesa.lugares.SUB = lugar('SUB', '', cel(rodape, c + 3));

    // Equipes antes de qualquer título de sala vão para a primeira sala
    const sala = [...salas].reverse().find((s) => s.linha < r) ?? salas[0];
    if (sala) sala.mesas.push(mesa);
    else salas.push({ id: crypto.randomUUID(), nome: 'Sala 1', mesas: [mesa], linha: -1 });
  }

  const lista: CelularCorporativo[] = [];
  if (celulares) {
    const { r, c } = celulares as { r: number; c: number };
    for (let l = r + 2; l < grade.length && cel(l, c); l++) {
      const cor = cel(l, c).toUpperCase();
      lista.push({
        cor,
        hex: corDoCelular(cor),
        messenger: situacaoDe(cel(l, c + 1), `Celular ${cor} (Messenger)`),
        business: situacaoDe(cel(l, c + 3), `Celular ${cor} (Business)`),
      });
    }
  }

  return {
    mapa: {
      versao: 1,
      salas: salas.filter((s) => s.mesas.length > 0).map(({ linha: _linha, ...sala }) => sala),
      celulares: lista,
      atualizadoEm: agora.toISOString(),
    },
    avisos,
  };
};

// ---------------------------------------------------------------------------
// Planilha de resumo
// ---------------------------------------------------------------------------

const COR = {
  fundo: 'FF002060',
  amarelo: 'FFFFFF00',
  branco: 'FFFFFFFF',
  verde: 'FF00B050',
  azul: 'FF0070C0',
  vazio: 'FFFFD966',
  desativada: 'FF808080',
};

const COR_DA_SITUACAO: Record<Situacao, string> = {
  OK: 'FF70AD47',
  BANIDO: 'FFFF0000',
  RESTRINGIDO: 'FFBF8F00',
  NAO_TEM: 'FF808080',
};

const LARGURAS: Record<string, number> = { E: 61, F: 22.57, G: 58.29, H: 18.71, K: 56.29, L: 18.71, M: 51.29, N: 31.71 };
const ESPACO = 3; // colunas D, I, J e O
const BLOCOS = [5, 11]; // E (5) e K (11): primeira coluna de cada equipe da linha

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const dataHora = (d: Date) =>
  `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()} ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;

export const nomeDaPlanilhaWhatsapp = (agora: Date): string =>
  `relatorio_whatsapp_${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}.xlsx`;

const textoDaSituacao = (e: EstadoWhatsapp): string => {
  if (e.situacao !== 'RESTRINGIDO' || !e.restritoAte) return ROTULOS[e.situacao];
  const ate = new Date(e.restritoAte);
  return `RESTRINGIDO ATÉ ${doisDigitos(ate.getDate())}/${doisDigitos(ate.getMonth() + 1)} ${doisDigitos(ate.getHours())}:${doisDigitos(ate.getMinutes())}`;
};

/** "1º EQUIPE - Supervisor"; nomes fora do padrão "Nº Equipe" saem como "DIGITAL" ou "PLANTÃO - Supervisor" */
const tituloDaMesa = (mesa: Mesa): string => {
  const padrao = mesa.nome.match(/^(\d+)º Equipe(?: \((.*)\))?$/);
  if (!padrao) return `${mesa.nome.toUpperCase()}${mesa.supervisor ? ` - ${mesa.supervisor}` : ''}`;
  const nota = padrao[2] ? `(${padrao[2].toUpperCase()})` : '';
  return `${padrao[1]}º EQUIPE - ${[mesa.supervisor, nota].filter(Boolean).join(' ')}`;
};

const escrever = (
  celula: Cell,
  valor: string,
  fonte: { nome?: string; tamanho: number; cor?: string; negrito?: boolean },
  fundo = COR.branco
): void => {
  celula.value = valor;
  celula.font = {
    name: fonte.nome ?? 'Arial',
    size: fonte.tamanho,
    bold: fonte.negrito ?? false,
    ...(fonte.cor ? { color: { argb: fonte.cor } } : {}),
  };
  celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fundo } };
  celula.alignment = { horizontal: 'center', vertical: 'middle' };
};

const escreverSituacao = (celula: Cell, e: EstadoWhatsapp) => {
  escrever(celula, textoDaSituacao(e), { nome: 'Calibri', tamanho: 14, cor: COR_DA_SITUACAO[e.situacao] });
  celula.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true }; // "RESTRINGIDO ATÉ ..." é longo
};

/** Borda fina por dentro e grossa em volta do bloco */
const moldura = (ws: Worksheet, r1: number, c1: number, r2: number, c2: number): void => {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const lado = (grosso: boolean) => ({ style: grosso ? ('thick' as const) : ('thin' as const), color: { argb: 'FF000000' } });
      const borda: Partial<Borders> = { top: lado(r === r1), bottom: lado(r === r2), left: lado(c === c1), right: lado(c === c2) };
      const celula = ws.getCell(r, c);
      celula.border = borda;
      if (!celula.fill || (celula.fill as any).fgColor?.argb === COR.fundo) {
        celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.branco } };
      }
    }
  }
};

/** Escreve uma equipe a partir da linha r, coluna c; devolve a última linha usada */
const escreverMesa = (ws: Worksheet, mesa: Mesa, r: number, c: number): number => {
  // Cada equipe usa só as suas linhas: o SUPERVISOR vem logo depois (a importação para na primeira linha vazia)
  const linhas = Math.max(mesa.esq, mesa.dir);
  ws.mergeCells(r, c, r, c + 3);
  escrever(ws.getCell(r, c), tituloDaMesa(mesa), { tamanho: 20, negrito: true }, COR.amarelo);
  ['OPERADOR', 'WHATSAPP', 'OPERADOR', 'WHATSAPP'].forEach((t, i) =>
    escrever(ws.getCell(r + 1, c + i), t, { tamanho: 16, negrito: true, cor: COR.verde })
  );
  for (let i = 0; i < linhas; i++) {
    (['E', 'D'] as const).forEach((lado, j) => {
      const posicao = `${lado}${i + 1}`;
      const quantidade = lado === 'E' ? mesa.esq : mesa.dir;
      const nome = ws.getCell(r + 2 + i, c + j * 2);
      const situacao = ws.getCell(r + 2 + i, c + j * 2 + 1);
      if (i >= quantidade) return;
      if (mesa.desativadas.includes(posicao)) {
        escrever(nome, 'DESATIVADA', { tamanho: 12, negrito: true, cor: COR.desativada });
        return;
      }
      const lugar = mesa.lugares[posicao];
      if (!lugar) return;
      escrever(nome, lugar.operador || 'VAZIO', { tamanho: 12, negrito: true, cor: lugar.operador ? COR.azul : COR.vazio });
      escreverSituacao(situacao, lugar.whatsapp);
    });
  }
  let fim = r + 1 + linhas;
  if (mesa.centro !== 'NENHUM') {
    fim++;
    escrever(ws.getCell(fim, c), 'SUPERVISOR', { tamanho: 14, cor: COR.verde });
    if (mesa.lugares.SUP) escreverSituacao(ws.getCell(fim, c + 1), mesa.lugares.SUP.whatsapp);
    if (mesa.centro === 'SUPSUB') {
      escrever(ws.getCell(fim, c + 2), 'BACKUP', { tamanho: 14, cor: COR.verde });
      if (mesa.lugares.SUB) escreverSituacao(ws.getCell(fim, c + 3), mesa.lugares.SUB.whatsapp);
    }
  }
  moldura(ws, r, c, fim, c + 3);
  return fim;
};

/**
 * Planilha de resumo no visual da RELATORIO-WHATSAPP-INTUITIVO: fundo azul-escuro,
 * título amarelo por sala, duas equipes por linha (E–H e K–N) e os celulares corporativos.
 */
export const gerarPlanilhaWhatsapp = async (mapa: MapaWhatsapp, agora: Date): Promise<Workbook> => {
  const livro = await novaPlanilha();
  const ws = livro.addWorksheet('WhatsApp');
  ws.getColumn(1).width = ESPACO;
  ['B', 'C', 'D', 'I', 'J', 'O'].forEach((col) => (ws.getColumn(col).width = ESPACO));
  Object.entries(LARGURAS).forEach(([col, largura]) => (ws.getColumn(col).width = largura));

  let r = 2;
  for (const sala of mapa.salas) {
    ws.mergeCells(r, 5, r, 14);
    escrever(
      ws.getCell(r, 5),
      `STATUS DOS WHATSAPP DO ${sala.nome.toUpperCase()} — ${dataHora(agora)}`,
      { nome: 'Calibri', tamanho: 36, negrito: true },
      COR.amarelo
    );
    ws.getRow(r).height = 47.25;
    r += 1;
    for (let i = 0; i < sala.mesas.length; i += 2) {
      const par = sala.mesas.slice(i, i + 2);
      const fim = Math.max(...par.map((m, j) => escreverMesa(ws, m, r, BLOCOS[j])));
      r = fim + 2;
    }
  }

  if (mapa.celulares.length > 0) {
    ws.mergeCells(r, 5, r, 8);
    escrever(ws.getCell(r, 5), 'WHATSAPP DOS CELULARES CORPORATIVOS', { tamanho: 20, negrito: true }, COR.amarelo);
    ['CELULAR', 'MESSENGER', 'CELULAR', 'BUSINESS'].forEach((t, i) =>
      escrever(ws.getCell(r + 1, 5 + i), t, { tamanho: 16, negrito: true, cor: COR.verde })
    );
    mapa.celulares.forEach((cel, i) => {
      const linha = r + 2 + i;
      const cor = `FF${cel.hex.replace('#', '').toUpperCase()}`;
      escrever(ws.getCell(linha, 5), cel.cor, { tamanho: 12, negrito: true, cor });
      escreverSituacao(ws.getCell(linha, 6), cel.messenger);
      escrever(ws.getCell(linha, 7), cel.cor, { tamanho: 12, negrito: true, cor });
      escreverSituacao(ws.getCell(linha, 8), cel.business);
    });
    moldura(ws, r, 5, r + 1 + mapa.celulares.length, 8);
    r += 2 + mapa.celulares.length;
  }

  // Fundo azul-escuro em volta dos blocos (o que não foi escrito)
  for (let linha = 1; linha <= r + 1; linha++) {
    for (let col = 4; col <= 15; col++) {
      const celula = ws.getCell(linha, col);
      if (!celula.fill) celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.fundo } };
    }
  }
  return livro;
};
