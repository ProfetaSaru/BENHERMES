import * as XLSX from 'xlsx';

/**
 * Datas, feriados e nomes: funções comuns às ferramentas da operação
 * (Escala de Bases e Relatório da URA). Mesmas regras do calendario.py e do
 * leitura.py do BENZAITEN. Datas sempre no formato ISO (AAAA-MM-DD).
 */

const DIAS_DA_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

const FERIADOS_FIXOS: [number, number, string][] = [
  [1, 1, 'Confraternização Universal'],
  [21, 4, 'Tiradentes'],
  [1, 5, 'Dia do Trabalho'],
  [7, 9, 'Independência do Brasil'],
  [12, 10, 'Nossa Senhora Aparecida'],
  [2, 11, 'Finados'],
  [15, 11, 'Proclamação da República'],
  [20, 11, 'Dia Nacional de Zumbi e da Consciência Negra'],
  [25, 12, 'Natal'],
];

/**
 * "  José   da Conceição " -> "JOSE DA CONCEICAO". Usado só para comparar nomes.
 */
export const normalizarNome = (texto: unknown): string => {
  return String(texto ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const doisDigitos = (n: number): string => String(n).padStart(2, '0');

export const montarIso = (ano: number, mes: number, dia: number): string =>
  `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;

/** Data de hoje (fuso do computador) no formato AAAA-MM-DD */
export const hojeIso = (): string => {
  const agora = new Date();
  return montarIso(agora.getFullYear(), agora.getMonth() + 1, agora.getDate());
};

/** "2026-10-21" -> "21/10/2026" */
export const isoParaBr = (iso: string): string => {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

/** "21/10/2026" -> "2026-10-21" (ou null se não for uma data válida) */
export const brParaIso = (texto: string): string | null => {
  const partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
  if (!partes) return null;
  const [dia, mes, ano] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const data = new Date(ano, mes - 1, dia);
  if (data.getMonth() !== mes - 1 || data.getDate() !== dia) return null;
  return montarIso(ano, mes, dia);
};

export const isoParaDate = (iso: string): Date => {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
};

export const diaDaSemana = (iso: string): string => DIAS_DA_SEMANA[isoParaDate(iso).getDay()];

export const ehFimDeSemana = (iso: string): boolean => {
  const dia = isoParaDate(iso).getDay();
  return dia === 0 || dia === 6;
};

/**
 * Domingo de Páscoa no calendário gregoriano (algoritmo de Meeus/Jones/Butcher).
 * Exemplo: 2026 -> 2026-04-05
 */
export const domingoDePascoa = (ano: number): string => {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return montarIso(ano, mes, dia);
};

/**
 * Nome do feriado nacional da data (inclusive Sexta-feira Santa), ou null.
 * Feriados estaduais e municipais não entram aqui.
 */
export const feriadoNacional = (iso: string): string | null => {
  const data = isoParaDate(iso);
  const ano = data.getFullYear();

  const fixo = FERIADOS_FIXOS.find(([dia, mes]) => data.getDate() === dia && data.getMonth() + 1 === mes);
  if (fixo) return fixo[2];

  const sexta = isoParaDate(domingoDePascoa(ano));
  sexta.setDate(sexta.getDate() - 2);
  if (sexta.getTime() === data.getTime()) return 'Sexta-feira Santa';

  return null;
};

/**
 * Último dia útil antes da data (segunda -> sexta; pula feriados nacionais).
 * Exemplo: relatório feito em 20/10 é o de 19/10.
 */
export const diaUtilAnterior = (iso: string): string => {
  const data = isoParaDate(iso);
  const paraIso = () => montarIso(data.getFullYear(), data.getMonth() + 1, data.getDate());

  data.setDate(data.getDate() - 1);
  while (ehFimDeSemana(paraIso()) || feriadoNacional(paraIso())) {
    data.setDate(data.getDate() - 1);
  }
  return paraIso();
};

/** Célula de data do Excel (número de série ou texto dd/mm/aaaa) -> AAAA-MM-DD */
export const celulaParaIso = (valor: unknown): string | null => {
  if (typeof valor === 'number' && valor > 0) {
    const data = XLSX.SSF.parse_date_code(valor);
    return data ? montarIso(data.y, data.m, data.d) : null;
  }
  if (typeof valor === 'string') return brParaIso(valor);
  return null;
};
