/**
 * Tipos do WhatsApp das Baias.
 * Mesas e posições seguem o modelo do protótipo do Sistema de Chamados (OP1-E3, OP1-SUP...),
 * para o mapa poder ser levado para lá no futuro. Datas em ISO.
 */

export type Situacao = 'OK' | 'BANIDO' | 'NAO_TEM' | 'RESTRINGIDO';

export interface EstadoWhatsapp {
  situacao: Situacao;
  /** Só quando RESTRINGIDO */
  restritoAte?: string;
  /** Última mudança de situação */
  mudouEm: string;
}

export interface Lugar {
  /** '' = vaga vazia (no SUP o nome exibido é o supervisor da mesa) */
  operador: string;
  whatsapp: EstadoWhatsapp;
}

/** Quem fica no centro da mesa: SUP = supervisor; SUPSUB = supervisor + backup (sub-líder) */
export type Centro = 'SUP' | 'SUPSUB' | 'NENHUM';

export interface Mesa {
  id: string;
  nome: string;
  /** Prefixo dos códigos: OP1, DG */
  sigla: string;
  supervisor: string;
  esq: number;
  dir: number;
  centro: Centro;
  /** A baia 1 fica perto do supervisor ou da porta */
  inicio: 'sup' | 'porta';
  /** Posições desativadas, ex.: ["E4"] */
  desativadas: string[];
  /** Chave = posição: E1..E8, D1..D8, SUP, SUB */
  lugares: Record<string, Lugar>;
}

export interface Sala {
  id: string;
  nome: string;
  mesas: Mesa[];
}

export interface CelularCorporativo {
  cor: string;
  hex: string;
  messenger: EstadoWhatsapp;
  business: EstadoWhatsapp;
}

export interface MapaWhatsapp {
  versao: 1;
  salas: Sala[];
  celulares: CelularCorporativo[];
  atualizadoEm: string;
}
