import * as XLSX from 'xlsx';
import { EstadoWhatsapp, Lugar, MapaWhatsapp, Mesa, Sala, Situacao } from '../types/whatsapp';
import { normalizarNome } from './calendario';
import { codigoDoLugar } from './mapaMesas';
import { estado, importarMapa, novaMesa } from './whatsappBaias';

/**
 * Planilha do WhatsApp das Baias: leitura da RELATORIO-WHATSAPP-INTUITIVO.xlsx
 * (salas, equipes lado a lado e supervisor) e o arquivo baixado pelo próprio BenHermes (aba dados).
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
  let restritoAte = new Date(ano || agora.getFullYear(), mes - 1, dia, hora, minuto);
  // Sem ano: "02/01" lido em 30/12 é do ano seguinte
  if (!ano && agora.getTime() - restritoAte.getTime() > 180 * 86_400_000) {
    restritoAte = new Date(agora.getFullYear() + 1, mes - 1, dia, hora, minuto);
  }
  return { situacao: 'RESTRINGIDO', restritoAte };
};

export interface ResultadoImportacao {
  mapa: MapaWhatsapp;
  avisos: string[];
}

// "1º EQUIPE - Nome", "1° EQUIPE", "3º EQUIPE – Nome" (hífen, meia-risca ou travessão)
const TITULO_EQUIPE = /^(\d+)\s*[º°oO]?\s*EQUIPE\s*(?:[-–—]\s*(.*))?$/i;
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
          id: numerada ? identificarEquipe(Number(numerada[1]), numerada[2] ?? '') : identificarSemNumero(valor.trim()),
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

    // Linhas de operadores: da linha seguinte ao cabeçalho até "SUPERVISOR" ou até o próximo título
    // (equipe na mesma coluna, sala ou celulares). Linhas em branco no meio viram vagas vazias.
    const limite = Math.min(
      grade.length,
      ...equipes.filter((e) => e.c === c && e.r > r).map((e) => e.r),
      ...salas.filter((s) => s.linha > r).map((s) => s.linha),
      ...(celulares && (celulares as { r: number }).r > r ? [(celulares as { r: number }).r] : [])
    );
    const linhas: number[] = [];
    let rodape = -1;
    for (let l = r + 2; l < limite; l++) {
      if (normalizarNome(cel(l, c)).startsWith('SUPERVISOR')) {
        rodape = l;
        break;
      }
      linhas.push(l);
    }
    // Cada lado vai até a última linha preenchida dele (o que vier antes, vazio, é vaga vazia)
    const ultima = (d: number) => {
      for (let i = linhas.length - 1; i >= 0; i--) if (cel(linhas[i], c + d) || cel(linhas[i], c + d + 1)) return i + 1;
      return 0;
    };
    const esq = ultima(0);
    const dir = ultima(2);
    const operadores = linhas.slice(0, Math.max(esq, dir));
    // O BACKUP da linha do supervisor não é usado (os backups agora são vagas dos celulares)
    const supSemWhatsapp = rodape >= 0 && normalizarNome(cel(rodape, c + 1)) === 'NAO TEM';
    const mesa: Mesa = novaMesa(
      {
        ...id,
        sigla,
        esq,
        dir,
        centro: rodape < 0 ? 'NENHUM' : 'SUP',
        inicio: 'sup',
        whatsappSupervisor: supSemWhatsapp ? 'NAO_TEM' : 'PC',
      },
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

    // Equipes antes de qualquer título de sala vão para a primeira sala
    const sala = [...salas].reverse().find((s) => s.linha < r) ?? salas[0];
    if (sala) sala.mesas.push(mesa);
    else salas.push({ id: crypto.randomUUID(), nome: 'Sala 1', mesas: [mesa], linha: -1 });
  }

  // O bloco antigo de celulares (só Messenger/Business por cor) não tem as vagas: cadastro na tela
  if (celulares) avisos.push('Os celulares não são importados da planilha antiga; cadastre-os em Configurar.');

  return {
    mapa: {
      versao: 3,
      salas: salas.filter((s) => s.mesas.length > 0).map(({ linha: _linha, ...sala }) => sala),
      celulares: [],
      historico: [],
      manutencoes: [],
      manutencaoAtual: null,
      inicioDoHistorico: agora.toISOString(),
      atualizadoEm: agora.toISOString(),
    },
    avisos,
  };
};

/**
 * Lê um arquivo de planilha: a planilha baixada pelo BenHermes volta exata pela aba oculta
 * "dados" (o .json do mapa em pedaços na coluna A); qualquer outra é lida como a planilha antiga.
 */
export const lerArquivoDoMapa = (livro: XLSX.WorkBook, agora: Date): ResultadoImportacao => {
  const aba = livro.SheetNames.find((n) => normalizarNome(n) === 'DADOS');
  if (!aba) return importarPlanilhaWhatsapp(gradeDaPlanilha(livro), agora);
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(livro.Sheets[aba], { header: 1, defval: '', raw: true });
  return { mapa: importarMapa(linhas.map((l) => String(l[0] ?? '')).join(''), agora), avisos: [] };
};
