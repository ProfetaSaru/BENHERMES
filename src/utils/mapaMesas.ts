import { Mesa } from '../types/whatsapp';

/**
 * Mapa de mesas e baias, no mesmo modelo do protótipo do Sistema de Chamados:
 * supervisor (e sub-líder) no centro, baias do lado esquerdo (E1, E2...) e do direito (D1, D2...).
 * Não sabe nada de WhatsApp: é a parte que o site de chamados poderá reaproveitar.
 */

export type FormatoMesa = Pick<Mesa, 'sigla' | 'esq' | 'dir' | 'centro' | 'inicio' | 'desativadas'>;

/** "OP1" + "E3" -> "OP1-E3" */
export const codigoDoLugar = (sigla: string, posicao: string): string => `${sigla}-${posicao}`;

const CENTROS: Record<FormatoMesa['centro'], string[]> = { SUP: ['SUP'], SUPSUB: ['SUP', 'SUB'], NENHUM: [] };

const lado = (letra: 'E' | 'D', quantidade: number): string[] =>
  Array.from({ length: Math.max(0, quantidade) }, (_, i) => `${letra}${i + 1}`);

/** Posições na ordem de exibição, de cima para baixo (inclui as desativadas) */
export const posicoesDaMesa = (mesa: FormatoMesa): { centro: string[]; esquerda: string[]; direita: string[] } => {
  const ordenar = (lista: string[]) => (mesa.inicio === 'porta' ? [...lista].reverse() : lista);
  return {
    centro: [...CENTROS[mesa.centro]],
    esquerda: ordenar(lado('E', mesa.esq)),
    direita: ordenar(lado('D', mesa.dir)),
  };
};

/** Todas as posições em uso: SUP, SUB, E1.., D1.., sem as desativadas */
export const posicoesAtivas = (mesa: FormatoMesa): string[] =>
  [...CENTROS[mesa.centro], ...lado('E', mesa.esq), ...lado('D', mesa.dir)].filter(
    (p) => !mesa.desativadas.includes(p)
  );

/**
 * Lugares para um novo formato de mesa: quem continua fica como está, posições novas são criadas
 * e as que deixaram de existir voltam em `removidos` (para pedir confirmação).
 */
export const ajustarLugares = <T>(
  lugares: Record<string, T>,
  novo: FormatoMesa,
  criar: (posicao: string) => T
): { lugares: Record<string, T>; removidos: string[] } => {
  const ativas = posicoesAtivas(novo);
  // Na ordem em que os lugares foram guardados (a de posicoesAtivas da mesa antiga)
  const removidos = Object.keys(lugares).filter((p) => !ativas.includes(p));
  return {
    lugares: Object.fromEntries(ativas.map((p) => [p, p in lugares ? lugares[p] : criar(p)])),
    removidos,
  };
};
