import * as XLSX from 'xlsx';
import { CelularCorporativo, EstadoWhatsapp, Lugar, MapaWhatsapp, Mesa, Sala, Situacao } from '../types/whatsapp';
import { normalizarNome } from './calendario';
import { codigoDoLugar } from './mapaMesas';
import { corDoCelular, estado, novaMesa } from './whatsappBaias';

/**
 * Planilha do WhatsApp das Baias: leitura da RELATORIO-WHATSAPP-INTUITIVO.xlsx
 * (salas, equipes lado a lado, supervisor/backup e celulares corporativos).
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
const TITULO_SALA = /^STATUS DOS WHATSAPP DO (.+)$/;
const TITULO_CELULARES = 'WHATSAPP DOS CELULARES CORPORATIVOS';

/** "COMERCIAL 1" -> "Comercial 1" */
const nomeDaSala = (texto: string): string =>
  texto
    .toLowerCase()
    .replace(/(^|\s)\S/g, (l) => l.toUpperCase())
    .trim();

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
  const equipes: { r: number; c: number; numero: number; texto: string }[] = [];
  let celulares: { r: number; c: number } | null = null;

  grade.forEach((linha, r) =>
    linha.forEach((valor, c) => {
      const normal = normalizarNome(valor);
      const sala = normal.match(TITULO_SALA);
      if (sala) salas.push({ id: crypto.randomUUID(), nome: nomeDaSala(sala[1]), mesas: [], linha: r });
      const equipe = valor.trim().match(TITULO_EQUIPE);
      if (equipe) equipes.push({ r, c, numero: Number(equipe[1]), texto: equipe[2] });
      if (normal.startsWith(TITULO_CELULARES) && !celulares) celulares = { r, c };
    })
  );

  if (equipes.length === 0) throw new Error('Não encontrei nenhuma equipe ("Nº EQUIPE - ...") na planilha.');

  const siglas = new Set<string>();
  for (const { r, c, numero, texto } of equipes) {
    const id = identificarEquipe(numero, texto);
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
