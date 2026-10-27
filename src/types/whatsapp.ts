/**
 * Tipos do WhatsApp das Baias.
 * Mesas e posições seguem o modelo do protótipo do Sistema de Chamados (OP1-E3, OP1-SUP...),
 * para o mapa poder ser levado para lá no futuro. Datas em ISO.
 */

/**
 * BANIDO = caiu e ainda não pediram análise; ANALISE = análise pedida; PERMANENTE = número perdido.
 */
export type Situacao = 'OK' | 'BANIDO' | 'ANALISE' | 'PERMANENTE' | 'RESTRINGIDO' | 'NAO_TEM';

export interface EstadoWhatsapp {
  situacao: Situacao;
  /** Só quando RESTRINGIDO */
  restritoAte?: string;
  /** Só quando ANALISE */
  analisePedidaEm?: string;
  /** Última mudança de situação */
  mudouEm: string;
}

export interface Lugar {
  /** '' = vaga vazia (no SUP o nome exibido é o supervisor da mesa) */
  operador: string;
  whatsapp: EstadoWhatsapp;
}

/**
 * Quem fica no centro da mesa. SUPSUB (supervisor + sub-líder) existe pelo site de chamados;
 * o WhatsApp das Baias usa só SUP ou NENHUM.
 */
export type Centro = 'SUP' | 'SUPSUB' | 'NENHUM';

/** Onde o supervisor usa o WhatsApp */
export type WhatsappDoSupervisor = 'NAO_TEM' | 'PC' | 'CELULAR';

export interface Mesa {
  id: string;
  nome: string;
  /** Prefixo dos códigos: OP1, DG */
  sigla: string;
  supervisor: string;
  whatsappSupervisor: WhatsappDoSupervisor;
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

export type Marca = 'SAMSUNG' | 'MOTOROLA' | 'XIAOMI' | 'IPHONE' | 'OUTRO';

/** Um WhatsApp dentro de um celular corporativo */
export interface VagaWhatsapp {
  id: string;
  /** "Proprietário", "Usuário 2", "Padrão", "Pasta segura", "Clonado" */
  grupo: string;
  app: 'MESSENGER' | 'BUSINESS';
  /** "Messenger 1", "Messenger clonado 2", "Business", "Business clonado" */
  rotulo: string;
  /** Posição da baia na mesa do celular (E1..D8); null = backup */
  baia: string | null;
  /** Usado só quando é backup; vaga de operador usa a situação da baia */
  whatsapp: EstadoWhatsapp;
  /** Número do chip ('' = não informado) */
  numero: string;
}

export interface Celular {
  id: string;
  /** Cor da capinha */
  cor: string;
  hex: string;
  /** Para diferenciar dois celulares da mesma cor */
  apelido: string;
  marca: Marca;
  /** Motorola e Xiaomi: 1 a 8; outras marcas: 1 */
  usuarios: number;
  /** Equipe; null = guardado */
  mesaId: string | null;
  /** Todas as vagas são backup (Digital) */
  compartilhado: boolean;
  /** "Benconsig Comercial" ou "Digital Benconsig" */
  nomeBackup: string;
  vagas: VagaWhatsapp[];
}

export interface MapaWhatsapp {
  versao: 2;
  salas: Sala[];
  celulares: Celular[];
  atualizadoEm: string;
}
